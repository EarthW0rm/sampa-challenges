import { describer } from '../../support/describe';

/** Campos do Cachorro Loko no cabeçalho das evidências (spec RN-30). Roda no navegador: autocontido. */
export const gameDescriber = describer((w) => {
  type Box = { kind: string; x: number; y: number; state: string; belt: number };
  type St = {
    phase: string;
    score: number;
    delivered: number;
    lives: number;
    level: number;
    powers: Record<string, number>;
    dog: { x: number; facing: number; dizzy: number };
    boxes: Box[];
    desvios: { state: string; flash: number }[];
  };
  const h = (w as unknown as { __e2e?: { api: { state(): St } } | null }).__e2e;
  if (!h) return [];
  const s = h.api.state();
  const powers = Object.entries(s.powers)
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${v.toFixed(1)} s`);
  const where = (b: Box): string => (b.state === 'belt' ? `E${b.belt + 1}` : b.state === 'drop' ? `E${b.belt + 1}↓` : b.state === 'street' ? 'rua' : 'boca');
  const boxes = s.boxes.map((b) => `${b.kind}@${where(b)}(${Math.round(b.x)},${Math.round(b.y)})`);
  return [
    ['Partida', `${s.phase === 'paused' ? 'PAUSADA' : s.phase === 'over' ? 'FIM' : 'jogando'} · placar ${s.score} (${s.delivered} entregas) · vidas ${s.lives} · nível ${s.level}`],
    ['Poderes', powers.length ? powers.join(', ') : '—'],
    ['Cachorro', `x ${s.dog.x.toFixed(1)} · olhando ${s.dog.facing > 0 ? '→' : '←'}${s.dog.dizzy > 0 ? ` · tonto ${Math.min(s.dog.dizzy, 9).toFixed(2)} s` : ''}`],
    ['Pacotes', boxes.length ? boxes.join(' ') : '—'],
    ['Desvios', s.desvios.map((d, i) => `E${i + 1}: ${d.state}${d.flash > 0 ? ' (piscando)' : ''}`).join(' · ')],
  ];
});
