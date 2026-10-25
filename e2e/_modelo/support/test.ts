import { screenDescriber } from '../../support/describe';
import { expect, makeTest } from '../../support/fixtures';
import { gameDescriber } from './describe';
import { __COMPONENTE__Page } from './page';

export { expect };

export const test = makeTest((page, ev) => new __COMPONENTE__Page(page, ev), [screenDescriber('.__ID__'), gameDescriber]);
