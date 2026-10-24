import { STEP } from '../game/constants';
import { ITEMS, type ItemId } from '../game/data/recipes';
import { unmetItems } from '../game/sim/demand';
import type { DaySim } from '../game/sim/day';
import { fryOutcome, fryWindow, isChanging, isDirty, isLocked, nextFreeBasket } from '../game/sim/stations/fryer';
import type { DayState } from '../game/sim/state';
import type { Command, StationId } from '../game/types';

/** Jogador automático do Dia de Feira: lê o estado e manda `Command` como o toque faria. Só para testes e calibração. */
export interface PlayerStyle {
  /** Passos de reação entre uma ação e a próxima (60 passos = 1 s). */
  reaction: number;
  /** Tira o pastel do óleo no ponto (false = deixa passar, simulando jogador desatento). */
  attentive: boolean;
}

export const DEFAULT_STYLE: PlayerStyle = { reaction: 12, attentive: true };

/** Segundos até acabar o ponto do primeiro pastel no óleo (Infinity se não há nenhum fritando). */
function burnIn(s: DayState): number {
  let left = Infinity;
  for (const t of s.tachos) {
    for (const b of t.baskets) {
      const f = b.frying;
      if (!f || f.burned) continue;
      left = Math.min(left, fryWindow(ITEMS[f.item], t).ponto[1] - f.ticks * STEP);
    }
  }
  return left;
}

const tachoStation = (i: number): StationId => `tacho${i + 1}` as StationId;

export class Player {
  private wait = 0;
  private lastRejected = 0;
  private backoff = 0;

  constructor(private readonly style: PlayerStyle = DEFAULT_STYLE) {}

  /** Chamar antes de cada `sim.step()`. */
  act(sim: DaySim): void {
    const s = sim.state;
    if (s.over) return;
    if (s.rejected > this.lastRejected) {
      this.lastRejected = s.rejected;
      this.backoff = 30; // comando recusado: espera meio segundo para o estado mudar
    }
    if (this.wait > 0) {
      this.wait--;
      return;
    }
    const hold = s.pasteleiro.hold;
    if (hold?.action === 'moenda') {
      // um copo por vez: solta para entregar e voltar a moer se ainda faltar
      if (s.cups.length > 0 || unmetItems(s, true).length === 0 || burnIn(s) < 0.8) sim.dispatch({ type: 'holdEnd' });
      return;
    }
    if (hold?.action === 'limpar') {
      if (s.dirt <= 5) sim.dispatch({ type: 'holdEnd' });
      return;
    }
    if (s.pasteleiro.to !== null || hold) return;
    const cmd = this.decide(s);
    if (!cmd) return;
    sim.dispatch(cmd);
    this.wait = this.style.reaction + this.backoff;
    this.backoff = 0;
  }

  private go(s: DayState, station: StationId, then: Command): Command {
    return s.pasteleiro.at === station ? then : { type: 'tapStation', station };
  }

