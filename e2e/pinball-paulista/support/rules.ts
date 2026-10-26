import { BONUS_PTS } from '../../../src/games/pinball-paulista/game/constants';
import type { PinballE2EState } from '../../../src/games/pinball-paulista/game/e2eHook';

type Tally = PinballE2EState['tally'];

const n = (t: Tally, k: keyof Tally): number => t[k]?.n ?? 0;

/** Soma dos pontos de todos os eventos do jogo (tem que ser o placar). */
export function tallyTotal(t: Tally): number {
  return Object.values(t).reduce((acc, v) => acc + (v?.pts ?? 0), 0);
}

/**
 * Base do bônus que os eventos contados dariam (README PP-RN-22), sem o prêmio "bônus" do Minhocão
 * (`premios` = quantas vezes ele saiu). O spinner não entra.
 */
export function expectedBase(t: Tally, premios = 0): number {
  return (
    n(t, 'bumper') * BONUS_PTS.bumper +
    n(t, 'estilingue') * BONUS_PTS.estilingue +
    (n(t, 'letraNova') + n(t, 'letraAcesa')) * BONUS_PTS.alvo +
    n(t, 'raia') * BONUS_PTS.raia +
    n(t, 'minhocao') * BONUS_PTS.minhocao +
    premios * BONUS_PTS.premio
  );
}

/** Diferença de contagem de um tipo de evento entre dois estados. */
export function delta(a: PinballE2EState, b: PinballE2EState, k: keyof Tally): { n: number; pts: number } {
  return { n: (b.tally[k]?.n ?? 0) - (a.tally[k]?.n ?? 0), pts: (b.tally[k]?.pts ?? 0) - (a.tally[k]?.pts ?? 0) };
}
