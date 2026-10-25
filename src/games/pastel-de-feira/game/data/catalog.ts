/** Insumos, consumíveis e validade (RN-32, RN-34, RN-39a). Valores (P): calibrados pela simulação. */

export type IngredientId = string;

export type IngredientKind = 'massa' | 'recheio' | 'tempero' | 'cana' | 'complemento';

export interface Ingredient {
  id: IngredientId;
  name: string;
  /** Custo unitário em R$ (RN-32). */
  cost: number;
  kind: IngredientKind;
  /** Rótulo do botão da bancada quando a primeira palavra do nome colide com outro insumo (até 8 letras). */
  short?: string;
}

// RN-32
const INGREDIENT_LIST: readonly Ingredient[] = [
  { id: 'massa', name: 'Massa', cost: 0.8, kind: 'massa' },
  { id: 'carne', name: 'Carne', cost: 1.5, kind: 'recheio' },
  { id: 'mucarela', name: 'Muçarela', cost: 1.4, kind: 'recheio' },
  { id: 'queijo-minas', name: 'Queijo minas', cost: 1.6, kind: 'recheio', short: 'Q.minas' },
  { id: 'queijo-coalho', name: 'Queijo coalho', cost: 1.8, kind: 'recheio', short: 'Q.coalho' },
  { id: 'frango', name: 'Frango', cost: 1.3, kind: 'recheio' },
  { id: 'calabresa', name: 'Calabresa', cost: 1.4, kind: 'recheio' },
  { id: 'cebola', name: 'Cebola', cost: 0.2, kind: 'recheio' },
  { id: 'presunto', name: 'Presunto', cost: 1.6, kind: 'recheio' },
  { id: 'tomate', name: 'Tomate', cost: 0.6, kind: 'recheio' },
  { id: 'oregano', name: 'Orégano', cost: 0.1, kind: 'tempero' },
  { id: 'ovo', name: 'Ovo', cost: 0.5, kind: 'recheio' },
  { id: 'azeitona', name: 'Azeitona', cost: 0.4, kind: 'recheio' },
  { id: 'catupiry', name: 'Catupiry', cost: 2.8, kind: 'recheio' },
  { id: 'cream-cheese', name: 'Cream cheese', cost: 2.2, kind: 'recheio' },
  { id: 'palmito', name: 'Palmito', cost: 3.5, kind: 'recheio' },
  { id: 'carne-seca', name: 'Carne seca', cost: 3.8, kind: 'recheio', short: 'C.seca' },
  { id: 'camarao', name: 'Camarão', cost: 4.5, kind: 'recheio' },
  { id: 'bacalhau', name: 'Bacalhau', cost: 5.5, kind: 'recheio' },
  { id: 'banana', name: 'Banana', cost: 0.4, kind: 'recheio' },
  { id: 'acucar-canela', name: 'Açúcar e canela', cost: 0.1, kind: 'tempero' },
  { id: 'doce-de-leite', name: 'Doce de leite', cost: 1.0, kind: 'recheio' },
  { id: 'pacoca', name: 'Paçoca', cost: 0.5, kind: 'recheio' },
  { id: 'goiabada', name: 'Goiabada', cost: 0.7, kind: 'recheio' },
  { id: 'chocolate-leite', name: 'Chocolate ao leite', cost: 1.2, kind: 'recheio', short: 'C.leite' },
  { id: 'chocolate-branco', name: 'Chocolate branco', cost: 1.3, kind: 'recheio', short: 'C.branco' },
  { id: 'creme-avela', name: 'Creme de avelã', cost: 1.6, kind: 'recheio' },
  { id: 'cana', name: 'Cana (1 dose)', cost: 0.7, kind: 'cana' },
  { id: 'limao', name: 'Limão', cost: 0.3, kind: 'complemento' },
  { id: 'abacaxi', name: 'Abacaxi', cost: 0.6, kind: 'complemento' },
];

export const INGREDIENTS: Readonly<Record<IngredientId, Ingredient>> = Object.freeze(
  Object.fromEntries(INGREDIENT_LIST.map((i) => [i.id, Object.freeze(i)])),
);

/** Rótulo do insumo no painel da bancada: único entre os insumos (RN-42), no máximo 8 letras. */
export const ingredientLabel = (id: IngredientId): string => INGREDIENTS[id].short ?? INGREDIENTS[id].name.split(' ')[0].slice(0, 8);

export const INGREDIENT_IDS: readonly IngredientId[] = INGREDIENT_LIST.map((i) => i.id);

/** Dias de validade da massa (RN-34). Os demais insumos estragam no fechamento (salvo caixa térmica, RN-39). */
export const DOUGH_SHELF_DAYS = 3;

export type ConsumableId = 'copo' | 'saquinho' | 'embalagem';

export interface Consumable {
  id: ConsumableId;
  name: string;
  cost: number;
}

// RN-39a
export const CONSUMABLES: Readonly<Record<ConsumableId, Consumable>> = Object.freeze({
  copo: { id: 'copo', name: 'Copo', cost: 0.15 },
  saquinho: { id: 'saquinho', name: 'Saquinho de papel', cost: 0.05 },
  embalagem: { id: 'embalagem', name: 'Embalagem do app', cost: 0.4 },
});

export const CONSUMABLE_IDS: readonly ConsumableId[] = ['copo', 'saquinho', 'embalagem'];

/** Custo dos insumos de uma lista (massa, recheio, tempero) em R$. */
export const ingredientsCost = (needs: Iterable<[IngredientId, number]>): number => {
  let v = 0;
  for (const [id, n] of needs) v += (INGREDIENTS[id]?.cost ?? 0) * n;
  return v;
};
