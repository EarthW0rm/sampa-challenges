/** Utilitários dos cenários: assertivas com mensagem legível. Roda em node; não entra no bundle do jogo. */

export interface Scenario {
  id: string;
  /** Verificação de uma regra (ou grupo de regras) da spec. Lança Error se falhar. */
  run: (seed: number) => void;
  /** Regras cobertas, só para o relatório. */
  rules?: string;
}

export class CheckError extends Error {}

export function check(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new CheckError(msg);
}

export function checkEq<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) throw new CheckError(`${msg}: esperado ${String(expected)}, obtido ${String(actual)}`);
}

/** Igualdade com tolerância para números de ponto flutuante. */
export function checkNear(actual: number, expected: number, msg: string, eps = 1e-6): void {
  if (!(Math.abs(actual - expected) <= eps)) {
    throw new CheckError(`${msg}: esperado ${expected} (±${eps}), obtido ${actual}`);
  }
}
