/**
 * Piloto do Dia de Feira, empacotado com esbuild e injetado na página (`pilot.ts`). Usa o jogador
 * automático de calibração (`sim/player.ts`) só para DECIDIR; cada decisão vira gestos de tela
 * (toque, segurar, soltar, tecla) que o teste executa com o mouse e o teclado reais do Playwright.
 * Nenhum comando é enviado direto à simulação.
 */
import { INGREDIENTS, ingredientLabel } from '../../../src/games/pastel-de-feira/game/data/catalog';
import { ITEMS } from '../../../src/games/pastel-de-feira/game/data/recipes';
import type { E2EHook } from '../../../src/games/pastel-de-feira/game/e2eHook';
import { PANEL } from '../../../src/games/pastel-de-feira/game/layout';
import type { DaySim } from '../../../src/games/pastel-de-feira/game/sim/day';
import type { Command, StationId } from '../../../src/games/pastel-de-feira/game/types';
import { DEFAULT_STYLE, Player } from '../../../src/games/pastel-de-feira/sim/player';

export type Gesture =
  | { kind: 'tap'; x: number; y: number; why: string }
  | { kind: 'down'; x: number; y: number; why: string }
  | { kind: 'up'; why: string }
  | { kind: 'key'; code: string; why: string }
  | { kind: 'over' }
  | { kind: 'budget' };

type Step = () => Gesture | 'skip' | 'again';

interface PilotWindow {
  __pf?: E2EHook | null;
  __pfFrames: (n: number) => void;
  __pfPilot?: unknown;
}

const w = window as unknown as PilotWindow;
const DRINK_LABEL: Record<string, string> = { 'caldo-puro': 'PURO', 'caldo-limao': 'LIMAO', 'caldo-abacaxi': 'ABACAXI' };
const center = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 });

let player: Player | null = null;
let steps: Step[] = [];
let acted = false;
let holding: 'oleo' | 'moenda' | 'limpar' | null = null;
/** A troca de óleo segurada já começou na simulação (o comando entra no passo seguinte ao toque). */
let holdSeen = false;
let gestures = 0;
const misses: string[] = [];

function hook(): E2EHook {
  const pf = w.__pf;
  if (!pf) throw new Error('piloto: o dia não está aberto');
  return pf;
}

/** Toque no centro da zona (recolhe antes o painel se ele cobre a zona). */
function tapZone(station: StationId): Step[] {
  return [
    () => {
      const pf = hook();
      const z = pf.env.layout.byId.get(station);
      if (!z) return miss(`zona ${station} ausente`);
      return pf.env.ui.panel !== null && z.y + z.h > PANEL.y ? { kind: 'key', code: 'Escape', why: `recolher painel para tocar ${station}` } : 'skip';
    },
    () => {
      const z = hook().env.layout.byId.get(station)!;
      return { kind: 'tap', x: z.x + z.w / 2, y: z.y + Math.min(z.h - 6, z.h / 2), why: `estação ${station}` };
    },
  ];
}

function miss(reason: string): 'skip' {
  misses.push(`${hook().sim.state.tick}: ${reason}`);
  return 'skip';
}

function control(match: (label: string) => boolean, kind: 'tap' | 'down', why: string): Step {
  return () => {
    const ctl = hook().controls().find((c) => match(c.label));
    if (!ctl) return miss(`controle ausente: ${why} (painel ${hook().env.ui.panel}: ${hook().controls().map((c) => c.label).join(',')})`);
    return { kind, ...center(ctl), why };
  };
}

/**
 * Ingrediente da bancada, virando a página (MAIS) se preciso. O botão é achado pela POSIÇÃO (a mesma
 * ordem de `panel.ts`: recheios dos itens do cardápio, 8 por página), não pelo rótulo: o painel mostra
 * rótulos repetidos (CARNE para carne e carne seca, QUEIJO para queijo minas e coalho), bug coberto em
 * `bancada.spec.ts`.
 */
function ingredient(id: string): Step {
  return () => {
    const pf = hook();
    const seen = new Set<string>();
    for (const m of pf.sim.state.config.menu) {
      for (const ing of ITEMS[m.item].filling) if (!/cana|complemento/.test(INGREDIENTS[ing].kind)) seen.add(ing);
    }
    const all = [...seen];
    const at = all.indexOf(id);
    if (at < 0) return miss(`ingrediente ${id} fora do painel`);
    const pages = Math.max(1, Math.ceil(all.length / 8));
    const list = pf.controls();
    if (Math.floor(at / 8) !== pf.env.ui.page % pages) {
      const more = list.find((c) => c.label === 'MAIS');
      if (!more) return miss(`ingrediente ${id} em outra página sem botão MAIS`);
      steps.unshift(ingredient(id));
      return { kind: 'tap', ...center(more), why: 'próxima página de ingredientes' };
    }
    const ctl = list[at % 8];
    if (!ctl || ctl.label !== ingredientLabel(id)) return miss(`ingrediente ${id}: posição ${at % 8} mostra ${ctl?.label}`);
    return { kind: 'tap', ...center(ctl), why: `ingrediente ${id}` };
  };
}

