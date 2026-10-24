import type { Scenario } from '../harness';
import { balcao } from './balcao';
import { catalogo } from './catalogo';
import { clientes } from './clientes';
import { moenda } from './moenda';
import { relogio } from './relogio';
import { reputacao } from './reputacao';
import { tacho } from './tacho';

/** Grupos de cenários. Cada TF de regra acrescenta o seu aqui. */
export const GROUPS: Readonly<Record<string, Scenario[]>> = {
  catalogo,
  balcao,
  clientes,
  relogio,
  reputacao,
  moenda,
  tacho,
};
