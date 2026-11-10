import type { InputEnv } from './input';
import { panelControls } from './render/panel';
import { dispatchSpot, queueSpot, workerSpots } from './render/scene';
import { queueOf } from './sim/customers';
import type { DaySim } from './sim/day';
import type { DayResult } from './types';
import { destinations, railSpots } from './render/rail';
import { openTickets, ticketLabel } from './sim/tickets';

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
  controls: () => { label: string; sub?: string; selected?: boolean; icon?: string; flavor?: string; x: number; y: number; w: number; h: number }[];
  /** Clientes da fila do balcão na ordem, com o ponto lógico dos pés. */
  queue: () => { id: number; x: number; y: number }[];
  /** Funcionários e o ponto lógico dos pés. */
  workers: () => { id: number; x: number; y: number }[];
  /**
   * Comandas abertas dos dois trilhos, da mais antiga para a mais nova (RN-180, RN-181), com os itens e o
   * retângulo lógico no trilho (null quando está escondida no "+N").
   */
  tickets: () => {
    id: number; num: number; label: string; kind: string; track: string; owner: number | null;
    slots: { item: string; filled: boolean; gift: boolean }[];
    rect: { x: number; y: number; w: number; h: number } | null;
  }[];
  /** Fila da Expedição na ordem (RN-191): quem, a comanda, a paciência e o ponto lógico dos pés. */
  dispatch: () => { id: number; who: string; ticketId: number; label: string; patience: number; handoff: number | null; x: number; y: number }[];
  /** Ids das comandas que aceitam o pronto selecionado (destaque do destino, RN-184). */
  destinations: () => number[];
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
    controls: () => panelControls(sim.state, env.ui).map((c) => ({ label: c.label, sub: c.sub, selected: c.selected, icon: c.icon, flavor: c.flavor, ...c.rect })),
    queue: () => queueOf(sim.state).map((c, i) => ({ id: c.id, ...queueSpot(env.layout, i) })),
    workers: () => [...workerSpots(env.layout, sim.state)].map(([id, p]) => ({ id, ...p })),
    tickets: () =>
      (['balcao', 'expedicao'] as const).flatMap((track) => {
        const spots = railSpots(env.layout, sim.state, track).spots;
        return openTickets(sim.state, track).map((t) => ({
          id: t.id, num: t.num, label: ticketLabel(t), kind: t.kind, track: t.track, owner: t.owner,
          slots: t.slots.map((l) => ({ item: l.item, filled: l.filled !== null, gift: !!l.gift })),
          rect: spots.find((x) => x.ticket.id === t.id)?.rect ?? null,
        }));
      }),
    destinations: () => [...destinations(sim.state, env.ui.selected)],
    dispatch: () => {
      const z = env.layout.byId.get('expedicao');
      return sim.state.dispatchQueue.map((e, i) => {
        const t = sim.state.tickets.find((x) => x.id === e.ticketId);
        return { id: e.id, who: e.who, ticketId: e.ticketId, label: t ? ticketLabel(t) : '', patience: e.patience, handoff: e.handoffLeft, ...(z ? dispatchSpot(z, i) : { x: -1, y: -1 }) };
      });
    },
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
