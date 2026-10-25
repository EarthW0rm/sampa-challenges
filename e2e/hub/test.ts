import { expect, makeTest } from '../support/fixtures';
import { HubPage, hubDescriber } from '../support/hub';

export { expect };
export { HUB_GAMES } from './games';

/** `game` é a página do hub (home, cards, barra de volta). */
export const test = makeTest((page, ev) => new HubPage(page, ev), [hubDescriber]);
