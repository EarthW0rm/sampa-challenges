import { DT, H, MAX_FLIGHT_T, POS_SCALE, SUBSTEPS_PER_SECOND, SUN_RECT, W } from '../../src/games/capacete-voador/game/constants';
import { expectSteps, FPS } from '../support/game-page';
import { expect, test } from './support/test';

const windText = (w: number) => (w === 0 ? 'Vento sem vento' : `Vento ${w > 0 ? '→' : '←'} ${Math.abs(w)}`);

test.describe('Capacete Voador — voo', () => {
  test('CV-RN-11 CV-RN-12 trajetória pela fórmula com vento e gravidade, 2 passos por quadro; vento sorteado por rodada', async ({ game, page }) => {
    await game.play({ mode: 'practice', gravityChip: 'Marte' });
    // vento da rodada: inteiro de −14 a 14, sorteado de novo a cada partida (Reiniciar)
    const winds: number[] = [];
    for (let i = 0; i < 8; i++) {
      const w = (await game.state()).wind;
      winds.push(w);
      expect(Number.isInteger(w) && Math.abs(w) <= 14, `vento ${w}`).toBe(true);
      await expect(page.locator('.capacete-voador .scoreboard .wind')).toHaveText(windText(w));
      await game.restart();
    }
    expect(new Set(winds).size, 'o vento muda entre as rodadas').toBeGreaterThan(1);

    const s0 = await game.state();
    const wind = s0.wind;
    const g = s0.gravity;
    await game.aim(60, 80);
    await game.fire();
    const frames = 20;
    await game.frames(frames - 1);
    const s = await game.state();
    const f = s.flight!;
    expect(f, 'capacete ainda voando').not.toBeNull();
    expectSteps(f.step, Math.round((frames * SUBSTEPS_PER_SECOND) / FPS));
    const rad = (60 * Math.PI) / 180;
    expect(f.vx).toBeCloseTo(Math.cos(rad) * 80, 9);
    expect(f.vy).toBeCloseTo(Math.sin(rad) * 80, 9);
    const t = f.step * DT;
    expect(f.x).toBeCloseTo(f.x0 + POS_SCALE * (f.vx * t + 0.5 * (wind / 5) * t * t), 6);
    expect(f.y).toBeCloseTo(f.y0 - POS_SCALE * (f.vy * t - 0.5 * g * t * t), 6);
    await game.evidence(`Capacete no passo ${f.step}: posição pela fórmula (vento ${wind}, gravidade ${g})`);
    await game.waitShot();
  });

  test('CV-RN-12 a seta e o texto do vento acompanham o valor (sem vento, ← e →)', async ({ game, page }) => {
    await game.play({ mode: 'practice' });
    for (const w of [0, -3, 9]) {
      // pré-condição: vento conhecido (o sorteio é coberto no teste anterior)
      await game.hook((h, v) => h.prepare.wind(v), w);
      await game.frames(1);
      await expect(page.locator('.capacete-voador .scoreboard .wind')).toHaveText(windText(w));
      await game.evidence(`Vento ${w}`);
    }
  });

  test('CV-RN-13 ângulo acima de 90 lança para trás (J1 para a esquerda, J2 para a direita)', async ({ game }) => {
    await game.play({ mode: 'pvp' });
    for (const p of [0, 1] as const) {
      await game.waitAim(p);
      const shot = (await game.findShot({ kind: 'building', player: p, angles: [100, 170] })) ?? (await game.findShot({ kind: 'out', player: p, angles: [100, 170] }));
      expect(shot, 'tiro para trás que não acerta ninguém').not.toBeNull();
      await game.aim(shot!.angle, shot!.velocity, p);
      await game.fire('enter', p);
      await game.frames(5);
      const f = (await game.state()).flight!;
      if (p === 0) expect(f.x, 'J1 joga para a esquerda').toBeLessThan(f.x0);
      else expect(f.x, 'J2 joga para a direita').toBeGreaterThan(f.x0);
      await game.waitShot();
    }
  });

  test('CV-RN-14 sai pela lateral ou passa do tempo máximo: passa a vez sem explosão', async ({ game }) => {
    await game.play({ mode: 'pvp', gravityChip: 'Lua' });
    const side = await game.findShotOrRestart({ kind: 'out', side: 'lateral', player: 0 });
    await game.aim(side.angle, side.velocity, 0);
    await game.fire('enter', 0);
    await game.advanceUntil((h) => h.state().flight === null, 30);
    let s = await game.state();
    const o = s.outcomes.at(-1)!;
    expect(o.kind).toBe('out');
    expect(o.x < -10 || o.x > W + 10, `saiu pela lateral em x=${o.x}`).toBe(true);
    expect(s.phase, 'sem explosão').not.toBe('exploding');
    expect(s.explosion).toBeNull();
    expect(s.turn).toBe(1);
    expect(s.damage).toEqual([0, 0]);

    // pré-condição: sem vento, para o tiro reto para cima não sair pela lateral
    await game.hook((h) => h.prepare.wind(0));
    const up = await game.findShot({ kind: 'out', side: 'time', player: 1, angles: [88, 92], velocities: [190, 200] });
    expect(up, 'tiro que passa do tempo máximo na Lua').not.toBeNull();
    await game.aim(up!.angle, up!.velocity, 1);
    await game.fire('enter', 1);
    const maxFrames = Math.ceil(((MAX_FLIGHT_T / DT) * FPS) / SUBSTEPS_PER_SECOND);
    await game.frames(maxFrames - 10);
    expect((await game.state()).flight, `ainda voando antes de ${MAX_FLIGHT_T} unidades de tempo`).not.toBeNull();
    await game.frames(20);
    s = await game.state();
    expect(s.flight).toBeNull();
    const last = s.outcomes.at(-1)!;
    expect(last.kind).toBe('out');
    expect(last.y).toBeLessThan(H);
    expect(s.turn).toBe(0);
  });

  test('CV-RN-15 chão: depois que as crateras abrem caminho, o capacete cai abaixo do campo e passa a vez', async ({ game }) => {
    await game.play({ mode: 'practice' });
    // pré-condição rara: cidade com o MASP (o prédio mais baixo) e sem vento, para cavar até o chão em poucos tiros
    await game.hook((h) => {
      for (let seed = 1; seed < 200; seed++) {
        h.prepare.city(seed);
        if (h.state().buildings.some((b) => b.masp && b.x > 100 && b.x < 400)) return;
      }
    });
    await game.hook((h) => h.prepare.wind(0));
    const masp = (await game.state()).buildings.find((b) => b.masp)!;
    const shot = await game.findShot({ kind: 'building', player: 0, minX: masp.x + 8, maxX: masp.x + masp.width - 8, velocities: [20, 120] });
    expect(shot, 'tiro que cai no MASP').not.toBeNull();
    let floor = false;
    for (let i = 0; i < 20 && !floor; i++) {
      await game.waitAim(0);
      const s = await game.shoot(shot!.angle, shot!.velocity, 0);
      const o = s.outcomes.at(-1)!;
      floor = o.kind === 'out' && o.y >= H;
      if (!floor) expect(o.kind, `tiro ${i + 1} cava o prédio`).toBe('building');
    }
    expect(floor, 'o capacete chegou ao chão').toBe(true);
    const s = await game.state();
    expect(s.explosion).toBeNull();
    expect(s.practiceHits).toBe(0);
  });

  test('CV-RN-16 o sol se assusta, mas o capacete segue o voo', async ({ game }) => {
    await game.play({ mode: 'practice' });
    const shot = await game.findShotOrRestart({ kind: 'building', sun: true, player: 0 });
    await game.aim(shot.angle, shot.velocity);
    await game.fire();
    await game.advanceUntil((h) => !!h.state().flight?.touchedSun, 20, undefined, 1);
    let s = await game.state();
    expect(s.sunShocked).toBe(true);
    expect(s.flight, 'continua voando').not.toBeNull();
    await game.evidence('Capacete passou pelo sol: susto');
    s = await game.waitShot();
    const o = s.outcomes.at(-1)!;
    expect(o.touchedSun).toBe(true);
    expect(o.kind).toBe('building');
    const inSun = o.x >= SUN_RECT.x && o.x < SUN_RECT.x + SUN_RECT.w && o.y >= SUN_RECT.y && o.y < SUN_RECT.y + SUN_RECT.h;
    expect(inSun, 'não parou no sol').toBe(false);
    expect(s.sunShocked, 'o susto acaba com a vez').toBe(false);
  });
});
