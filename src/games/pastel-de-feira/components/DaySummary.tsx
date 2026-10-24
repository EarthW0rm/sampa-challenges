import type { DayResult } from '../game/types';

interface Props {
  result: DayResult;
  onAgain: () => void;
  onExit: () => void;
}

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const signed = (n: number) => `${n >= 0 ? '+' : ''}${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Resumo provisório do dia (vira o Fechamento na US-111). */
export function DaySummary({ result, onAgain, onExit }: Props) {
  const o = result.orders;
  return (
    <main className="screen">
      <h1>Fim da feira</h1>
      <table className="summary">
        <tbody>
          <tr><th>Receita</th><td>{money(result.revenue.total)}</td></tr>
          <tr><th>Troca de óleo</th><td>{money(result.costs.oil)}</td></tr>
          <tr><th>Pedidos atendidos</th><td>{o.served}</td></tr>
          <tr><th>Perdidos por paciência</th><td>{o.lostPatience}</td></tr>
          <tr><th>Perdidos por fila cheia</th><td>{o.queueFull}</td></tr>
          <tr><th>Perdidos por preço</th><td>{o.lostPrice}</td></tr>
          <tr><th>Perdidos por falta de insumo</th><td>{o.noStock}</td></tr>
          <tr><th>Itens errados</th><td>{o.wrong}</td></tr>
          <tr><th>Queimados</th><td>{result.waste.burned}</td></tr>
          <tr><th>Sobras perdidas</th><td>{result.waste.leftover}</td></tr>
          <tr><th>Reputação</th><td>{signed(result.reputation.change)} estrela</td></tr>
        </tbody>
      </table>
      <div className="row">
        <button type="button" onClick={onAgain}>
          Jogar outro dia
        </button>
        <button type="button" onClick={onExit}>
          Voltar para os jogos
        </button>
      </div>
    </main>
  );
}
