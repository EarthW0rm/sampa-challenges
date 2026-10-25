import type { IngredientId } from './catalog';

/** Catálogo de receitas (RN-30), melhorias (RN-30a) e bebidas (RN-31). Valores (P). */

export type Category = 'tradicional' | 'nobre' | 'especial' | 'doce' | 'bebida';
export type ItemKind = 'salgado' | 'doce' | 'bebida';
/** Id de um item vendável: receita base (`carne`) ou versão (`carne+1`). */
export type ItemId = string;

export interface Unlock {
  /** Preço da compra em R$. */
  price: number;
  /** Primeiro dia em que a compra aparece. */
  day: number;
}

export interface BaseRecipe {
  id: string;
  name: string;
  category: Category;
  /** Massas por pastel (o Especial da Casa usa 2). */
  doughs: number;
  /** Ingredientes de recheio: cada um é uma etapa de montagem (RN-30). */
  filling: readonly IngredientId[];
  /** Temperos: consumidos, mas não contam como etapa. */
  seasonings: readonly IngredientId[];
  /** Janela do ponto em segundos de fritura [início, fim]. */
  ponto: readonly [number, number];
  /** Segundos de fritura até queimar. */
  burnAt: number;
  /** Preço de referência em R$. */
  reference: number;
  unlock: Unlock;
}

const rec = (
  id: string,
  name: string,
  category: Category,
  filling: IngredientId[],
  seasonings: IngredientId[],
  ponto: [number, number],
  burnAt: number,
  reference: number,
  unlock: Unlock,
  doughs = 1,
): BaseRecipe => ({ id, name, category, doughs, filling, seasonings, ponto, burnAt, reference, unlock });

const U = (price: number, day = 1): Unlock => ({ price, day });

// RN-30
const RECIPE_LIST: readonly BaseRecipe[] = [
  rec('carne', 'Carne', 'tradicional', ['carne'], [], [5, 8], 10, 8, U(0)),
  rec('queijo', 'Queijo', 'tradicional', ['mucarela'], ['oregano'], [5, 8], 10, 8, U(0)),
  rec('frango', 'Frango', 'tradicional', ['frango'], [], [5, 8], 10, 8, U(80)),
  rec('calabresa', 'Calabresa', 'tradicional', ['calabresa', 'cebola'], [], [5, 8], 10, 8.5, U(80)),
  rec('bauru', 'Bauru', 'tradicional', ['presunto', 'mucarela'], [], [6, 9], 11, 11, U(150)),
  rec('frango-catupiry', 'Frango com Catupiry', 'tradicional', ['frango', 'catupiry'], [], [6, 9], 11, 11, U(150)),
  rec('pizza', 'Pizza', 'tradicional', ['mucarela', 'presunto', 'tomate'], ['oregano'], [6, 9], 11, 12, U(150)),
  rec('palmito', 'Palmito', 'nobre', ['palmito', 'catupiry'], [], [9, 10.5], 11.5, 16, U(400, 6)),
  rec('carne-seca', 'Carne Seca', 'nobre', ['carne-seca', 'queijo-coalho'], [], [9, 10.5], 11.5, 17, U(450, 8)),
  rec('camarao', 'Camarão', 'nobre', ['camarao', 'catupiry'], [], [9, 10.5], 11.5, 20, U(600, 11)),
  rec('bacalhau', 'Bacalhau', 'nobre', ['bacalhau', 'azeitona'], [], [9, 10.5], 11.5, 22, U(700, 14)),
  rec('especial', 'Especial da Casa', 'especial', ['carne', 'ovo', 'mucarela', 'azeitona'], [], [10, 12], 13, 24, U(500, 6), 2),
  rec('banana-canela', 'Banana com Canela', 'doce', ['banana'], ['acucar-canela'], [4, 6], 7, 9, U(100)),
  rec('doce-de-leite', 'Doce de Leite', 'doce', ['doce-de-leite'], [], [4, 6], 7, 9, U(100)),
  rec('romeu-julieta', 'Romeu e Julieta', 'doce', ['mucarela', 'goiabada'], [], [4, 6], 7, 10, U(150)),
  rec('banana-queijo', 'Banana com Queijo', 'doce', ['banana', 'mucarela'], ['acucar-canela'], [4, 6], 7, 10, U(150)),
  rec('chocolate', 'Chocolate', 'doce', ['chocolate-leite'], [], [4, 6], 7, 11, U(200)),
];

export const BASE_RECIPES: Readonly<Record<string, BaseRecipe>> = Object.freeze(
  Object.fromEntries(RECIPE_LIST.map((r) => [r.id, r])),
);
export const BASE_RECIPE_IDS: readonly string[] = RECIPE_LIST.map((r) => r.id);

/** Melhoria de receita (RN-30a): acrescenta um ingrediente (soma etapa) ou troca um (mantém etapas). */
export interface Upgrade {
  /** Posição na sequência de compra: 1 ou 2. */
  level: 1 | 2;
  price: number;
  /** Aumento da referência sobre a base (0,2 e 0,4). */
  refBonus: number;
  add?: IngredientId;
  swap?: { from: IngredientId; to: IngredientId };
}

