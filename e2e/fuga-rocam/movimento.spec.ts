import { FAST_LANE_MULT, PLAYER_SPEED, START_LIVES, TILE, TURN_TOLERANCE } from '../../src/games/fuga-rocam/game/constants';
import { canEnter, MAPS, mapById } from '../../src/games/fuga-rocam/game/maps';
import { expect, test } from './support/test';

const cx = (t: number) => t * TILE + TILE / 2;

test.describe('Fuga da Rocam — mapas e movimento', () => {
  test('FR-RN-02 os 3 mapas: grade, tiles, garagens e partida iguais aos dados do jogo', async ({ game, page }) => {
    await game.open();
    for (const m of MAPS) {
      await game.chooseMap(m.id);
      const tiles = await game.hook((h) => h.tiles());
      expect(tiles, `tiles de ${m.id}`).toEqual(m.tiles.map((r) => r.join('')));
      const garages = (await game.targets()).garages;
      expect(garages.length, `garagens de ${m.id}`).toBe(m.tiles.flat().filter((t) => t === 'g').length);
      for (const g of garages) {
        // ponta sem saída: exatamente uma rua colada
        const roads = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => canEnter(m, 'car', g.tx + dx, g.ty + dy)).length;
        expect(roads, `garagem (${g.tx}, ${g.ty})`).toBe(1);
        expect(canEnter(m, 'player', g.tx, g.ty) && !canEnter(m, 'moto', g.tx, g.ty)).toBe(true);
      }
      const s = await game.state();
      expect([s.player.tx, s.player.ty]).toEqual([m.start.tx, m.start.ty]);
      await page.getByRole('button', { name: '← Mapas' }).click();
    }
  });

  test('FR-RN-03 começa PRONTO: nada anda, turbo e óleo não começam; a primeira seta começa', async ({ game }) => {
    await game.start('centro');
    const s0 = await game.state();
    expect(s0).toMatchObject({ phase: 'ready', lives: START_LIVES, stars: 1, heat: 0, turbo: 1, oil: 1, shield: false, score: 0, deliveries: 0 });
    expect(s0.job?.stage).toBe('pickup');
    expect(s0.player.dir, 'virado para a primeira rua livre (direita)').toBe(0);
    await game.frames(180);
    await game.turbo(30);
    await game.oil();
    const s1 = await game.state();
    expect(s1.phase).toBe('ready');
    expect(s1.player).toEqual(s0.player);
    expect(s1.oil).toBe(1);
    expect(s1.copList).toHaveLength(0);
    expect(s1.itemList).toHaveLength(0);
    await game.turn('ArrowLeft');
    expect((await game.state()).phase).toBe('play');
  });

  test('FR-RN-04 velocidade da moto e faixa rápida', async ({ game }) => {
    await game.start('centro');
    await game.turn('ArrowLeft');
    const a = await game.state();
    await game.frames(60);
    const b = await game.state();
    expect(a.player.x - b.player.x, 'PLAYER_SPEED px em 1 s').toBeCloseTo(PLAYER_SPEED, 6);

    // Avenida Paulista: linha 11 é faixa rápida
    await game.page.getByRole('button', { name: '← Mapas' }).click();
    await game.chooseMap('paulista');
    expect(mapById('paulista').tiles[11][17]).toBe('f');
    await game.goToTile(17, 11);
    await game.turn('ArrowLeft', 0);
    const c = await game.state();
    await game.frames(30);
    const d = await game.state();
    expect(d.player.dir).toBe(2);
    expect(c.player.x - d.player.x, 'FAST_LANE_MULT × PLAYER_SPEED em 0,5 s').toBeCloseTo((FAST_LANE_MULT * PLAYER_SPEED) / 2, 4);
  });

  test('FR-RN-05 FR-RN-06 direção guardada até a esquina, parada na parede, meia-volta, curva antecipada e tardia', async ({ game }) => {
    await game.start('centro');
    // direção guardada: Baixo pedido no meio da quadra só vira na primeira esquina com saída para baixo
    const centro = mapById('centro');
    let corner = 18;
    while (!canEnter(centro, 'player', corner, 15)) corner++;
    let bottom = 15;
    while (canEnter(centro, 'player', corner, bottom + 1)) bottom++;
    await game.turn('ArrowRight');
    await game.frames(10);
    await game.turn('ArrowDown');
    await game.advanceUntil((h) => h.state().player.dir === 1, 5, undefined, 2);
    let s = await game.state();
    expect(s.player.tx, 'virou na primeira esquina com saída para baixo').toBe(corner);
    // segue até a parede e para
    await game.frames(300);
    s = await game.state();
    expect([s.player.tx, s.player.ty, s.player.off]).toEqual([corner, bottom, 0]);
    expect(s.phase).toBe('play');

    // meia-volta no meio do tile
    await game.turn('ArrowUp');
    await game.frames(5);
    const before = await game.state();
    expect(before.player.dir).toBe(3);
    await game.turn('ArrowDown');
    const after = await game.state();
    expect(after.player.dir, 'inverte na hora').toBe(1);
    expect(after.player.y).toBeGreaterThan(before.player.y);

    // curva antecipada: indo para a esquerda na linha 14, faltando ≤ TURN_TOLERANCE px para o centro da coluna 12
    await game.goToTile(17, 14);
    await game.turn('ArrowLeft', 0);
    await game.advanceUntil((h, tol) => {
      const p = h.state().player;
      return p.dir === 2 && p.tx === 13 && 16 - p.off <= tol;
    }, 10, TURN_TOLERANCE, 1);
    await game.turn('ArrowDown');
    s = await game.state();
    expect([s.player.tx, s.player.dir, s.player.x]).toEqual([12, 1, cx(12)]);

    // curva tardia: passou do centro da coluna 7 por até TURN_TOLERANCE px e a lateral está livre
    await game.goToTile(12, 14);
    await game.turn('ArrowLeft', 0);
    await game.advanceUntil((h, tol) => {
      const p = h.state().player;
      return p.dir === 2 && p.tx === 7 && p.off > 0 && p.off <= tol;
    }, 10, TURN_TOLERANCE, 1);
    await game.turn('ArrowDown');
    s = await game.state();
    expect([s.player.tx, s.player.dir, s.player.x]).toEqual([7, 1, cx(7)]);

    // fora da folga não vira ali: segue até a próxima esquina com saída
    await game.goToTile(12, 14);
    await game.turn('ArrowLeft', 0);
    await game.advanceUntil((h, tol) => {
      const p = h.state().player;
      return p.dir === 2 && p.tx === 11 && p.off > tol + 2;
    }, 10, TURN_TOLERANCE, 1);
    await game.turn('ArrowUp');
    s = await game.state();
    expect(s.player.dir, 'longe da esquina: guarda a direção').toBe(2);
    await game.advanceUntil((h) => h.state().player.dir === 3, 5, undefined, 2);
    expect((await game.state()).player.tx).toBe(7);
  });

  test('FR-RN-07 becos: o cachorro atravessa; carros nunca entram', async ({ game }) => {
    await game.start('centro');
    const map = mapById('centro');
    expect(map.tiles[16][10]).toBe('b');
    // pré-condição rara: um carro já na rua perto do beco, para a viatura andar por ali
    await game.hook((h) => h.prepare.cop('car', 7, 18, 3));
    const s = await game.goToTile(10, 16);
    expect([s.player.tx, s.player.ty]).toEqual([10, 16]);
    for (let i = 0; i < 20; i++) {
      await game.frames(30);
      const cops = (await game.state()).copList;
      for (const c of cops) {
        const near = c.off >= TILE / 2 ? [c.tx + [1, 0, -1, 0][c.dir], c.ty + [0, 1, 0, -1][c.dir]] : [c.tx, c.ty];
        expect(canEnter(map, c.cls, near[0], near[1]), `${c.cls} em (${near.join(', ')})`).toBe(true);
      }
      if ((await game.state()).phase !== 'play') break;
    }
  });
});
