import { CRASH_TIME, INVULNERABLE_TIME, LANES, LEVEL_TIME } from '../../src/games/corredor-sp/game/constants';
import { MODELS, TRACKS, VEHICLE_SPEED, type VehicleKind } from '../../src/games/corredor-sp/game/data';
import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

const entregadora = MODELS.find((m) => m.id === 'entregadora')!;

test.describe('Corredor SP — trânsito e perigos', () => {
  test('CS-RN-22 buraco derruba acima de 55% da velocidade máxima; abaixo freia 40% e balança', async ({ game, page }) => {
    // pré-condição: pista vazia; o teste põe os buracos na linha da moto
    await game.race({ track: 'radial-leste' }, { calm: true });
    let s = await game.drive({ frames: 600, x: LANES[1] });
    expect(s.player.kmh).toBeGreaterThan(entregadora.vmax * 0.55);
    await game.prepare((h) => h.prepare.thing('buraco', h.state().player.x, 3000));
    s = await game.drive({ frames: 120, x: LANES[1], until: (st) => st.player.crashT > 0 });
    expect(s.player.lives, 'rápido: derruba').toBe(2);
    await game.frames(Math.round((CRASH_TIME + INVULNERABLE_TIME) * FPS) + 5);
    s = await game.drive({ frames: 600, x: LANES[1], until: (st) => st.player.kmh >= entregadora.vmax * 0.45 });
    await game.prepare((h) => h.prepare.thing('buraco', h.state().player.x, 1500));
    // solta o acelerador: a moto chega ao buraco abaixo de 55%
    let prev = s;
    await game.steerTo(LANES[1], { tol: 0.05 });
    for (let i = 0; i < 180; i++) {
      await game.frames(1);
      const cur = await game.state();
      if (cur.player.wobble > 0) {
        expect(prev.player.kmh).toBeLessThan(entregadora.vmax * 0.55);
        expect(cur.player.kmh, 'perde 40%').toBeCloseTo(prev.player.kmh * 0.6, 0);
        expect(cur.popups).toContain('BURACO!');
        break;
      }
      prev = cur;
    }
    s = await game.state();
    expect(s.player.wobble, 'passou pelo buraco').toBeGreaterThan(0);
    expect(s.player.lives, 'devagar: não derruba').toBe(2);
    await game.evidence('Depois do buraco em baixa velocidade');
    void page;
  });

  test('CS-RN-23 cone tira 30% da velocidade sem derrubar; cones vêm em grupos de 3', async ({ game, page }) => {
    // pré-condição: pista vazia; o teste põe um cone na linha da moto
    await game.race({ track: 'radial-leste' }, { calm: true });
    await game.drive({ frames: 600, x: LANES[2] });
    await game.prepare((h) => h.prepare.thing('cone', h.state().player.x, 2500));
    await page.keyboard.down('ArrowUp');
    let prev = await game.state();
    let hit = false;
    for (let i = 0; i < 120 && !hit; i++) {
      await game.frames(1);
      const cur = await game.state();
      if (cur.hazards[0]?.hit) {
        expect(cur.player.kmh, 'perde 30%').toBeCloseTo(prev.player.kmh * 0.7, 0);
        hit = true;
      }
      prev = cur;
    }
    await page.keyboard.up('ArrowUp');
    expect(hit).toBe(true);
    expect((await game.state()).player.lives).toBe(3);
    // grupos naturais: o 1º sai aos 10 s de turno
    await game.prepare((h) => h.prepare.calm(false));
    await game.steerTo(1.2);
    await game.advanceUntil((h) => h.state().hazards.filter((c) => c.kind === 'cone').length > 0, 12);
    const cones = (await game.state()).hazards.filter((c) => c.kind === 'cone');
    expect(cones).toHaveLength(3);
    const lane = cones[1].x;
    expect(LANES.some((l) => Math.abs(l - lane) < 1e-9), 'no centro de uma faixa').toBe(true);
    expect(cones[1].dz - cones[0].dz).toBeCloseTo(250, 0);
    expect(cones[2].dz - cones[1].dz).toBeCloseTo(250, 0);
  });

  test('CS-RN-24 contramão e ambulância só do nível 2: 30 s e 50 s depois de atingi-lo', async ({ game }) => {
    await game.race({ track: '23-de-maio' });
    await game.steerTo(1.2); // parada na terra, longe do trânsito
    await game.frames(40 * FPS);
    let s = await game.state();
    expect(s.level).toBe(1);
    expect(s.spawned.contramao ?? 0, 'nível 1 sem contramão').toBe(0);
    expect(s.vehicles.some((v) => v.kind === 'ambulancia'), 'nível 1 sem ambulância').toBe(false);
    await game.prepare((h) => h.prepare.level(2)); // pré-condição: início do nível 2
    await game.frames(2);
    expect((await game.state()).level).toBe(2);
    await game.advanceUntil((h) => (h.state().spawned.contramao ?? 0) > 0, 31, undefined, 3);
    s = await game.state();
    expect(s.time - LEVEL_TIME).toBeGreaterThan(29.9);
    const c = s.vehicles.find((v) => v.kind === 'contramao')!;
    expect(c.kmh, 'vem de frente').toBeLessThan(0);
    expect(c.dz).toBeCloseTo(22000, -3);
    await game.advanceUntil((h) => h.state().vehicles.some((v) => v.kind === 'ambulancia'), 21, undefined, 3);
    s = await game.state();
    expect(s.time - LEVEL_TIME).toBeGreaterThan(49.9);
    const a = s.vehicles.find((v) => v.kind === 'ambulancia')!;
    expect(a.dz).toBeLessThan(-5000);
    expect(a.kmh).toBeGreaterThanOrEqual(VEHICLE_SPEED.ambulancia[0]);
  });

  test('CS-RN-20 ônibus só na faixa da direita, caminhão nas duas da direita, seta antes de trocar; ambulância abre passagem', async ({ game }) => {
    await game.race({ track: 'radial-leste' });
    await game.steerTo(1.2); // parada na terra, longe do trânsito
    await game.prepare((h) => h.prepare.time(300)); // pré-condição: trânsito cheio
    let sawSignal = false;
    for (let i = 0; i < 20; i++) {
      await game.frames(30);
      const s = await game.state();
      for (const v of s.vehicles) {
        if (v.kind === 'onibus') expect(v.lane, 'ônibus na faixa da direita').toBe(3);
        if (v.kind === 'caminhao') expect(v.lane, 'caminhão nas duas da direita').toBeGreaterThanOrEqual(2);
        if (v.state === 'signal') {
          expect(v.blink, 'seta ligada antes de trocar').not.toBe(0);
          sawSignal = true;
        }
      }
    }
    expect(sawSignal).toBe(true);
    // pré-condição: pista vazia com ambulância e um carro à frente dela na mesma faixa
    await game.prepare((h) => {
      h.prepare.calm(true);
      h.prepare.spawn('ambulancia', { lane: 1 }, -2900, 155);
      h.prepare.spawn('carro', { lane: 1 }, -1000, 60);
    });
    await game.frames(2);
    const car = (await game.state()).vehicles.find((v) => v.kind === 'carro')!;
    expect(['signal', 'moving']).toContain(car.state);
    expect(car.lane).toBe(1);
  });

  test('CS-RN-21 o sorteio do trânsito segue os pesos da pista', async ({ game, page }) => {
    const heavy = (spawned: Partial<Record<VehicleKind, number>>) => {
      const total = Object.values(spawned).reduce((a, b) => a + (b ?? 0), 0);
      return ((spawned.onibus ?? 0) + (spawned.caminhao ?? 0)) / total;
    };
    const ratios: Record<string, number> = {};
    for (const track of ['23-de-maio', 'radial-leste'] as const) {
      if (track === '23-de-maio') await game.race({ track });
      else {
        await page.getByRole('button', { name: '← Trocar moto ou pista' }).click();
        await game.choose({ track });
        await game.start();
        await game.frames(185);
      }
      await game.steerTo(1.2);
      await game.prepare((h) => h.prepare.time(360)); // pré-condição: densidade no teto
      await game.frames(20 * FPS);
      ratios[track] = heavy((await game.state()).spawned);
    }
    const w = (id: string) => {
      const t = TRACKS.find((k) => k.id === id)!.traffic;
      return ((t.onibus ?? 0) + (t.caminhao ?? 0)) / Object.values(t).reduce((a, b) => a + (b ?? 0), 0);
    };
    expect(w('radial-leste')).toBeGreaterThan(w('23-de-maio'));
    expect(ratios['radial-leste'], `proporção de ônibus+caminhões: ${JSON.stringify(ratios)}`).toBeGreaterThan(ratios['23-de-maio']);
  });
});
