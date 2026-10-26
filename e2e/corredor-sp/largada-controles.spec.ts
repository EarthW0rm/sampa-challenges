import { OFFROAD_LIMIT, OFFROAD_SPEED } from '../../src/games/corredor-sp/game/constants';
import { MODELS, type MotoModel } from '../../src/games/corredor-sp/game/data';
import { FPS } from '../support/game-page';
import { COUNTDOWN_FRAMES } from './support/page';
import { accelerateKmh, steerDx } from './support/physics';
import { expect, test } from './support/test';

const model = (id: string): MotoModel => MODELS.find((m) => m.id === id)!;

test.describe('Corredor SP — largada e controles', () => {
  test('CS-RN-04 contagem de 3 s com tudo parado e as teclas ignoradas; depois VAI!', async ({ game }) => {
    await game.open();
    await game.start();
    const before = await game.state();
    expect(before.phase).toBe('countdown');
    expect(before.countdown).toBeCloseTo(3, 1);
    await game.accelerate(2 * FPS);
    const mid = await game.state();
    expect(mid.phase).toBe('countdown');
    expect(mid.countdown).toBeCloseTo(1, 1);
    expect(mid.player.speed, 'acelerar na contagem não faz nada').toBe(0);
    expect(mid.time).toBe(0);
    expect(mid.vehicles.map((v) => v.dz), 'trânsito parado na contagem').toEqual(before.vehicles.map((v) => v.dz));
    await game.frames(FPS + 2);
    const go = await game.state();
    expect(go.phase).toBe('racing');
    expect(go.banner).toBe('VAI!');
    await game.frames(30);
    expect((await game.state()).time).toBeCloseTo(30 / FPS, 1);
  });

  test('CS-RN-03 CS-RN-05 aceleração, teto do modelo, freio e desaceleração solto; WASD equivale às setas', async ({ game, page }) => {
    const bufalo = model('bufalo');
    // pré-condição: pista vazia (só física da moto)
    await game.race({ track: 'radial-leste', category: '1000', modelId: 'bufalo' }, { calm: true });
    let s = await game.drive({ frames: 60, x: 0 });
    expect(s.player.kmh).toBeCloseTo(accelerateKmh(bufalo, 0, 60), 0);
    s = await game.drive({ frames: 540, x: 0 });
    expect(s.player.kmh, 'teto = vmax do modelo').toBeCloseTo(bufalo.vmax, 3);
    await game.brake(30);
    s = await game.state();
    expect(s.player.kmh, 'freio: −freio × 0,5 s').toBeCloseTo(bufalo.vmax - bufalo.brake * 0.5, 1);
    await game.frames(FPS);
    const coast = (await game.state()).player.kmh;
    expect(coast, 'solto: −0,35 × aceleração por s').toBeCloseTo(s.player.kmh - 0.35 * bufalo.accel, 1);
    // WASD
    await game.holdKey('w', 30);
    s = await game.state();
    expect(s.player.kmh).toBeGreaterThan(coast);
    await game.holdKey('s', 30);
    expect((await game.state()).player.kmh).toBeLessThan(s.player.kmh);
    const x0 = (await game.state()).player.x;
    await game.holdKey('d', 20);
    const x1 = (await game.state()).player.x;
    expect(x1).toBeGreaterThan(x0 + 0.05);
    await game.holdKey('a', 40);
    expect((await game.state()).player.x).toBeLessThan(x1 - 0.05);

    // outro modelo: teto da 150 mais lenta
    const pao = model('pao-de-queijo');
    await page.getByRole('button', { name: '← Trocar moto ou pista' }).click();
    await game.choose({ category: '150', modelId: 'pao-de-queijo' });
    await game.start();
    await game.prepare((h) => h.prepare.calm(true)); // pista vazia
    await game.frames(COUNTDOWN_FRAMES);
    s = await game.drive({ frames: 700, x: 0 });
    expect(s.model.id).toBe(pao.id);
    expect(s.player.kmh).toBeCloseTo(pao.vmax, 3);
  });

  test('CS-RN-06 direção com inércia, limite lateral e terra a 35% da velocidade máxima', async ({ game }) => {
    const m = model('corisco');
    // pré-condição: pista vazia
    await game.race({ track: 'radial-leste', category: '600', modelId: 'corisco' }, { calm: true });
    // parada, a moto vira com 35% da direção
    await game.steer('right', 30);
    let s = await game.state();
    expect(s.player.x).toBeCloseTo(steerDx(m.steer * 0.35, 0, 30), 2);
    await game.steerTo(0);
    s = await game.drive({ frames: 600, x: 0 });
    expect(s.player.kmh).toBeCloseTo(m.vmax, 1);
    const x0 = s.player.x;
    await game.steer('right', 30, true);
    s = await game.state();
    // curva da pista empurra um pouco: tolerância de 0,05
    expect(Math.abs(s.player.x - x0 - steerDx(m.steer, 0, 30))).toBeLessThan(0.05);
    await game.steer('right', 3 * FPS, true);
    s = await game.state();
    expect(s.player.x, 'limite lateral').toBeCloseTo(OFFROAD_LIMIT, 5);
    expect(s.player.kmh, 'na terra o teto cai').toBeCloseTo(m.vmax * OFFROAD_SPEED, 0);
    s = await game.drive({ frames: 120, x: 0.25 });
    s = await game.drive({ frames: 120, x: 0.25 });
    expect(s.player.kmh, 'de volta ao asfalto acelera de novo').toBeGreaterThan(m.vmax * OFFROAD_SPEED + 20);
  });
});
