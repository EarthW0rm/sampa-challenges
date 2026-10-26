import { ITEM_FIRST, ITEM_INTERVAL, ITEM_LIFETIME, ITEM_MIN_DIST, MAX_ITEMS, MAX_LIVES, OIL_START, PIZZA_POINTS, START_LIVES, TURBO_ITEM } from '../../src/games/fuga-rocam/game/constants';
import { mapById } from '../../src/games/fuga-rocam/game/maps';
import { Nav } from '../../src/games/fuga-rocam/game/nav';
import { expect, test } from './support/test';

const centro = mapById('centro');
const nav = new Nav(centro);
const corners: [number, number][] = [[2, 2], [37, 22], [37, 2], [2, 22]];

test.describe('Fuga da Rocam — itens', () => {
  test('FR-RN-25 itens nascem no intervalo, longe do cachorro, até MAX_ITEMS, e somem com o tempo', async ({ game }) => {
    test.setTimeout(150_000);
    await game.start('centro', { seed: 11 });
    await game.turn('ArrowLeft');
    // o primeiro item nasce ITEM_FIRST s depois do começo
    await game.frames(Math.round(ITEM_FIRST * 60) - 2);
    expect((await game.state()).itemList).toHaveLength(0);
    // (o contador acumula 1/60 s por quadro: a soma em ponto flutuante pode passar um quadro do exato)
    await game.frames(4);
    let s = await game.state();
    expect(s.itemList).toHaveLength(1);
    const first = s.itemList[0];
    expect(first.life).toBeCloseTo(ITEM_LIFETIME, 1);
    expect('.f').toContain(centro.tiles[first.ty][first.tx]);
    expect(nav.dist('player', [s.player.tx, s.player.ty], [first.tx, first.ty])).toBeGreaterThanOrEqual(ITEM_MIN_DIST - 1);
    // foge pelo mapa (sem pegar itens) até o primeiro sumir; nunca mais que MAX_ITEMS
    let k = 0;
    let max = 0;
    let caught = false;
    const ages: number[][] = [];
    while (s.itemList.some((i) => i.tx === first.tx && i.ty === first.ty && i.kind === first.kind) && s.phase !== 'over') {
      if (s.phase === 'caught') {
        caught = true;
        s = await game.waitCaught();
      }
      const t = corners[k++ % corners.length];
      s = await game.goToTile(t[0], t[1], { avoidCops: true, avoidItems: true, until: (x) => x.phase === 'caught' || x.itemList.length !== s.itemList.length || x.time > s.time + 3 });
      max = Math.max(max, s.itemList.length);
      ages.push(s.itemList.map((i) => ITEM_LIFETIME - i.life));
    }
    expect(max).toBeLessThanOrEqual(MAX_ITEMS);
    expect(max, 'chegou ao teto').toBe(MAX_ITEMS);
    if (!caught) {
      // sem captura no caminho, os itens nascem a cada ITEM_INTERVAL s
      const full = ages.find((a) => a.length === MAX_ITEMS)!;
      expect(full[0] - full[1]).toBeCloseTo(ITEM_INTERVAL, 0);
    }
    const oldest = Math.max(...ages.at(-2)!);
    expect(oldest).toBeLessThanOrEqual(ITEM_LIFETIME);
    expect(oldest).toBeGreaterThan(ITEM_LIFETIME - 3.5);
  });

  test('FR-RN-26 efeito de cada item: turbo, óleo, pizza e vida (até MAX_LIVES)', async ({ game, page }) => {
    await game.start('centro');
    await game.turn('ArrowLeft');
    await game.turbo(30);
    const t0 = await game.state();
    expect(t0.turbo).toBeLessThan(1);
    // pré-condição rara: um item de cada tipo enfileirado no caminho da moto (linha 14, indo para a esquerda)
    await game.hook((h) => {
      h.prepare.item('turbo', 11, 14);
      h.prepare.item('oleo', 9, 14);
      h.prepare.item('pizza', 6, 14);
      h.prepare.item('vida', 4, 14);
    });
    await game.advanceUntil((h) => h.state().player.tx <= 10, 3, undefined, 1);
    let s = await game.state();
    expect(s.turbo).toBeCloseTo(Math.min(1, t0.turbo + TURBO_ITEM), 1);
    expect(s.turboLocked).toBe(false);
    await game.advanceUntil((h) => h.state().player.tx <= 8, 3, undefined, 1);
    s = await game.state();
    expect(s.oil).toBe(OIL_START + 1);
    await expect(page.locator('.fuga-rocam .chips')).toContainText('×2');
    await game.advanceUntil((h) => h.state().player.tx <= 5, 3, undefined, 1);
    s = await game.state();
    expect(s.score).toBe(PIZZA_POINTS);
    await game.advanceUntil((h) => h.state().player.tx <= 3, 3, undefined, 1);
    s = await game.state();
    expect(s.lives).toBe(START_LIVES + 1);
    // no teto, a vida não soma
    await game.hook((h, n) => {
      h.prepare.lives(n);
      h.prepare.item('vida', 2, 15);
    }, MAX_LIVES);
    s = await game.goToTile(2, 16);
    expect(s.itemList.some((i) => i.kind === 'vida')).toBe(false);
    expect(s.lives).toBe(MAX_LIVES);
    await expect(page.locator('.fuga-rocam .hearts img')).toHaveCount(MAX_LIVES);
  });
});
