import { exposeE2E } from '../../../shared/e2e/hook';
import type { CapaceteEngine, EngineE2EState, EngineE2ETargets, SimulatedShot } from './engine';
import type { PlayerIndex } from './types';

/**
 * Gancho dos testes de ponta a ponta (`e2e/capacete-voador`). Só existe quando a página de teste liga a
 * flag (`src/shared/e2e/hook.ts`); para o jogador é inerte. Os testes jogam pela tela (campos e Enter);
 * a `api` só lê. Escrita só em `prepare`, para pré-condições raras (cada uso comentado no teste).
 */
export interface CapaceteE2E {
  /** Retrato do motor: modo, fase, vez, rodada, placar, vento, dano, voo, cidade, registro dos tiros. */
  state(): EngineE2EState;
  /** Cabeça, moto e ponto de lançamento de cada motoboy (pixels lógicos 640×400) e os seletores do formulário. */
  targets(): EngineE2ETargets & { form: [FormTargets, FormTargets] };
  /** Simula o tiro de `player` (padrão: quem tem a vez) com a mesma física do jogo, sem disparar. */
  simulateShot(angle: number, velocity: number, player?: PlayerIndex): SimulatedShot;
  /** O pixel lógico é prédio na máscara de colisão? (crateras) */
  solid(x: number, y: number): boolean;
  prepare: {
    /** Troca o vento da rodada atual. */
    wind(v: number): void;
    /** Troca a cidade da rodada atual por uma gerada com a semente (use antes do 1º tiro da rodada). */
    city(seed: number): void;
  };
}

export interface FormTargets {
  angle: string;
  velocity: string;
  fire: string;
}

const form = (p: PlayerIndex): FormTargets => {
  const panel = `.capacete-voador .player-panel.${p === 0 ? 'left' : 'right'} .aim-form`;
  return { angle: `${panel} input >> nth=0`, velocity: `${panel} input >> nth=1`, fire: `${panel} button[type=submit]` };
};

/** mulberry32: cidade de `prepare.city` independente do `Math.random` da página. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Publica o gancho do motor; devolve o `dispose` do cleanup do efeito. */
export function exposeCapacete(engine: CapaceteEngine): () => void {
  return exposeE2E<CapaceteE2E>('capacete-voador', {
    state: () => engine.e2eState(),
    targets: () => ({ ...engine.e2eTargets(), form: [form(0), form(1)] }),
    simulateShot: (angle, velocity, player) => engine.e2eSimulate({ angle, velocity }, player),
    solid: (x, y) => engine.e2eSolid(x, y),
    prepare: {
      wind: (v) => engine.e2eSetWind(v),
      city: (seed) => engine.e2eSetCity(mulberry32(seed)),
    },
  });
}
