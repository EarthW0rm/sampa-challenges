import { screenDescriber } from '../../support/describe';
import { expect, makeTest } from '../../support/fixtures';
import { fugaDescriber } from './describe';
import { FugaPage } from './page';

export { expect };

export const test = makeTest((page, ev) => new FugaPage(page, ev), [screenDescriber('.fuga-rocam'), fugaDescriber]);
