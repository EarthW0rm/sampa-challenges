import { screenDescriber } from '../../support/describe';
import { expect, makeTest } from '../../support/fixtures';
import { corredorDescriber } from './describe';
import { CorredorPage } from './page';

export { expect };

export const test = makeTest((page, ev) => new CorredorPage(page, ev), [screenDescriber('.corredor-sp'), corredorDescriber]);
