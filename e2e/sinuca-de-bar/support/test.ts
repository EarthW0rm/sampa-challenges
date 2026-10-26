import { screenDescriber } from '../../support/describe';
import { expect, makeTest } from '../../support/fixtures';
import { sinucaDescriber } from './describe';
import { SinucaPage } from './page';

export { expect };

export const test = makeTest((page, ev) => new SinucaPage(page, ev), [screenDescriber('.sinuca-de-bar'), sinucaDescriber]);