function plan(cmd: Command): Step[] {
  switch (cmd.type) {
    case 'tapStation':
      return tapZone(cmd.station);
    case 'tapSlot': {
      const st = cmd.station;
      const open = openPanel(st);
      const slot = cmd.slot;
      if (st === 'balcao' && slot.k === 'anotar') return [...open, control((l) => l === 'ANOTAR', 'tap', 'anotar')];
      if (st === 'balcao' && slot.k === 'moedas') return [...open, control((l) => l === 'COBRAR', 'tap', 'cobrar')];
      if (st === 'balcao' && slot.k === 'pagar') return [...open, control((l) => l === 'PAGAR', 'tap', 'pagar mesa')];
      if (st === 'bancada' && slot.k === 'ingrediente') return [...open, ingredient(slot.id)];
      if (st === 'bancada' && slot.k === 'fechar') return [...open, control((l) => l === 'FECHAR', 'tap', 'fechar')];
      if (st === 'bancada' && slot.k === 'limpar') return [...open, control((l) => l === 'LIMPAR', 'tap', 'limpar bandeja')];
      if (st.startsWith('tacho') && slot.k === 'cesto') return [...open, control((l) => l === `CESTO ${slot.index + 1}`, 'tap', `cesto ${slot.index + 1} de ${st}`)];
      return [() => miss(`tapSlot sem gesto: ${JSON.stringify(cmd)}`)];
    }
    case 'holdStart': {
      const open = openPanel(cmd.station);
      const label = cmd.action === 'oleo' ? 'TROCAR OLEO' : cmd.action === 'limpar' ? (cmd.station === 'mesas' ? 'LIMPAR' : 'VASSOURA') : DRINK_LABEL[cmd.item ?? 'caldo-puro'];
      return [
        ...open,
        () => {
          const g = control((l) => l === label || (cmd.action === 'oleo' && l === 'TROCANDO'), 'down', `segurar ${cmd.action}`)();
          if (g !== 'skip' && g !== 'again') {
            holding = cmd.action as typeof holding;
            holdSeen = false;
          }
          return g;
        },
      ];
    }
    case 'holdEnd':
      return [
        () => {
          holding = null;
          return { kind: 'up', why: 'soltar' };
        },
      ];
    case 'deliver': {
      const ref = cmd.item;
      return [
        ...openPanel('balcao'),
        () => {
          const pf = hook();
          const list = pf.controls();
          const base = list.findIndex((c) => c.label === 'VASSOURA') + 1;
          const st = pf.sim.state;
          const ready = st.ready.filter((x) => x.reservedFor === undefined).slice(0, 7);
          const i = ref.kind === 'pastel' ? ready.findIndex((x) => x.id === ref.id) : st.cups.slice(0, 5).findIndex((x) => x.id === ref.id);
          if (i < 0) return miss(`item ${ref.kind} ${ref.id} fora do painel`);
          const ctl = list[base + (ref.kind === 'pastel' ? i : ready.length + i)];
          return { kind: 'tap', ...center(ctl), why: `escolher ${ref.kind} ${ref.id}` };
        },
        () => {
          const q = hook().queue().find((c) => c.id === cmd.customerId);
          if (!q) return miss(`cliente ${cmd.customerId} fora da fila`);
          return { kind: 'tap', x: q.x, y: q.y - 20, why: `entregar ao cliente ${cmd.customerId}` };
        },
      ];
    }
    case 'acceptOffer':
      return [() => ({ kind: 'tap', x: 320, y: 10, why: 'aceitar oferta do app' })];
    default:
      return [() => miss(`comando sem gesto: ${cmd.type}`)];
  }
}

/** Painel da estação aberto: se não estiver, toca na estação (o pasteleiro já está nela, o painel abre na hora). */
function openPanel(station: StationId): Step[] {
  const zone = tapZone(station);
  return [() => (hook().env.ui.panel === station ? 'skip' : zone[0]()), () => (hook().env.ui.panel === station ? 'skip' : zone[1]())];
}

const pilot = {
  /** Começa um dia novo: jogador novo, sem gesto pendente. */
  start(): void {
    player = new Player(DEFAULT_STYLE);
    steps = [];
    acted = false;
    holding = null;
    gestures = 0;
    misses.length = 0;
  },
  /** Próximo gesto a executar (rodando quadros até ele aparecer), `over` no fim do dia, `budget` ao gastar `maxFrames`. */
  next(maxFrames: number): Gesture {
    if (!player) throw new Error('piloto: chame start()');
    let frames = 0;
    for (;;) {
      while (steps.length > 0) {
        const r = steps.shift()!();
        if (r === 'skip' || r === 'again') continue;
        gestures++;
        return r;
      }
      const pf = w.__pf;
      if (!pf || pf.sim.isOver()) return { kind: 'over' };
      const st = pf.sim.state;
      // a troca de óleo termina sozinha: o dedo sai do botão quando ela acaba
      if (holding === 'oleo' && st.pasteleiro.hold?.action === 'oleo') holdSeen = true;
      if (holding === 'oleo' && holdSeen && st.pasteleiro.hold === null) {
        holding = null;
        gestures++;
        return { kind: 'up', why: 'troca de óleo concluída' };
      }
      if (!acted) {
        acted = true;
        const cmds: Command[] = [];
        const fake = { state: st, dispatch: (c: Command) => cmds.push(c), isOver: () => pf.sim.isOver() } as unknown as DaySim;
        player.act(fake);
        for (const c of cmds) steps.push(...plan(c));
        if (steps.length > 0) continue;
      }
      if (frames >= maxFrames) return { kind: 'budget' };
      w.__pfFrames(1);
      frames++;
      acted = false;
    }
  },
  stats: () => ({ gestures, misses: [...misses] }),
};

w.__pfPilot = pilot;
