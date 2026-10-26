import { describer } from '../../support/describe';

/** Campos do Capacete Voador no cabeçalho das evidências (spec RN-31). Roda no navegador: autocontido. */
export const capaceteDescriber = describer((w) => {
  type S = {
    mode: string;
    difficulty: string;
    names: [string, string];
    phase: string;
    turn: number;
    round: number;
    scores: [number, number];
    wind: number;
    damage: [number, number];
    knockedOut: [boolean, boolean];
    practiceShots: number;
    practiceHits: number;
    computerShot: { angle: number; velocity: number } | null;
    flight: { owner: number; x: number; y: number; step: number } | null;
  };
  const h = (w as unknown as { __e2e?: { api: { state(): S } } | null }).__e2e;
  if (!h) return [];
  const s = h.api.state();
  const d = w.document;
  const modes: Record<string, string> = { pvp: '2 jogadores', pvc: 'contra o computador', practice: 'treino' };
  const out: [string, string][] = [];
  out.push(['Modo', `${modes[s.mode] ?? s.mode}${s.mode === 'pvc' ? ` (${s.difficulty})` : ''}`]);
  out.push(['Rodada', `${s.round} · fase ${s.phase}`]);
  out.push(['Placar', s.mode === 'practice' ? `tiros ${s.practiceShots}, acertos ${s.practiceHits}` : `${s.names[0]} ${s.scores[0]} × ${s.scores[1]} ${s.names[1]}`]);
  out.push(['Vez', `${s.names[s.turn]} (jogador ${s.turn + 1})`]);
  out.push(['Vento', s.wind === 0 ? 'sem vento' : `${s.wind > 0 ? '→' : '←'} ${Math.abs(s.wind)}`]);
  const inputs = [...d.querySelectorAll('.capacete-voador .aim-form input')] as HTMLInputElement[];
  const typed = inputs.length >= 2 ? `ângulo "${inputs[0].value}", velocidade "${inputs[1].value}"` : '(sem formulário)';
  out.push(['Mira digitada', s.computerShot ? `${typed}; computador ${s.computerShot.angle}° / ${s.computerShot.velocity}` : typed]);
  const hp = (i: 0 | 1) => `${Math.max(0, 3 - s.damage[i])}/3${s.knockedOut[i] ? ' (nocaute)' : ''}`;
  out.push(['Motos', `J1 ${hp(0)} · J2 ${hp(1)}`]);
  out.push(['Capacete', s.flight ? `do J${s.flight.owner + 1} em (${s.flight.x.toFixed(1)}, ${s.flight.y.toFixed(1)}), passo ${s.flight.step}` : 'parado']);
  return out;
});
