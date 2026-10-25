import type { Balance, Campaign } from '../game/campaign/types';
import type { DayResult } from '../game/types';
import { money, rep1, signedMoney, stars } from './format';

interface Props {
  balance: Balance;
  campaign: Campaign;
  /** Resumo do `DayResult` (pedidos). */
  served: number;
  lost: number;
  appCancelled?: number;
  /** Pedidos do dia, para errados, atrasados por canal e brindes (Jornada 2.3). */
  orders?: DayResult['orders'];
  /** O dia fechado era de modo livre (sem meta, RN-54). */
  freeMode?: boolean;
  onNext: () => void;
}

export function ClosingScreen({ balance: b, campaign: c, served, lost, appCancelled = 0, orders, freeMode = false, onNext }: Props) {
  return (
    <main className="screen closing">
      <h1>Fim da feira</h1>
      <table className="summary">
        <tbody>
          {b.lines.map((l) => (
            <tr key={l.id}>
              <th>{l.label}</th>
              <td className={l.amount < 0 ? 'neg' : ''}>{signedMoney(l.amount)}</td>
            </tr>
          ))}
          <tr className="total">
            <th>Lucro líquido</th>
            <td>{money(b.profit)}</td>
          </tr>
          {b.goal !== null && (
            <tr>
              <th>Meta de lucro</th>
              <td className={b.profitMet ? 'ok' : 'neg'}>{money(b.goal)} {b.profitMet ? '✓' : '✗'}</td>
            </tr>
          )}
          <tr>
            <th>Reputação</th>
            <td>
              {rep1(b.reputationBefore)} → {rep1(b.reputationAfter)} {stars(b.reputationAfter)}
            </td>
          </tr>
          {b.minReputation !== null && (
            <tr>
              <th>Reputação mínima</th>
              <td className={b.reputationMet ? 'ok' : 'neg'}>{rep1(b.minReputation)} {b.reputationMet ? '✓' : '✗'}</td>
            </tr>
          )}
          <tr><th>Pedidos atendidos</th><td>{served}</td></tr>
          <tr><th>Clientes perdidos</th><td>{lost}</td></tr>
          <tr><th>Pedidos errados</th><td>{orders?.wrong ?? 0}</td></tr>
          {(orders?.payFail ?? 0) > 0 && <tr><th>Mesas que saíram sem pagar</th><td>{orders!.payFail}</td></tr>}
          {(orders?.appPicked ?? 0) + appCancelled > 0 && <tr><th>App: entregues / cancelados</th><td>{orders?.appPicked ?? 0} / {appCancelled}</td></tr>}
          {(orders?.encDone ?? 0) + (orders?.encFailed ?? 0) > 0 && <tr><th>Encomendas: entregues / atrasadas</th><td>{orders?.encDone ?? 0} / {orders?.encFailed ?? 0}</td></tr>}
          {(orders?.gifts ?? 0) > 0 && <tr><th>Brindes dados</th><td>{orders!.gifts}</td></tr>}
          <tr><th>Estragados</th><td>{b.spoiledUnits}</td></tr>
          <tr><th>Queimados</th><td>{b.burnedUnits}</td></tr>
          <tr><th>Sobras perdidas</th><td>{b.leftoverUnits}</td></tr>
          <tr><th>Caixa</th><td>{money(c.cash)}</td></tr>
        </tbody>
      </table>
      {b.bankrupt ? (
        <p className="warn">Caixa negativo: a barraca faliu.</p>
      ) : b.freeModeStarted ? (
        <p className="ok">Campanha zerada! Segue o modo livre, sem meta.</p>
      ) : freeMode ? (
        <p className="ok">Modo livre, sem meta. Próximo: dia {b.newDay}.</p>
      ) : b.met ? (
        <p className="ok">Meta cumprida. Próximo: dia {b.newDay}.</p>
      ) : (
        <p className="warn">Meta não cumprida. O dia {b.newDay} se repete.</p>
      )}
      <button type="button" className="primary" onClick={onNext}>
        {b.bankrupt ? 'Continuar' : 'Preparar o próximo dia'}
      </button>
    </main>
  );
}
