import { describer } from '../../support/describe';

/** Campos do __TITULO__ no cabeçalho das evidências. Roda no navegador: autocontido. */
export const gameDescriber = describer((w) => {
  type Api = { state(): { player: { x: number; y: number } } };
  const h = (w as unknown as { __e2e?: { api: Api } | null }).__e2e;
  if (!h) return [];
  const s = h.api.state();
  return [['Jogador', `(${s.player.x.toFixed(1)}, ${s.player.y.toFixed(1)})`]];
});
