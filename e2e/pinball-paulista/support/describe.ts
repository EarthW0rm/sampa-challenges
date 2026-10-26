import { describer } from '../../support/describe';

/** Campos do Pinball Paulista no cabeçalho das evidências (spec RN-34). Roda no navegador: autocontido. */
export const pinballDescriber = describer((w) => {
  type S = {
    phase: string;
    ball: number;
    ballsTotal: number;
    score: number;
    mult: number;
    letters: boolean[];
    bumperHits: number[];
    greens: number;
    wave: number;
    balls: { x: number; y: number; rest: boolean; held: number }[];
    saver: number;
    tilt: boolean;
    nudges: number;
  };
  const h = (w as unknown as { __e2e?: { id: string; api: { state(): S } } | null }).__e2e;
  if (!h || h.id !== 'pinball-paulista') return [];
  const s = h.api.state();
  const word = 'MOTOBOY';
  const letters = s.letters.map((on, i) => (on ? word[i] : '·')).join('');
  const balls = s.balls.map((b) => `(${b.x.toFixed(0)}, ${b.y.toFixed(0)})${b.rest ? ' rampa' : b.held > 0 ? ' presa' : ''}`).join(' ');
  return [
    ['Fase', s.phase],
    ['Bola', `${s.ball}/${s.ballsTotal}`],
    ['Placar', `${s.score} pts, multiplicador ×${s.mult}`],
    ['MOTOBOY', letters],
    ['Semáforos', `batidas ${s.bumperHits.join('/')}, verdes ${s.greens}${s.wave > 0 ? `, onda verde ${s.wave.toFixed(1)} s` : ''}`],
    ['Bolas na mesa', `${s.balls.length}: ${balls}`],
    ['Segura-bola / tilt', `${s.saver > 0 ? `${s.saver.toFixed(1)} s` : 'não'} / ${s.tilt ? 'TILT' : `não (trancos ${s.nudges.toFixed(2)})`}`],
  ];
});
