import { screenDescriber } from '../../support/describe';
import { expect, makeTest } from '../../support/fixtures';
import { pinballDescriber } from './describe';
import { PinballPage } from './page';

export { expect };

export const test = makeTest((page, ev) => new PinballPage(page, ev), [screenDescriber('.pinball-paulista'), pinballDescriber]);
