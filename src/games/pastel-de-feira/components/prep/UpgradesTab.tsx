import { blockReason, offers, type ShopSection } from '../../game/campaign/shop';
import { freeM2, totalM2 } from '../../game/campaign/campaign';
import type { Campaign } from '../../game/campaign/types';
import { money } from '../format';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
}

const SECTIONS: { id: ShopSection; title: string }[] = [
  { id: 'receitas', title: 'Receitas e versões' },
  { id: 'bebidas', title: 'Bebidas' },
  { id: 'equipamentos', title: 'Equipamentos' },
  { id: 'espaco', title: 'Espaço e estoque' },
  { id: 'cardapio', title: 'Cardápio' },
];

export function UpgradesTab({ campaign: c, onChange }: Props) {
  const list = offers(c);
  return (
    <section className="tab" aria-label="Melhorias">
      <p className="hint">
        Espaço: {totalM2(c)} m² ({freeM2(c)} livres). Cada m² extra custa R$ 8 por dia no fechamento. Não há revenda.
      </p>
      {SECTIONS.map((sec) => {
        const rows = list.filter((o) => o.section === sec.id);
        if (rows.length === 0) return null;
        return (
          <div key={sec.id}>
            <h3 className="group">{sec.title}</h3>
            <ul className="list">
              {rows.map((o) => {
                const block = blockReason(c, o);
                return (
                  <li className="item" key={o.id}>
                    <div className="item-main">
                      <strong>{o.name}</strong>
                      <span>{o.desc}</span>
                      {block && <span className="warn">{block.text}</span>}
                    </div>
                    <button
                      type="button"
                      disabled={block !== null}
                      onClick={() => {
                        const r = o.buy(c);
                        if (r.ok) onChange(r.campaign);
                      }}
                    >
                      {money(o.price)}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
