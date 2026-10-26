/**
 * Sorteio com semente (mulberry32), local deste jogo: a IA usa na busca quando o pedido traz `seed`
 * (testes de ponta a ponta; o `Math.random` semeado da página não chega ao worker).
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
