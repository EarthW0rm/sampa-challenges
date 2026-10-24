import type { Scenario } from '../harness';
import { catalogo } from './catalogo';

/** Grupos de cenários. Cada TF de regra acrescenta o seu aqui. */
export const GROUPS: Readonly<Record<string, Scenario[]>> = {
  catalogo,
};
