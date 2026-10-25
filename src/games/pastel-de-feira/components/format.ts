const reais = (n: number): string => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Valor em reais; negativo com o mesmo sinal das linhas do balanço ("− R$ 73,00"). */
export const money = (n: number): string => (n < 0 && reais(-n) !== reais(0) ? `− ${reais(-n)}` : reais(Math.abs(n)));

/** Linha do balanço: entrada com "+", saída com "−". Custo zerado (−0) continua sendo saída. */
export const signedMoney = (n: number): string => `${n < 0 || Object.is(n, -0) ? '−' : '+'} ${reais(Math.abs(n))}`;

/** Reputação com uma casa decimal e estrelas de meia em meia. */
export function stars(rep: number): string {
  const half = Math.round(rep * 2) / 2;
  const full = Math.floor(half);
  return '★'.repeat(full) + (half - full >= 0.5 ? '½' : '') + '☆'.repeat(Math.max(0, 5 - full - (half - full >= 0.5 ? 1 : 0)));
}

export const rep1 = (rep: number): string => rep.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
