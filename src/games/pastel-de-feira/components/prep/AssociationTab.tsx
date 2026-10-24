import { acceptChallenge, rollChallenges } from '../../game/campaign/actions/challenges';
import type { Campaign } from '../../game/campaign/types';
import { challengeById } from '../../game/data/challenges';
import { money } from '../format';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
}

/** Desafios opcionais da Associação da Feira: o prêmio sai só na conclusão (RN-135). */
export function AssociationTab({ campaign: c, onChange }: Props) {
  const offers = rollChallenges(c);
  return (
    <section className="tab" aria-label="Associação">
      <p className="hint">Aceitar é opcional. Quem não cumpre no prazo só perde a oportunidade, sem multa.</p>
      <h3 className="group">Em andamento</h3>
      <ul className="list">
        {c.challenges.length === 0 && <li className="hint">Nenhum desafio aceito.</li>}
        {c.challenges.map((ch) => {
          const def = challengeById(ch.id);
          if (!def) return null;
          return (
            <li className="item" key={ch.id}>
              <div className="item-main">
                <strong>{def.name}</strong>
                <span>
                  Prêmio {money(def.prize)} · vale até o dia {ch.deadline - c.calendar + 1 > 0 ? `daqui a ${ch.deadline - c.calendar + 1} dia(s)` : 'hoje'}
                  {ch.progress > 0 ? ` · progresso ${ch.progress}` : ''}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
      <h3 className="group">Oferecidos hoje</h3>
      <ul className="list">
        {offers.length === 0 && <li className="hint">Nada novo por enquanto.</li>}
        {offers.map((d) => {
          const r = acceptChallenge(c, d.id);
          return (
            <li className="item" key={d.id}>
              <div className="item-main">
                <strong>{d.name}</strong>
                <span>
                  Prêmio {money(d.prize)} · prazo de {d.days} dias
                </span>
              </div>
              <button type="button" disabled={!r.ok} onClick={() => r.ok && onChange(r.campaign)}>
                Aceitar
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
