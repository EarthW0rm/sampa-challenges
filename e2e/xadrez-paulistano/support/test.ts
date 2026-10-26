import { screenDescriber } from '../../support/describe';
import { expect, makeTest } from '../../support/fixtures';
import { xadrezDescriber } from './describe';
import { XadrezPage } from './page';

export { expect };

export { XadrezPage };

export const test = makeTest((page, ev) => new XadrezPage(page, ev), [screenDescriber('.xadrez-paulistano'), xadrezDescriber]);
