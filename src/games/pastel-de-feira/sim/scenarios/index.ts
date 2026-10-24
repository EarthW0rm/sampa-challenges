import type { Scenario } from '../harness';
import { balcao } from './balcao';
import { catalogo } from './catalogo';
import { clientes } from './clientes';
import { fechamento } from './fechamento';
import { layout } from './layout';
import { melhorias } from './melhorias';
import { moenda } from './moenda';
import { preparo } from './preparo';
import { relogio } from './relogio';
import { reputacao } from './reputacao';
import { save } from './save';
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
  save,
  reputacao,
  moenda,
  layout,
  tacho,
};
