import type { InputEnv } from './input';
import { panelControls } from './render/panel';
import { queueSpot, workerSpots } from './render/scene';
import { queueOf } from './sim/customers';
import type { DaySim } from './sim/day';
import type { DayResult } from './types';

/**
 * Gancho dos testes de ponta a ponta (`e2e/pastel-de-feira`). Só existe quando a página define
 * `window.__PF_E2E__` antes de carregar o jogo; o jogador nunca vê. Expõe o estado vivo do dia
 * (só leitura nos testes) e as posições lógicas dos alvos de toque, para o teste clicar no canvas
 * como uma pessoa clicaria.
 */
export interface E2EHook {
  sim: DaySim;
  env: InputEnv;
  /** Controles do painel aberto, com o retângulo lógico de cada um. */
  controls: () => { label: string; sub?: string; selected?: boolean; x: number; y: number; w: number; h: number }[];
  /** Clientes da fila do balcão na ordem, com o ponto lógico dos pés. */
  queue: () => { id: number; x: number; y: number }[];
  /** Funcionários e o ponto lógico dos pés. */
  workers: () => { id: number; x: number; y: number }[];
  /** `DayResult` entregue ao fim do dia (corte das 14h). */
  result: DayResult | null;
}

/** `__pfLast` guarda o gancho do último dia mesmo depois que a tela do dia desmonta (fechamento). */
type E2EWindow = Window & { __PF_E2E__?: boolean; __pf?: E2EHook | null; __pfLast?: E2EHook };

/** Liga o gancho para este dia; devolve a função que o desliga (cleanup do efeito). */
export function exposeForE2E(sim: DaySim, env: InputEnv): { finish: (r: DayResult) => void; dispose: () => void } {
  const w = window as E2EWindow;
  if (!w.__PF_E2E__) return { finish: () => {}, dispose: () => {} };
  const hook: E2EHook = {
    sim,
    env,
    controls: () => panelControls(sim.state, env.ui).map((c) => ({ label: c.label, sub: c.sub, selected: c.selected, ...c.rect })),
    queue: () => queueOf(sim.state).map((c, i) => ({ id: c.id, ...queueSpot(env.layout, i) })),
    workers: () => [...workerSpots(env.layout, sim.state)].map(([id, p]) => ({ id, ...p })),
    result: null,
  };
  w.__pf = hook;
  w.__pfLast = hook;
  return {
    finish: (r) => {
      hook.result = r;
    },
    dispose: () => {
      if (w.__pf === hook) w.__pf = null;
    },
  };
}
