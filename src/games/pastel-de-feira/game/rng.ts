/** PRNG determinístico (mulberry32) com subfluxos independentes por rótulo. Nunca usar Math.random em game/**. */

function hashLabel(label: string): number {
  let h = 2166136261;
  for (let i = 0; i < label.length; i++) {
    h ^= label.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Semente 0, negativa ou fracionária vira um inteiro sem sinal diferente de zero. */
export function normalizeSeed(seed: number): number {
  const n = Number.isFinite(seed) ? Math.floor(seed) >>> 0 : 0;
  return n === 0 ? 0x9e3779b9 : n;
}

export class Rng {
  private s: number;
  readonly seed: number;

  constructor(seed: number) {
    this.seed = normalizeSeed(seed);
    this.s = this.seed;
  }

  /** Número em [0, 1). */
  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [min, max], inclusive. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Verdadeiro com a probabilidade `p` (0 a 1). */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(list: readonly T[]): T {
    return list[Math.floor(this.next() * list.length)];
  }

  /** Sorteio com pesos; pesos não positivos nunca saem. Devolve undefined se a soma for zero. */
  weighted<T>(list: readonly T[], weight: (item: T) => number): T | undefined {
    let total = 0;
    for (const it of list) total += Math.max(0, weight(it));
    if (total <= 0) return undefined;
    let r = this.next() * total;
    for (const it of list) {
      const w = Math.max(0, weight(it));
      if (r < w) return it;
      r -= w;
    }
    return list[list.length - 1];
  }

  /** Subfluxo independente: mesma semente + mesmo rótulo = mesma sequência, sem depender de quem sorteou antes. */
  fork(label: string): Rng {
    return new Rng((this.seed ^ hashLabel(label)) >>> 0);
  }
}
