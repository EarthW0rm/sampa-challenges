import { describer } from '../../support/describe';

/** Campos da Sinuca de Bar no cabeçalho das evidências (spec RN-35). Roda no navegador: autocontido. */
export const sinucaDescriber = describer((w) => {
  type Ball = { n: number; x: number; y: number; on: boolean };
  type St = {
    mode: string;
    rules: string;
    level: number;
    castigo: number;
    names: [string, string];
    phase: string;
    turn: 0 | 1;
    groups: [string | null, string | null];
    isBreak: boolean;
    ballInHand: string | null;
    balls: Ball[];
    aim: number;
    power: number;
    winner: 0 | 1 | null;
    endReason: string | null;
    wins: [number, number];
    thinking: boolean;
    lastShot: { by: number; firstHit: number | null; pocketed: number[]; foul: string | null; again: boolean } | null;
  };
  const h = (w as unknown as { __e2e?: { api: { state(): St } } | null }).__e2e;
  if (!h) return [];
  const s = h.api.state();
  const groupName = (g: string | null) => (g === null ? 'mesa aberta' : s.rules === 'lisas' ? (g === 'A' ? 'lisas' : 'listradas') : g === 'A' ? 'ímpares' : 'pares');
  const on = s.balls.filter((b) => b.on && b.n !== 0).map((b) => b.n);
  const cue = s.balls.find((b) => b.n === 0);
  const deg = (((s.aim * 180) / Math.PI) % 360 + 360) % 360;
  const out: [string, string][] = [
    ['Modalidade', `${s.rules === 'lisas' ? 'lisas × listradas' : 'ímpares × pares'} (castigo ${s.castigo}) · ${s.mode === 'pvc' ? `contra o computador, nível ${s.level}` : '2 jogadores'}`],
    ['Vez', `${s.names[s.turn]} (jogador ${s.turn + 1})${s.isBreak ? ' · saída' : ''} · fase ${s.phase}${s.thinking ? ' · computador pensando' : ''} · vitórias ${s.wins[0]} × ${s.wins[1]}`],
    ['Grupos', `${s.names[0]}: ${groupName(s.groups[0])} · ${s.names[1]}: ${groupName(s.groups[1])}`],
    ['Bolas na mesa', `${on.length}: ${on.join(' ') || '-'} · branca ${cue && cue.on ? `(${cue.x.toFixed(1)}, ${cue.y.toFixed(1)})` : 'fora'}`],
    ['Mira e força', `${deg.toFixed(1)}° · ${Math.round(s.power * 100)}%`],
    ['Bola na mão', s.ballInHand === null ? 'não' : s.ballInHand === 'kitchen' ? 'atrás da linha' : 'qualquer lugar'],
  ];
  const l = s.lastShot;
  if (l) out.push(['Última tacada', `${s.names[l.by]}: 1ª ${l.firstHit ?? 'nenhuma'}, caíram [${l.pocketed.join(' ')}], ${l.foul ? `FALTA: ${l.foul}` : 'sem falta'}${l.again ? ', continua' : ''}`]);
  if (s.winner !== null) out.push(['Resultado', `${s.names[s.winner]} venceu: ${s.endReason}`]);
  return out;
});
