import { useState } from 'react';
import { HANDOVER } from '../game/campaign/actions/handover';
import { START_CASH, TRADITIONAL_CASH_BONUS } from '../game/campaign/campaign';
import { money } from './format';

interface Props {
  value: number;
  kind: 'zerado' | 'falencia';
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação definitiva do "passar o ponto": a campanha atual é substituída (RN-57, spec 4). */
export function HandoverDialog({ value, kind, onConfirm, onCancel }: Props) {
  const [done, setDone] = useState(false);
  return (
    <div className="overlay" role="dialog" aria-label="Passar o ponto">
      <div className="menu">
        <h2>Passar o ponto</h2>
        <p>
          {kind === 'zerado' ? 'Você vende a barraca pelo caixa mais metade do que investiu.' : 'Na falência, o ponto vale 25% do que foi investido.'}
        </p>
        <p>Valor do ponto: {money(value)}</p>
        <p>
          A campanha nova começa com {money(START_CASH + HANDOVER.startShare * value)} no caixa ({money(START_CASH + TRADITIONAL_CASH_BONUS + HANDOVER.startShare * value)} com o
          perfil Tradicional), novo perfil e reputação 3,0.
        </p>
        <p className="warn">A campanha atual é apagada de forma definitiva.</p>
        <button
          type="button"
          className="primary"
          disabled={done}
          onClick={() => {
            setDone(true);
            onConfirm();
          }}
        >
          Passar o ponto
        </button>
        <button type="button" onClick={onCancel} disabled={done}>
          Voltar
        </button>
      </div>
    </div>
  );
}
