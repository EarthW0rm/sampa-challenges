import type { Campaign } from '../game/campaign/types';
import { money } from './format';

interface Props {
  campaign: Campaign;
  /** Valor do ponto na falência a partir do dia 10, ou null (RN-52, RN-57). */
  pointValue?: number | null;
  onPoint?: () => void;
  onNew: () => void;
  onExit: () => void;
}

/** Fim de campanha por falência (RN-52). Passar o ponto entra na US-120. */
export function EndScreen({ campaign: c, pointValue = null, onPoint, onNew, onExit }: Props) {
  return (
    <main className="screen">
      <h1>Fim de campanha</h1>
      <p>A barraca faliu no dia {c.day} com {money(c.cash)} no caixa.</p>
      <div className="row">
        {pointValue !== null && onPoint && (
          <button type="button" className="primary" onClick={onPoint}>
            Passar o ponto ({money(pointValue)})
          </button>
        )}
        <button type="button" className={pointValue === null ? 'primary' : ''} onClick={onNew}>
          Nova campanha
        </button>
        <button type="button" onClick={onExit}>
          Sair
        </button>
      </div>
    </main>
  );
}
