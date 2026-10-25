import { useState } from 'react';
import { buyConsumable, buyIngredient, unitCost } from '../../game/campaign/actions/inventory';
import { capacityFree, capacityMax, capacityUsed, stockOf } from '../../game/campaign/campaign';
import { showSuggestion, suggestPurchase } from '../../game/campaign/suggest';
import { REFUSAL_TEXT, type Campaign } from '../../game/campaign/types';
import { CONSUMABLES, INGREDIENTS, type ConsumableId, type IngredientId } from '../../game/data/catalog';
import { ITEMS } from '../../game/data/recipes';
import { money } from '../format';
import { ingIcon } from '../icons';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
}

/** Insumos que as receitas compradas usam, na ordem do catálogo. */
function relevantIngredients(c: Campaign): IngredientId[] {
  const set = new Set<IngredientId>(['massa']);
  for (const id of c.owned.items) {
    const it = ITEMS[id];
    for (const i of [...it.filling, ...it.seasonings]) set.add(i);
    if (it.kind === 'bebida') set.add('cana');
  }
  return Object.keys(INGREDIENTS).filter((i) => set.has(i));
}

const KIND_LABEL: Record<string, string> = {
  massa: 'Massa',
  recheio: 'Recheios',
  tempero: 'Temperos',
  cana: 'Caldo de cana',
  complemento: 'Caldo de cana',
};

function nextExpiry(c: Campaign, ing: IngredientId): string {
  const days = c.inventory.filter((l) => l.ingredient === ing && l.qty > 0).map((l) => l.expires);
  if (days.length === 0) return '';
  const d = Math.min(...days) - c.calendar;
  return d <= 0 ? 'vence hoje' : d === 1 ? 'vence amanhã' : `vence em ${d} dias`;
}

export function InventoryTab({ campaign: c, onChange }: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState('');
  const list = relevantIngredients(c);
  const free = capacityFree(c);
  const pending = list.reduce((n, i) => n + (qty[i] ?? 0), 0);

  const set = (key: string, v: number) => setQty((q) => ({ ...q, [key]: Math.max(0, Math.min(999, v)) }));
  const refuse = (m: string) => setMsg(m);

  const buyOne = (ing: IngredientId) => {
    const r = buyIngredient(c, ing, qty[ing] ?? 0);
    if (!r.ok) return refuse(REFUSAL_TEXT[r.motivo]);
    setMsg('');
    set(ing, 0);
    onChange(r.campaign);
  };
  const buyConsumableOne = (id: ConsumableId) => {
    const r = buyConsumable(c, id, qty[id] ?? 0);
    if (!r.ok) return refuse(REFUSAL_TEXT[r.motivo]);
    setMsg('');
    set(id, 0);
    onChange(r.campaign);
  };
  const buyAll = () => {
    let cur = c;
    for (const ing of list) {
      const n = qty[ing] ?? 0;
      if (n <= 0) continue;
      const r = buyIngredient(cur, ing, n);
      if (!r.ok) return refuse(`${INGREDIENTS[ing].name}: ${REFUSAL_TEXT[r.motivo]}`);
      cur = r.campaign;
    }
    for (const id of ['copo', 'saquinho', 'embalagem'] as const) {
      const n = qty[id] ?? 0;
      if (n <= 0) continue;
      const r = buyConsumable(cur, id, n);
      if (!r.ok) return refuse(`${CONSUMABLES[id].name}: ${REFUSAL_TEXT[r.motivo]}`);
      cur = r.campaign;
    }
    setQty({});
    setMsg('');
    onChange(cur);
  };
  const useSuggested = () => {
    const s = suggestPurchase(c);
    const next: Record<string, number> = {};
    for (const i of list) next[i] = s.ingredients[i] ?? 0;
    next.copo = s.consumables.copo;
    next.saquinho = s.consumables.saquinho;
    setQty(next);
    setMsg('');
  };

  const pendingCost =
    list.reduce((n, i) => n + (qty[i] ?? 0) * unitCost(c, i), 0) +
    (qty.copo ?? 0) * CONSUMABLES.copo.cost +
    (qty.saquinho ?? 0) * CONSUMABLES.saquinho.cost;

  let lastGroup = '';
  return (
    <section className="tab" aria-label="Insumos">
      <p className="hint">
        Estoque {capacityUsed(c)}/{capacityMax(c)} · livre {free}. Recheio e cana que sobram estragam no fechamento; a massa vale 3 dias.
      </p>
      <div className="row">
        {showSuggestion(c) && (
          <button type="button" onClick={useSuggested}>
            Usar sugerida
          </button>
        )}
        <button type="button" className="primary" onClick={buyAll} disabled={pending === 0 && !(qty.copo || qty.saquinho)}>
          Comprar tudo ({money(pendingCost)})
        </button>
      </div>
      {msg && <p className="warn" role="status">{msg}</p>}
      <ul className="list">
        {list.map((ing) => {
          const info = INGREDIENTS[ing];
          const group = KIND_LABEL[info.kind];
          const head = group !== lastGroup ? <li className="group" key={`g-${group}`}>{group}</li> : null;
          lastGroup = group;
          return [
            head,
            <li className="item" key={ing}>
              {ingIcon(ing) && <img className="item-icon" src={ingIcon(ing)} alt="" aria-hidden="true" width={24} height={24} />}
              <div className="item-main">
                <strong>{info.name}</strong>
                <span>
                  {money(unitCost(c, ing))} · tem {stockOf(c, ing)} {nextExpiry(c, ing) && `(${nextExpiry(c, ing)})`}
                </span>
              </div>
              <Stepper value={qty[ing] ?? 0} onChange={(v) => set(ing, v)} step={5} />
              <button type="button" onClick={() => buyOne(ing)} disabled={(qty[ing] ?? 0) === 0}>
                Comprar
              </button>
            </li>,
          ];
        })}
        <li className="group">Embalagens</li>
        {(c.owned.delivery ? (['copo', 'saquinho', 'embalagem'] as const) : (['copo', 'saquinho'] as const)).map((id) => (
          <li className="item" key={id}>
            <div className="item-main">
              <strong>{CONSUMABLES[id].name}</strong>
              <span>
                {money(CONSUMABLES[id].cost)} · tem {c.consumables[id]}
              </span>
            </div>
            <Stepper value={qty[id] ?? 0} onChange={(v) => set(id, v)} step={10} />
            <button type="button" onClick={() => buyConsumableOne(id)} disabled={(qty[id] ?? 0) === 0}>
              Comprar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Stepper({ value, onChange, step = 1 }: { value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div className="stepper">
      <button type="button" aria-label="Diminuir" onClick={() => onChange(value - step)}>
        −
      </button>
      <span>{value}</span>
      <button type="button" aria-label="Aumentar" onClick={() => onChange(value + step)}>
        +
      </button>
    </div>
  );
}
