/**
 * Cabeçalho das evidências do Pastel de Feira: tela (dia, preparo, título), HUD e o estado do dia
 * lido do gancho `window.__pf`. É o mesmo texto que o Pastel sempre gravou (spec RN-17).
 */
import { describer } from '../../support/describe';

/** Lê da página o que a tela mostra (tela, HUD, estado do dia). Roda no navegador: precisa ser autocontida. */
export const pastelDescriber = describer((w) => {
  const document = w.document;
  const location = w.location;
  const window = w;
  const out: [string, string][] = [];
  const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
  const shown = (el: Element): boolean => (el as HTMLElement).offsetParent !== null || (el as HTMLElement).getClientRects().length > 0;
  out.push(['Rota', location.hash || '#/']);
  const root = document.querySelector('.pastel-de-feira');
  const dialogs = [...document.querySelectorAll('[role=dialog]')].filter(shown).map((d) => d.getAttribute('aria-label') || text(d).slice(0, 80));
  if (!root) out.push(['Tela', 'Hub (fora do jogo)']);
  else if (root.querySelector('.day')) {
    out.push(['Tela', 'Dia de feira']);
    const hud = [...root.querySelectorAll('.hud > span')].map(text).filter(Boolean);
    if (hud.length) out.push(['HUD', hud.join('  ·  ')]);
  } else if (root.querySelector('.prep')) {
    const tab = root.querySelector('[role=tab][aria-selected=true]');
    out.push(['Tela', `Preparo${tab ? ` — aba ${text(tab)}` : ''}`]);
  } else {
    const h = [...root.querySelectorAll('h1, h2')].filter(shown).map(text).filter(Boolean);
    out.push(['Tela', h[0] ?? '(sem título)']);
  }
  if (dialogs.length) out.push(['Diálogo', dialogs.join(' | ')]);
  const status = [...document.querySelectorAll('[role=status], [role=alert]')].filter(shown).map(text).filter(Boolean);
  if (status.length) out.push(['Mensagem', status.join(' | ').slice(0, 200)]);

  type Hook = {
    sim: { state: { tick: number; paused: boolean; pasteleiro: { at: string; to: string | null }; customers: { place: string }[]; ready: unknown[]; cups: unknown[] } };
    env: { ui: { panel: string | null; selected: { kind: string; id: number } | null } };
    controls: () => { label: string }[];
  };
  const pf = (window as unknown as { __pf?: Hook | null }).__pf;
  if (pf) {
    const st = pf.sim.state;
    const s = Math.floor(st.tick / 60);
    out.push(['Simulação', `passo ${st.tick} (${Math.floor(s / 60)}min${String(s % 60).padStart(2, '0')}s de jogo)${st.paused ? ' — PAUSADO' : ''}`]);
    out.push(['Pasteleiro', st.pasteleiro.to ? `${st.pasteleiro.at} → ${st.pasteleiro.to}` : `em ${st.pasteleiro.at}`]);
    const ui = pf.env.ui;
    out.push(['Painel', ui.panel ? `${ui.panel}: ${pf.controls().map((c) => c.label).join(', ').slice(0, 160)}` : 'recolhido']);
    if (ui.selected) out.push(['Selecionado', `${ui.selected.kind} #${ui.selected.id}`]);
    const places = new Map<string, number>();
    for (const c of st.customers) places.set(c.place, (places.get(c.place) ?? 0) + 1);
    out.push(['Clientes', st.customers.length ? [...places].map(([p, n]) => `${n} ${p}`).join(', ') : 'nenhum']);
    out.push(['Prontos', `${st.ready.length} pastel(éis), ${st.cups.length} copo(s)`]);
  }
  return out;
});
