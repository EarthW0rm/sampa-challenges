import { INGREDIENT_IDS, INGREDIENTS } from '../../game/data/catalog';
import { BASE_RECIPE_IDS, BASE_RECIPES, ITEM_BY_FILLING, ITEMS, UPGRADES } from '../../game/data/recipes';
import { Rng } from '../../game/rng';
import { check, checkEq, type Scenario } from '../harness';

export const catalogo: Scenario[] = [
  {
    id: 'catalogo-contagens',
    rules: 'RN-30, RN-32',
    run() {
      checkEq(BASE_RECIPE_IDS.length, 17, 'receitas base');
      checkEq(INGREDIENT_IDS.length, 30, 'insumos');
      const doces = BASE_RECIPE_IDS.filter((r) => BASE_RECIPES[r].category === 'doce');
      checkEq(doces.length, 5, 'doces');
    },
  },
  {
    id: 'catalogo-integridade',
    rules: 'RN-30, RN-30a',
    run() {
      for (const item of Object.values(ITEMS)) {
        for (const ing of [...item.filling, ...item.seasonings]) {
          check(INGREDIENTS[ing], `insumo inexistente "${ing}" em ${item.id}`);
        }
        check(BASE_RECIPES[item.base] || item.kind === 'bebida', `versão sem receita base: ${item.id}`);
      }
      for (const base of Object.keys(UPGRADES)) check(BASE_RECIPES[base], `melhoria de receita inexistente: ${base}`);
    },
  },
  {
    id: 'catalogo-etapas',
    rules: 'RN-30, D-09, D-11',
    run() {
      const steps: Record<string, number> = {
        carne: 1, queijo: 1, calabresa: 2, bauru: 3, pizza: 2, palmito: 2, especial: 4,
        'banana-canela': 1, 'banana-queijo': 2, 'romeu-julieta': 2, 'carne+1': 2, 'carne+2': 3,
        'queijo+1': 1, 'palmito+1': 3, 'camarao+1': 2, 'carne-seca+1': 2, 'doce-de-leite+1': 2,
        'chocolate+1': 1, 'chocolate+2': 1,
      };
      for (const [id, n] of Object.entries(steps)) checkEq(ITEMS[id].steps, n, `etapas de ${id}`);
      checkEq(ITEMS.especial.doughs, 2, 'massas do Especial da Casa');
    },
  },
  {
    id: 'catalogo-recheio-unico',
    rules: 'RN-42',
    run() {
      const vendaveis = Object.values(ITEMS).filter((i) => i.kind !== 'bebida');
      checkEq(ITEM_BY_FILLING.size, vendaveis.length, 'recheios distintos permitem reconhecer a montagem');
    },
  },
  {
    id: 'rng-determinismo',
    rules: 'spec 5 (determinismo)',
    run(seed) {
      const a = new Rng(seed);
      const b = new Rng(seed);
      for (let i = 0; i < 1000; i++) checkEq(a.next(), b.next(), `valor ${i}`);
      const z = new Rng(0);
      check(z.seed !== 0, 'semente 0 normalizada');
      const n = new Rng(-5);
      check(n.seed > 0, 'semente negativa normalizada');
    },
  },
  {
    id: 'rng-fork',
    rules: 'plan 3.1',
    run(seed) {
      const root = new Rng(seed);
      const x1 = root.fork('clientes');
      root.next();
      root.next();
      const x2 = new Rng(seed).fork('clientes');
      for (let i = 0; i < 100; i++) checkEq(x1.next(), x2.next(), 'fork não depende do consumo do pai');
      const y = new Rng(seed).fork('eventos');
      const z = new Rng(seed).fork('clientes');
      let igual = 0;
      for (let i = 0; i < 100; i++) if (y.next() === z.next()) igual++;
      check(igual < 5, 'rótulos diferentes geram sequências independentes');
    },
  },
  {
    id: 'rng-faixas',
    run(seed) {
      const r = new Rng(seed);
      for (let i = 0; i < 2000; i++) {
        const v = r.next();
        check(v >= 0 && v < 1, 'next em [0,1)');
        const k = r.int(2, 5);
        check(k >= 2 && k <= 5 && Number.isInteger(k), 'int em [2,5]');
      }
      checkEq(r.weighted([1, 2], () => 0), undefined, 'pesos zerados');
    },
  },
];
