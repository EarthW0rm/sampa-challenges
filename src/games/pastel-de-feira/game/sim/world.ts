import { DIRT_PATIENCE_LIMIT, OIL_DIRTY_THRESHOLD } from '../constants';
import { FORECAST, SEASON_EFFECTS, SURPRISE, type SurpriseEvent } from '../data/events';
import { spawnCustomer } from './customers';
import { currentQuality } from './quality';
import { addCharm } from './reputation';
import { emit, now, type DayState, type Tacho, type Worker } from './state';

/** Efeitos da estação e dos eventos previstos do dia (RN-141, RN-151). */
export const seasonFx = (s: DayState) => SEASON_EFFECTS[s.config.season];

export const isRaining = (s: DayState): boolean => s.config.forecast === 'chuva';
export const isHeat = (s: DayState): boolean => s.config.forecast === 'calor';
export const tablesBlocked = (s: DayState): boolean => s.config.forecast === 'subprefeitura';

/** Multiplicador da chance de pedir caldo: estação e calor forte acumulam (RN-141, RN-151). */
export const drinkFactor = (s: DayState): number => seasonFx(s).drink * (isHeat(s) ? FORECAST.heatDrink : 1);

/** Multiplicador do cansaço: Verão e calor forte acumulam (RN-141, RN-151). */
export const fatigueFactor = (s: DayState): number => seasonFx(s).fatigue * (isHeat(s) ? FORECAST.heatFatigue : 1);

// ------------------------------------------------------------ eventos surpresa (RN-150, RN-152)


const EPS = 1e-9;
const atHour = (h: number): number => ((h - 7) * 240) / 7;

/** Há energia na barraca? A queda para moenda motorizada, estufa e automação (RN-152). */
export const hasPower = (s: DayState): boolean => s.world.powerLeft <= 0;

function notice(s: DayState, text: string, seconds = 6): void {
  s.notices.push({ text, left: seconds });
}

/** Agenda no começo do dia o único evento surpresa programado (fiscal, energia ou excursão). */
export function planWorld(s: DayState): void {
  const w = s.world;
  if (!s.config.eventsOn) return;
  const rng = s.rng.events;
  const forced = s.config.forceEvent as SurpriseEvent | undefined;
  if (forced === 'fiscal' || forced === 'energia' || forced === 'excursao') {
    w.kind = forced;
    w.at = 30;
    return;
  }
  const hits: SurpriseEvent[] = [];
  if (rng.chance(SURPRISE.fiscalChance)) hits.push('fiscal');
  if (rng.chance(SURPRISE.energyChance)) hits.push('energia');
  if (rng.chance(SURPRISE.excursionChance)) hits.push('excursao');
  if (hits.length === 0) return;
  w.kind = rng.pick(hits);
  w.at = w.kind === 'fiscal' ? atHour(SURPRISE.fiscalFirstHour) + rng.next() * (atHour(SURPRISE.fiscalLastHour) - atHour(SURPRISE.fiscalFirstHour)) : 30 + rng.next() * 170;
}

function begin(s: DayState, kind: SurpriseEvent, text: string): void {
  s.world.used = true;
  s.world.log.push(kind);
  emit(s, 'evento_inicio');
  notice(s, text);
}

function inspect(s: DayState): void {
  const dirtyOil = s.tachos.some((t) => t.dirt >= OIL_DIRTY_THRESHOLD - EPS);
  if (dirtyOil || s.dirt >= DIRT_PATIENCE_LIMIT) {
    s.stats.inspection = 'failed';
    if (s.config.annulFine) {
      s.stats.annulled = true; // o Despachante anula a multa (RN-103)
      notice(s, 'FISCAL: MULTA ANULADA PELO DESPACHANTE');
    } else {
      s.stats.fines = Math.round((s.stats.fines + SURPRISE.fine) * 100) / 100;
      s.stats.inspectionFines = Math.round((s.stats.inspectionFines + SURPRISE.fine) * 100) / 100;
      notice(s, `FISCAL: MULTA R$${SURPRISE.fine} E -0,3 DE REPUTACAO`);
    }
  } else {
    s.stats.inspection = 'passed';
    addCharm(s, 2); // fiscal aprovado: +2,0 de encanto (RN-62)
    notice(s, 'FISCAL: APROVADO');
  }
}

function powerOff(s: DayState, seconds: number): void {
  s.world.powerLeft = seconds;
  for (const r of s.ready) {
    if (r.warmed) {
      // a estufa para de congelar: vale o decaimento normal até a energia voltar (RN-152)
      r.quality = currentQualityOf(s, r);
      r.readyAt = now(s);
      r.warmed = false;
      s.world.pending.push(r.id);
    }
  }
}