  private decide(s: DayState): Command | null {
    // 1) pastel no ponto ou queimado no óleo
    for (let t = 0; t < s.tachos.length; t++) {
      const tacho = s.tachos[t];
      for (let i = 0; i < tacho.baskets.length; i++) {
        const f = tacho.baskets[i].frying;
        if (!f) continue;
        const out = f.burned ? 'queimado' : fryOutcome(fryWindow(ITEMS[f.item], tacho), f.ticks * STEP);
        if (out === 'queimado' || out === 'passado' || (out === 'ponto' && this.style.attentive)) {
          return this.go(s, tachoStation(t), { type: 'tapSlot', station: tachoStation(t), slot: { k: 'cesto', index: i } });
        }
      }
    }
    // 2) anotar quem chegou
    if (s.customers.some((c) => c.state === 'aguardando')) return this.go(s, 'balcao', { type: 'tapSlot', station: 'balcao', slot: { k: 'anotar' } });
    // 3) entregar o que está pronto
    const delivery = this.findDelivery(s);
    if (delivery) return this.go(s, 'balcao', delivery);
    // 4) cobrar as moedas
    if (s.coins.length > 0) return this.go(s, 'balcao', { type: 'tapSlot', station: 'balcao', slot: { k: 'moedas' } });
    // 5) pagar mesas
    if (s.payQueue.length > 0) return this.go(s, 'balcao', { type: 'tapSlot', station: 'balcao', slot: { k: 'pagar' } });
    // 5b) óleo sujo ou travado: troca (RN-46) quando o tacho está vazio
    for (let t = 0; t < s.tachos.length; t++) {
      const tacho = s.tachos[t];
      if (isChanging(tacho) || tacho.fireLeft > 0) continue;
      if ((isDirty(tacho) || isLocked(tacho)) && tacho.baskets.every((b) => b.frying === null && b.shadow === null)) {
        return this.go(s, tachoStation(t), { type: 'holdStart', station: tachoStation(t), action: 'oleo' });
      }
    }
    // 5c) barraca suja (RN-130): varre no balcão
    if (s.dirt >= 40 && s.customers.length === 0) return this.go(s, 'balcao', { type: 'holdStart', station: 'balcao', action: 'limpar' });
    // 6) pastel montado esperando cesto livre
    if (s.assembled.length > 0) {
      for (let t = 0; t < s.tachos.length; t++) {
        const free = nextFreeBasket(s, s.tachos[t]);
        if (free >= 0) return this.go(s, tachoStation(t), { type: 'tapSlot', station: tachoStation(t), slot: { k: 'cesto', index: free } });
      }
    }
    // 7) montar o que falta
    const missing = unmetItems(s, false);
    if (missing.length > 0 && s.assembled.length < 4) {
      const cmd = this.assemble(s, missing[0]);
      if (cmd) return cmd;
    }
    // 8) caldo
    if (unmetItems(s, true).length > 0 && s.config.stations.includes('moenda') && burnIn(s) > 6.5) {
      return s.pasteleiro.at === 'moenda'
        ? { type: 'holdStart', station: 'moenda', action: 'moenda' }
        : { type: 'tapStation', station: 'moenda' };
    }
    return null;
  }

  private findDelivery(s: DayState): Command | null {
    for (const c of s.customers) {
      if (c.state !== 'anotado' || c.place !== 'fila') continue;
      for (const line of c.lines) {
        if (line.delivered !== null) continue;
        const wanted = ITEMS[line.item];
        if (wanted.kind === 'bebida') {
          const cup = s.cups.find((x) => x.item === line.item);
          if (cup) return { type: 'deliver', item: { kind: 'copo', id: cup.id }, customerId: c.id };
          continue;
        }
        const ready = s.ready.find((r) => r.reservedFor === undefined && (r.item === line.item || (c.profile !== 'exigente' && ITEMS[r.item].base === wanted.base)));
        if (ready) return { type: 'deliver', item: { kind: 'pastel', id: ready.id }, customerId: c.id };
      }
    }
    return null;
  }

  private assemble(s: DayState, item: ItemId): Command | null {
    const recipe = ITEMS[item];
    const need = [...recipe.filling];
    const tray = [...s.tray];
    for (const x of tray) {
      const k = need.indexOf(x);
      if (k >= 0) need.splice(k, 1);
      else return this.go(s, 'bancada', { type: 'tapSlot', station: 'bancada', slot: { k: 'limpar' } }); // bandeja errada
    }
    if (need.length > 0) return this.go(s, 'bancada', { type: 'tapSlot', station: 'bancada', slot: { k: 'ingrediente', id: need[0] } });
    return this.go(s, 'bancada', { type: 'tapSlot', station: 'bancada', slot: { k: 'fechar' } });
  }
}

/** Joga o dia inteiro e devolve o simulador (para scripts de calibração e de replay). */
export function playDay(sim: DaySim, player: Player, onStep?: (sim: DaySim) => void): DaySim {
  let guard = 0;
  while (!sim.isOver() && guard++ < 20000) {
    player.act(sim);
    sim.step();
    onStep?.(sim);
  }
  return sim;
}