const UP1 = { price: 120, refBonus: 0.2 };
const UP2 = { price: 250, refBonus: 0.4 };

export const UPGRADES: Readonly<Record<string, readonly Upgrade[]>> = Object.freeze({
  carne: [
    { level: 1, ...UP1, add: 'azeitona' },
    { level: 2, ...UP2, add: 'ovo' },
  ],
  queijo: [{ level: 1, ...UP1, swap: { from: 'mucarela', to: 'queijo-minas' } }],
  palmito: [{ level: 1, ...UP1, add: 'mucarela' }],
  camarao: [{ level: 1, ...UP1, swap: { from: 'catupiry', to: 'cream-cheese' } }],
  'carne-seca': [{ level: 1, ...UP1, swap: { from: 'queijo-coalho', to: 'catupiry' } }],
  'doce-de-leite': [{ level: 1, ...UP1, add: 'pacoca' }],
  chocolate: [
    { level: 1, ...UP1, swap: { from: 'chocolate-leite', to: 'chocolate-branco' } },
    { level: 2, ...UP2, swap: { from: 'chocolate-branco', to: 'creme-avela' } },
  ],
});

/** Item vendável: receita base, versão melhorada ou bebida. */
export interface Item {
  id: ItemId;
  /** Receita base (igual a `id` na versão 0). */
  base: string;
  /** 0 = receita base; 1 e 2 = melhorias. */
  version: number;
  name: string;
  kind: ItemKind;
  category: Category;
  doughs: number;
  filling: readonly IngredientId[];
  seasonings: readonly IngredientId[];
  /** Etapas de montagem = ingredientes de recheio. */
  steps: number;
  ponto: readonly [number, number];
  burnAt: number;
  reference: number;
  unlock: Unlock;
}

export const itemId = (base: string, version: number): ItemId => (version === 0 ? base : `${base}+${version}`);

function buildVersions(base: BaseRecipe): Item[] {
  const kind: ItemKind = base.category === 'doce' ? 'doce' : 'salgado';
  const out: Item[] = [];
  let filling = [...base.filling];
  out.push({
    id: base.id, base: base.id, version: 0, name: base.name, kind, category: base.category,
    doughs: base.doughs, filling, seasonings: base.seasonings, steps: filling.length,
    ponto: base.ponto, burnAt: base.burnAt, reference: base.reference, unlock: base.unlock,
  });
  for (const up of UPGRADES[base.id] ?? []) {
    filling = [...filling];
    if (up.add) filling.push(up.add);
    if (up.swap) filling[filling.indexOf(up.swap.from)] = up.swap.to;
    out.push({
      id: itemId(base.id, up.level), base: base.id, version: up.level,
      name: `${base.name} ${up.level === 1 ? 'Reforçado' : 'Premium'}`, kind, category: base.category,
      doughs: base.doughs, filling, seasonings: base.seasonings, steps: filling.length,
      ponto: base.ponto, burnAt: base.burnAt, reference: Math.round(base.reference * (1 + up.refBonus) * 100) / 100,
      unlock: { price: up.price, day: 1 },
    });
  }
  return out;
}

// RN-31
const DRINKS: readonly Item[] = [
  { id: 'caldo-puro', name: 'Caldo puro', reference: 7, unlock: U(0), filling: [] },
  { id: 'caldo-limao', name: 'Caldo com limão', reference: 8, unlock: U(100), filling: ['limao'] },
  { id: 'caldo-abacaxi', name: 'Caldo com abacaxi', reference: 9, unlock: U(180), filling: ['abacaxi'] },
].map((d) => ({
  id: d.id, base: d.id, version: 0, name: d.name, kind: 'bebida' as const, category: 'bebida' as const,
  doughs: 0, filling: d.filling, seasonings: [], steps: 0, ponto: [0, 0] as const, burnAt: 0,
  reference: d.reference, unlock: d.unlock,
}));

export const ITEMS: Readonly<Record<ItemId, Item>> = Object.freeze(
  Object.fromEntries([...RECIPE_LIST.flatMap(buildVersions), ...DRINKS].map((i) => [i.id, Object.freeze(i)])),
);
export const ITEM_IDS: readonly ItemId[] = Object.keys(ITEMS);

/** Insumos totais (com massa e temperos) consumidos por uma unidade do item. */
export function itemIngredients(item: Item): Map<IngredientId, number> {
  const m = new Map<IngredientId, number>();
  const add = (id: IngredientId, n: number) => m.set(id, (m.get(id) ?? 0) + n);
  if (item.kind === 'bebida') add('cana', 1);
  if (item.doughs > 0) add('massa', item.doughs);
  for (const f of item.filling) add(f, 1);
  for (const s of item.seasonings) add(s, 1);
  return m;
}

/** Chave canônica do recheio (sem temperos nem massa), usada para casar a montagem do jogador. */
export const fillingKey = (filling: readonly IngredientId[]): string => [...filling].sort().join('+');

/** Mapa recheio → item, para a bancada reconhecer o que foi montado. */
export const ITEM_BY_FILLING: ReadonlyMap<string, Item> = new Map(
  Object.values(ITEMS)
    .filter((i) => i.kind !== 'bebida')
    .map((i) => [fillingKey(i.filling), i]),
);