function powerOn(s: DayState): void {
  for (const id of s.world.pending) {
    const r = s.ready.find((x) => x.id === id);
    if (r) {
      r.quality = currentQualityOf(s, r);
      r.readyAt = now(s);
      r.warmed = true;
    }
  }
  s.world.pending.length = 0;
  emit(s, 'evento_fim');
}

const currentQualityOf = (s: DayState, r: Parameters<typeof currentQuality>[0]): number => currentQuality(r, now(s));

/** Fogo no tacho: parado por 20 s, pastéis perdidos e R$ 80 de reparo; ninguém se machuca (RN-152, spec 4). */
export function ignite(s: DayState, tacho: Tacho): void {
  tacho.fireLeft = SURPRISE.fireSeconds;
  for (const b of tacho.baskets) {
    if (b.frying) s.stats.burned++;
    b.frying = null;
    b.shadow = null;
  }
  tacho.changeProgress = 0;
  tacho.changeBy = 0;
  if (s.pasteleiro.hold) s.pasteleiro.hold = null; // quem estava na posição sai e espera o fim do bloqueio
  s.stats.repairs = Math.round((s.stats.repairs + SURPRISE.repair) * 100) / 100;
  begin(s, 'fogo', 'FOGO NO TACHO! PARADO POR 20 S');
}

/** Pode haver mais uma surpresa agora? Só uma por dia e só com eventos ligados (RN-150). */
export const canSurprise = (s: DayState): boolean => s.config.eventsOn && !s.world.used && s.world.kind === null;

/** Sorteio de fogo ao colocar um pastel num óleo acima de 90% (RN-152). */
export function fireOnPlace(s: DayState, tacho: Tacho, dirtBefore: number): void {
  if (!canSurprise(s) || dirtBefore < SURPRISE.fireOilLimit - EPS) return;
  if (s.config.forceEvent === 'fogo' || s.rng.events.chance(SURPRISE.fireChancePerPastry)) ignite(s, tacho);
}

/** Funcionário queimado sai por 30 s (RN-152). */
export function maybeBurnWorker(s: DayState, w: Worker): void {
  if (!canSurprise(s) || w.courses.includes('fritura')) return;
  if (s.config.forceEvent === 'queimado' || s.rng.events.chance(SURPRISE.burnedChancePerTake)) {
    w.away = SURPRISE.burnedSeconds;
    w.position = null;
    w.task = null;
    begin(s, 'queimado', `${w.name.toUpperCase()} SE QUEIMOU E SAIU POR 30 S`);
  }
}

/** Relógio dos eventos: fiscal, energia, excursão, fogo e avisos (RN-152, JA-09). */
export function updateWorld(s: DayState, dt: number): void {
  const w = s.world;
  for (let i = s.notices.length - 1; i >= 0; i--) {
    s.notices[i].left -= dt;
    if (s.notices[i].left <= 0) s.notices.splice(i, 1);
  }
  for (const t of s.tachos) if (t.fireLeft > 0) t.fireLeft = Math.max(0, t.fireLeft - dt);
  if (w.powerLeft > 0) {
    w.powerLeft -= dt;
    if (w.powerLeft <= 0) {
      w.powerLeft = 0;
      powerOn(s);
      notice(s, 'ENERGIA VOLTOU');
    }
  }
  if (w.excursionLeft > 0) {
    w.excursionGap -= dt;
    while (w.excursionGap <= 0 && w.excursionLeft > 0) {
      spawnCustomer(s);
      w.excursionLeft--;
      w.excursionGap += SURPRISE.excursionSeconds / SURPRISE.excursionClients;
    }
  }
  if (w.kind && !w.fired && now(s) >= w.at) {
    w.fired = true;
    if (w.kind === 'fiscal') {
      begin(s, 'fiscal', 'O FISCAL CHEGOU!');
      inspect(s);
    } else if (w.kind === 'energia') {
      begin(s, 'energia', 'QUEDA DE ENERGIA!');
      powerOff(s, SURPRISE.energyMin + s.rng.events.next() * (SURPRISE.energyMax - SURPRISE.energyMin));
    } else if (w.kind === 'excursao') {
      begin(s, 'excursao', 'EXCURSAO CHEGANDO: 15 CLIENTES!');
      w.excursionLeft = SURPRISE.excursionClients;
      w.excursionGap = 0;
    }
  }
}
