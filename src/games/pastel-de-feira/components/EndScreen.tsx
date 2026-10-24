import type { Campaign } from '../game/campaign/types';
import { money } from './format';

interface Props {
  campaign: Campaign;
  onNew: () => void;
  onExit: () => void;
}

/** Fim de campanha por falência (RN-52). Passar o ponto entra na US-120. */
export function EndScreen({ campaign: c, onNew, onExit }: Props) {
  return (
    <main className="screen">
      <h1>Fim de campanha</h1>
      <p>A barraca faliu no dia {c.day} com {money(c.cash)} no caixa.</p>
      <div className="row">
        <button type="button" className="primary" onClick={onNew}>
          Nova campanha
        </button>
        <button type="button" onClick={onExit}>
          Sair
        </button>
      </div>
    </main>
  );
}
