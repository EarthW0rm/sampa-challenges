import { exposeE2E } from '../../../shared/e2e/hook';
import { LEVEL_TIME } from './constants';
import type { VehicleKind } from './data';
import type { CorredorEngine, CorredorSnapshot, HazardKind, ItemKind } from './engine';

/** Retângulo em coordenadas da página (CSS px). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type TouchName = 'left' | 'right' | 'brake' | 'grau' | 'helmet';

/**
 * Gancho dos testes de ponta a ponta (`e2e/corredor-sp`). Só existe quando a página de teste liga a
 * flag (`src/shared/e2e/hook.ts`); para o jogador é inerte. Só leitura: os testes jogam pela tela.
 * `prepare` monta pré-condições raras (cada uso é comentado no teste).
 */
export interface CorredorE2E {
  state(): CorredorSnapshot;
  /** Botões de toque e canvas em coordenadas da página (os botões só têm tamanho em ponteiro grosso). */
  targets(): { canvas: Rect | null; touch: Record<TouchName, Rect | null> };
  prepare: {
    /** Veículo a `dz` unidades da moto (faixa 0–3 para quatro rodas, `x` para motos); devolve o id. */
    spawn(kind: VehicleKind, where: { lane?: number; x?: number }, dz: number, kmh?: number): number;
    /** Item ou perigo a `dz` da moto, na posição lateral `x`. */
    thing(kind: ItemKind | HazardKind, x: number, dz: number): void;
    /** Pista vazia e sem surgimento de trânsito, itens e perigos (`false` volta ao normal). */
    calm(on: boolean): void;
    /** Cronômetro do turno em `s` segundos. */
    time(s: number): void;
    /** Leva ao nível `n` (cronômetro no início dele). */
    level(n: number): void;
    /** Troca a garoa no próximo quadro. */
    toggleRain(): void;
    lives(n: number): void;
  };
}

const LABELS: Record<TouchName, string> = { left: '◀', right: '▶', brake: 'FREIO', grau: 'GRAU', helmet: 'Capacete' };

function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
}

/** Publica o gancho do motor vivo; devolve o `dispose` do cleanup do efeito. */
export function exposeCorredor(engine: CorredorEngine, canvas: HTMLCanvasElement): () => void {
  return exposeE2E<CorredorE2E>('corredor-sp', {
    state: () => engine.e2eState(),
    targets: () => {
      const stage = canvas.closest('.stage');
      const touch = {} as Record<TouchName, Rect | null>;
      for (const k of Object.keys(LABELS) as TouchName[]) touch[k] = rectOf(stage?.querySelector(`.tbtn[aria-label="${LABELS[k]}"]`) ?? null);
      return { canvas: rectOf(canvas), touch };
    },
    prepare: {
      spawn: (kind, where, dz, kmh) => engine.e2eSpawnVehicle(kind, where, dz, kmh),
      thing: (kind, x, dz) => engine.e2eSpawnThing(kind, x, dz),
      calm: (on) => engine.e2eCalm(on),
      time: (s) => engine.e2eSetTime(s),
      level: (n) => engine.e2eSetTime((n - 1) * LEVEL_TIME),
      toggleRain: () => engine.e2eToggleRain(),
      lives: (n) => engine.e2eSetLives(n),
    },
  });
}
