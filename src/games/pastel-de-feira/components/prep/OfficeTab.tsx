import { acceptOrder, orderShortfall, rollOrders } from '../../game/campaign/actions/orders';
import { fireRole, hireRole } from '../../game/campaign/actions/upgrades';
import { REFUSAL_TEXT, type Campaign } from '../../game/campaign/types';
import { OFFICE, ROLES, ROLE_IDS } from '../../game/data/office';
import { ITEMS } from '../../game/data/recipes';
import { money, rep1 } from '../format';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
}

const hourText = (h: number): string => `${String(Math.floor(h)).padStart(2, '0')}h${h % 1 ? '30' : '00'}`;

/** Cargos de gestão, encomendas e relatórios (com Contador) (RN-100–104). */
export function OfficeTab({ campaign: c, onChange }: Props) {
  const offers = rollOrders(c);
  const accountant = c.roles.includes('contador');
  return (
    <section className="tab" aria-label="Escritório">
      <p className="hint">
        Com você no escritório durante o dia, a equipe fica 15% mais rápida e você não opera nenhuma estação. Cargos não cansam e custam salário
        diário. {c.roles.length}/{OFFICE.roleSlots} vagas.
      </p>

      <h3 className="group">Cargos</h3>
      <ul className="list">
        {ROLE_IDS.map((id) => {
          const has = c.roles.includes(id);
          const r = has ? fireRole(c, id) : hireRole(c, id);
          return (
            <li className="item" key={id}>
              <div className="item-main">
                <strong>
                  {ROLES[id].name} · {money(ROLES[id].salary)}/dia
                </strong>
                <span>{ROLES[id].desc}</span>
                {!has && !r.ok && <span className="warn">{REFUSAL_TEXT[r.motivo]}</span>}
              </div>
              <button type="button" disabled={!r.ok} onClick={() => r.ok && onChange(r.campaign)}>
                {has ? 'Dispensar' : 'Contratar'}
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="group">Encomendas de hoje</h3>
      <ul className="list">
        {offers.length === 0 && <li className="hint">Nenhuma oferta hoje.</li>}
        {offers.map((o) => {
          const short = orderShortfall(c, o);
          return (
            <li className="item" key={o.id}>
              <div className="item-main">
                <strong>
                  {o.qty} × {ITEMS[o.item].name} às {hourText(o.hour)}
                </strong>
                <span>
                  Paga {money(o.pay)}; atraso custa {money(o.fine)} e pesa 3,0 na reputação.
                </span>
                {short > 0 && <span className="warn">Faltam insumos para {short} unidades.</span>}
              </div>
              <button type="button" onClick={() => { const r = acceptOrder(c, o.id); if (r.ok) onChange(r.campaign); }}>
                Aceitar
              </button>
            </li>
          );
        })}
        {c.orders.map((o) => (
          <li className="item" key={o.id}>
            <div className="item-main">
              <strong>
                Aceita: {o.qty} × {ITEMS[o.item].name} às {hourText(o.hour)}
              </strong>
              <span>Entregue no Balcão ou na Expedição quando o cliente chegar.</span>
            </div>
          </li>
        ))}
      </ul>

      <h3 className="group">Relatórios</h3>
      {!accountant ? (
        <p className="hint">Contrate o Contador para ver os relatórios dos últimos 60 dias.</p>
      ) : c.history.length === 0 ? (
        <p className="hint">Ainda não há dias fechados.</p>
      ) : (
        <div className="report" tabIndex={0} aria-label="Relatório diário">
          <table className="summary">
            <thead>
              <tr>
                <th>Dia</th>
                <th>Lucro</th>
                <th>Rep.</th>
                <th>Vendas</th>
                <th>Atend.</th>
                <th>Perdas</th>
                <th>Desp.</th>
              </tr>
            </thead>
            <tbody>
              {[...c.history].reverse().map((h) => (
                <tr key={h.calendar} className={h.met ? '' : 'neg'}>
                  <td>{h.day}</td>
                  <td>{money(h.profit)}</td>
                  <td>{rep1(h.reputation)}</td>
                  <td>{money(h.revenue)}</td>
                  <td>{h.served}</td>
                  <td>{h.lost}</td>
                  <td>{h.wasteUnits}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
