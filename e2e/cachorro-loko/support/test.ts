import { screenDescriber } from '../../support/describe';
import { expect, makeTest } from '../../support/fixtures';
import { gameDescriber } from './describe';
import { CachorroLokoPage } from './page';

export { expect };

export const test = makeTest((page, ev) => new CachorroLokoPage(page, ev), [screenDescriber('.cachorro-loko'), gameDescriber]);
