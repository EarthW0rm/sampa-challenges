import type { Scenario } from '../harness';
import { automacao } from './automacao';
import { balcao } from './balcao';
import { catalogo } from './catalogo';
import { clientes } from './clientes';
import { combinacoes } from './combinacoes';
import { delivery } from './delivery';
import { encomendas } from './encomendas';
import { desafios } from './desafios';
import { energia } from './energia';
import { equipamentos } from './equipamentos';
import { estacoes } from './estacoes';
import { eventosPrevistos } from './eventos-previstos';
import { eventosSurpresa } from './eventos-surpresa';
import { escritorio } from './escritorio';
import { equipe } from './equipe';
import { fechamento } from './fechamento';
import { layout } from './layout';
import { melhorias } from './melhorias';
import { mesas } from './mesas';
import { moenda } from './moenda';
import { posicoes } from './posicoes';
import { ponto } from './ponto';
import { preparo } from './preparo';
import { pagamento } from './pagamento';
import { perfis } from './perfis';
import { promocoes } from './promocoes';
import { relogio } from './relogio';
import { xepaTema } from './xepa-tema';
import { reputacao } from './reputacao';
import { save } from './save';
import { sujeira } from './sujeira';
import { tacho } from './tacho';
import { replay } from './replay';
import { tutorial } from './tutorial';
import { velocidade } from './velocidade';

/** Grupos de cenários. Cada TF de regra acrescenta o seu aqui. */
export const GROUPS: Readonly<Record<string, Scenario[]>> = {
  catalogo,
  balcao,
  clientes,
  relogio,
  preparo,
  fechamento,
  melhorias,
  equipamentos,
  equipe,
  posicoes,
  energia,
  mesas,
  delivery,
  escritorio,
  encomendas,
  desafios,
  estacoes,
  automacao,
  perfis,
  ponto,
  'eventos-previstos': eventosPrevistos,
  'eventos-surpresa': eventosSurpresa,
  promocoes,
  'xepa-tema': xepaTema,
  pagamento,
  sujeira,
  save,
  reputacao,
  moenda,
  layout,
  tacho,
  replay,
  combinacoes,
  tutorial,
  velocidade,
};
