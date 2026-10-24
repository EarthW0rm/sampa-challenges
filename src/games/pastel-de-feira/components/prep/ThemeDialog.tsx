import { chooseTheme } from '../../game/campaign/actions/menu';
import { REFUSAL_TEXT, type Campaign, type Theme } from '../../game/campaign/types';
import { THEME_CHANGE_COST } from '../../game/constants';
import { money } from '../format';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
  onClose?: () => void;
}

const THEMES: { id: Theme; name: string; text: string }[] = [
  { id: 'popular', name: 'Popular', text: '+15 pontos de Econômicos e a sujeira só incomoda a partir de 75.' },
  { id: 'tradicional', name: 'Tradicional', text: 'Mistura base e variação positiva de reputação +10%.' },
  { id: 'gourmet', name: 'Gourmet', text: '+15 pontos de Exigentes, prêmio de mesa +10% e exigência de nota +10.' },
];

/** Escolha (grátis na primeira vez) e troca (R$ 500) do tema, a partir do dia 5 (RN-17). */
export function ThemeDialog({ campaign: c, onChange, onClose }: Props) {
  const first = c.theme === null;
  return (
    <section className="tab theme" role="dialog" aria-label="Tema da barraca">
      <h3 className="group">{first ? 'Escolha o tema da barraca' : 'Tema da barraca'}</h3>
      <p className="hint">
        {first ? 'A primeira escolha é grátis.' : `Trocar de tema custa ${money(THEME_CHANGE_COST)} (reforma).`}
      </p>
      <ul className="list">
        {THEMES.map((t) => {
          const r = chooseTheme(c, t.id);
          return (
            <li className="item" key={t.id}>
              <div className="item-main">
                <strong>
                  {t.name}
                  {c.theme === t.id ? ' (atual)' : ''}
                </strong>
                <span>{t.text}</span>
                {!r.ok && c.theme !== t.id && <span className="warn">{REFUSAL_TEXT[r.motivo]}</span>}
              </div>
              <button type="button" disabled={!r.ok} onClick={() => r.ok && (onChange(r.campaign), onClose?.())}>
                {first ? 'Escolher' : money(THEME_CHANGE_COST)}
              </button>
            </li>
          );
        })}
      </ul>
      {first && onClose && (
        <button type="button" onClick={onClose}>
          Decidir depois
        </button>
      )}
    </section>
  );
}
