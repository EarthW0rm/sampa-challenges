import { useState } from 'react';
import { setDelivery, setPrice, setPromo, toggleMenuItem } from '../../game/campaign/actions/menu';
import { fatigueFactor } from '../../game/campaign/fatigue';
import { defaultPrice } from '../../game/campaign/pricing';
import { REFUSAL_TEXT, type Campaign } from '../../game/campaign/types';
import { ingredientsCost } from '../../game/data/catalog';
import { ITEMS, itemIngredients, type Item } from '../../game/data/recipes';
import { BRINDE_MAX_N, BRINDE_MIN_N, CHORINHO_MAX, PRICE_STEP, XEPA_DISCOUNTS } from '../../game/constants';
import { money } from '../format';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
}

export function MenuTab({ campaign: c, onChange }: Props) {
  const [msg, setMsg] = useState('');
  const owned = c.owned.items.map((id) => ITEMS[id]);
  const groups: { title: string; items: Item[]; used: number; slots: number | null }[] = [
    { title: 'Salgados', items: owned.filter((i) => i.kind === 'salgado'), used: c.menu.salgados.length, slots: c.owned.slotsSalgado },
    { title: 'Doces', items: owned.filter((i) => i.kind === 'doce'), used: c.menu.doces.length, slots: c.owned.slotsDoce },
    { title: 'Bebidas', items: owned.filter((i) => i.kind === 'bebida'), used: c.menu.bebidas.length, slots: null },
  ];
  const onMenu = (it: Item) => [...c.menu.salgados, ...c.menu.doces, ...c.menu.bebidas].includes(it.id);

  const toggle = (it: Item) => {
    const r = toggleMenuItem(c, it.id, !onMenu(it));
    if (!r.ok) return setMsg(REFUSAL_TEXT[r.motivo]);
    setMsg('');
    onChange(r.campaign);
  };
  const price = (it: Item, delta: number) => {
    const r = setPrice(c, it.id, (c.prices[it.id] ?? defaultPrice(it.id)) + delta);
    if (r.ok) onChange(r.campaign);
  };

  return (
    <section className="tab" aria-label="Cardápio">
      <p className="hint">
        Preço de venda: cada perfil só compra até um teto sobre a referência (Econômico 0,9×, Padrão 1,2×, Exigente 1,6×).
      </p>
      {msg && <p className="warn" role="status">{msg}</p>}
      {c.owned.delivery && (
        <div className="item">
          <label className="check">
            <input type="checkbox" checked={c.deliveryOn} onChange={(e) => onChange(setDelivery(c, { on: e.target.checked }))} />
            <span className="item-main">
              <strong>Receber pedidos do app hoje</strong>
              <span>Ligado sem equipe, o delivery derruba a reputação (comanda atrasada pesa 3,0).</span>
            </span>
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={c.autoAccept}
              disabled={!c.staff.length}
              onChange={(e) => onChange(setDelivery(c, { auto: e.target.checked }))}
            />
            <span className="item-main">
              <strong>Aceite automático</strong>
              <span>Precisa de um funcionário na Expedição; aceita toda oferta até o teto.</span>
            </span>
          </label>
        </div>
      )}
      <div className="item">
        <strong className="item-main">Promoções</strong>
        <label className="field">
          Brinde (a cada N pastéis, 1 de graça)
          <select value={c.promo.brindeN} onChange={(e) => onChange(setPromo(c, { brindeN: Number(e.target.value) }))}>
            <option value={0}>Desligado</option>
            {Array.from({ length: BRINDE_MAX_N - BRINDE_MIN_N + 1 }, (_, i) => BRINDE_MIN_N + i).map((n) => (
              <option key={n} value={n}>
                A cada {n}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Chorinho do caldo (+10% de cana por nível)
          <select value={c.promo.chorinho} onChange={(e) => onChange(setPromo(c, { chorinho: Number(e.target.value) }))}>
            {Array.from({ length: CHORINHO_MAX + 1 }, (_, i) => i).map((n) => (
              <option key={n} value={n}>
                Nível {n}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={c.promo.xepa} onChange={(e) => onChange(setPromo(c, { xepa: e.target.checked }))} />
          <span className="item-main">
            <strong>Hora da xepa (13h às 14h)</strong>
            <span>Desconto em tudo, mais Econômicos e as sobras saem a 30% do custo.</span>
          </span>
        </label>
        {c.promo.xepa && (
          <label className="field">
            Desconto da xepa
            <select value={c.promo.xepaDiscount} onChange={(e) => onChange(setPromo(c, { xepaDiscount: Number(e.target.value) }))}>
              {XEPA_DISCOUNTS.map((d) => (
                <option key={d} value={d}>
                  {Math.round(d * 100)}%
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {groups.map((g) =>
        g.items.length === 0 ? null : (
          <div key={g.title}>
            <h3 className="group">
              {g.title}
              {g.slots !== null && ` — vagas ${g.used}/${g.slots}`}
            </h3>
            <ul className="list">
              {g.items.map((it) => {
                const fat = it.kind === 'bebida' ? 1 : fatigueFactor(c, it.base);
                const p = c.prices[it.id] ?? defaultPrice(it.id);
                return (
                  <li className="item" key={it.id}>
                    <label className="check">
                      <input type="checkbox" checked={onMenu(it)} onChange={() => toggle(it)} />
                      <span className="item-main">
                        <strong>{it.name}</strong>
                        <span>
                          ref. {money(it.reference)}
                          {c.roles.includes('contador') && ` · custo ${money(ingredientsCost(itemIngredients(it)))} · margem ${money(p - ingredientsCost(itemIngredients(it)))}`}
                          {fat < 1 && ` · procura −${Math.round((1 - fat) * 100)}%`}
                        </span>
                      </span>
                    </label>
                    <div className="stepper">
                      <button type="button" aria-label="Baixar preço" onClick={() => price(it, -PRICE_STEP)}>
                        −
                      </button>
                      <span>{money(p)}</span>
                      <button type="button" aria-label="Subir preço" onClick={() => price(it, PRICE_STEP)}>
                        +
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ),
      )}
    </section>
  );
}
