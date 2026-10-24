import type { Scenario } from '../harness';
import { balcao } from './balcao';
import { catalogo } from './catalogo';
import { clientes } from './clientes';
import { delivery } from './delivery';
import { energia } from './energia';
import { equipamentos } from './equipamentos';
import { equipe } from './equipe';
import { fechamento } from './fechamento';
import { layout } from './layout';
import { melhorias } from './melhorias';
import { mesas } from './mesas';
import { moenda } from './moenda';
import { posicoes } from './posicoes';
import { preparo } from './preparo';
import { pagamento } from './pagamento';
import { relogio } from './relogio';
import { reputacao } from './reputacao';
import { save } from './save';
import { sujeira } from './sujeira';
import { tacho } from './tacho';

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
  pagamento,
  sujeira,
  save,
  reputacao,
  moenda,
  layout,
  tacho,
};
