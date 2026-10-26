import { screenDescriber } from '../../support/describe';
import { expect, makeTest } from '../../support/fixtures';
import { capaceteDescriber } from './describe';
import { CapacetePage } from './page';

export { expect };

export const test = makeTest((page, ev) => new CapacetePage(page, ev), [screenDescriber('.capacete-voador'), capaceteDescriber]);
