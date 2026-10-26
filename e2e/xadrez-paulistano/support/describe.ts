import { describer } from '../../support/describe';

/** Campos do Xadrez Paulistano no cabeçalho das evidências (spec RN-36). Roda no navegador: autocontido. */
export const xadrezDescriber = describer((w) => {
  type S = {
    mode: string;
    level: number;
    turn: string;
    moves: string[];
    check: boolean;
    outcome: { kind: string; winner?: number } | null;
    selected: string | null;
    cursor: string | null;
    thinking: boolean;
    aiPending: boolean;
    promotion: { from: string; to: string } | null;
    bottom: string;
    humanColor: string | null;
  };
  const h = (w as unknown as { __e2e?: { id: string; api: { state(): S } } | null }).__e2e;
  if (!h || h.id !== 'xadrez-paulistano') return [];
  const s = h.api.state();
  const cor = (c: string | null) => (c === 'w' ? 'brancas' : c === 'b' ? 'pretas' : '—');
  const out: [string, string][] = [
    ['Modo', s.mode === 'pvc' ? `contra o computador, nível ${s.level} (você: ${cor(s.humanColor)})` : '2 jogadores'],
    ['Vez', `${cor(s.turn)} · embaixo: ${cor(s.bottom)}`],
    ['Último lance', s.moves.length ? `${Math.ceil(s.moves.length / 2)}. ${s.moves[s.moves.length - 1]} (${s.moves.length} meios-lances)` : '—'],
    ['Xeque', s.check ? 'sim' : 'não'],
    ['Selecionada', s.selected ?? '—'],
    ['Cursor', s.cursor ?? '—'],
    ['IA pensando', s.thinking ? 'sim' : s.aiPending ? 'lance pronto (atraso mínimo)' : 'não'],
  ];
  if (s.promotion) out.push(['Promoção', `${s.promotion.from} → ${s.promotion.to}`]);
  if (s.outcome) out.push(['Resultado', s.outcome.kind + (s.outcome.winner !== undefined ? ` (vencem as ${cor(s.outcome.winner ? 'b' : 'w')})` : '')]);
  return out;
});
