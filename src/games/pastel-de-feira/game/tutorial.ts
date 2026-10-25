import { ITEMS } from './data/recipes';
import { STEP } from './constants';
import { fryOutcome, fryWindow } from './sim/stations/fryer';
import type { DayState } from './sim/state';
import type { StationId } from './types';

/** Passos do dia 1 guiado (RN-170), na ordem do primeiro pedido. */
export type TutorialStep = 'anotar' | 'montar' | 'colocar' | 'tirar' | 'caldo' | 'entregar' | 'cobrar';

export interface TutorialView {
  step: TutorialStep | null;
  /** Estação a destacar (a fila destaca o balcão). */
  station: StationId | null;
  text: string;
  /** O relógio fica parado enquanto o jogador pode fazer o passo agora. */
  hold: boolean;
  done: boolean;
}

const TEXT: Record<TutorialStep, string> = {
  anotar: 'Um cliente chegou. Toque na fila para anotar o pedido.',
  montar: 'Vá à bancada: toque nos recheios do pedido e em Fechar para montar o pastel.',
  colocar: 'Vá ao tacho e toque num cesto vazio para colocar o pastel no óleo.',
  tirar: 'Espere o ponto (o alarme avisa) e toque no cesto para tirar o pastel.',
  caldo: 'O pedido leva caldo: vá à moenda e segure o botão para moer a cana.',
  entregar: 'Volte ao balcão, escolha o item pronto e toque no cliente para entregar.',
  cobrar: 'Toque nas moedas do balcão para cobrar.',
};

const STATION: Record<TutorialStep, StationId | null> = {
  anotar: 'balcao',
  montar: 'bancada',
  colocar: 'tacho1',
  tirar: 'tacho1',
  caldo: 'moenda',
  entregar: 'balcao',
  cobrar: 'balcao',
};

const ORDER: TutorialStep[] = ['anotar', 'montar', 'colocar', 'tirar', 'caldo', 'entregar', 'cobrar'];

/** Algum pastel está no ponto no óleo (o passo "tirar" só congela o relógio quando dá para agir). */
function inPonto(st: DayState): boolean {
  for (const t of st.tachos) {
    for (const b of t.baskets) {
      const f = b.frying;
      if (!f || f.burned) continue;
      if (fryOutcome(fryWindow(ITEMS[f.item], t), f.ticks * STEP) === 'ponto') return true;
    }
  }
  return false;
}

const hasDrink = (st: DayState): boolean => st.customers.some((c) => c.lines.some((l) => ITEMS[l.item]?.kind === 'bebida'));

/**
 * Roteiro do primeiro pedido. Só observa o estado e decide a pausa: nunca injeta comandos.
 * O passo avança quando o fato correspondente aparece no estado (e nunca volta).
 */
export class Tutorial {
  private index = 0;
  private drinkSkipped = false;

  /** Reavalia o estado e devolve o passo atual. */
  observe(st: DayState): TutorialView {
    for (;;) {
      const step = ORDER[this.index];
      if (!step) return { step: null, station: null, text: '', hold: false, done: true };
      if (!this.finished(step, st)) break;
      this.index++;
    }
    const step = ORDER[this.index];
    const waiting = step === 'anotar' ? st.customers.some((c) => c.state === 'aguardando') : true;
    if (!waiting) return { step, station: null, text: 'Aguarde o primeiro cliente chegar.', hold: false, done: false };
    const hold = step === 'tirar' ? inPonto(st) : true;
    return { step, station: STATION[step], text: step === 'tirar' && hold ? 'No ponto! Toque no cesto para tirar o pastel.' : TEXT[step], hold, done: false };
  }

  private finished(step: TutorialStep, st: DayState): boolean {
    const served = st.stats.served > 0;
    const anyFrying = st.tachos.some((t) => t.baskets.some((b) => b.frying));
    switch (step) {
      case 'anotar':
        return served || st.customers.some((c) => c.state === 'anotado');
      case 'montar':
        return served || st.assembled.length > 0 || anyFrying || st.ready.length > 0;
      case 'colocar':
        return served || anyFrying || st.ready.length > 0;
      case 'tirar':
        return served || st.ready.length > 0 || st.cups.length > 0;
      case 'caldo':
        if (!hasDrink(st) && !this.drinkSkipped) this.drinkSkipped = true; // pedido sem caldo: passo pulado
        return served || this.drinkSkipped || st.cups.length > 0;
      case 'entregar':
        return served || st.coins.length > 0;
      case 'cobrar':
        return st.stats.revenue > 0;
    }
  }
}
