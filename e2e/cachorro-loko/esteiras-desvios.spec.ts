import { BELTS, BOX_SIZE, GRAVITY, SPAWN_POS } from '../../src/games/cachorro-loko/game/constants';
import type { CLBox, CLState } from '../../src/games/cachorro-loko/game/e2eHook';
import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

/** Aviso de troca do desvio (FLASH_TIME, topo do motor). */
const FLASH_TIME = 0.5;
const DT = 1 / FPS;

test.describe('Cachorro Loko — pedidos, esteiras e desvios', () => {
  test('CL-RN-05 primeiro pedido em 1 s; boca ocupada adia em passos de 0,25 s; intervalo do nível ±15%', async ({ game }) => {
    await game.play();
    // pré-condição: um pacote parado na boca da esteira 1 (x = 150), que só libera a boca (x ≥ SPAWN_POS.x + 18) em 1,67 s
    const blocker = await game.hook((h, a) => h.prepare.spawn('normal', { state: 'belt', belt: 0, x: a.x, y: a.y }), { x: 150, y: BELTS[0].y - BOX_SIZE });
    await game.advanceUntil((h) => h.events().filter((e) => e.ev === 'spawn').length >= 3, 12);
    const spawns = (await game.events()).filter((e) => e.ev === 'spawn' && e.id !== blocker);
    const s = await game.state();
    // tentativas em 1,0 / 1,25 / 1,5 (boca ocupada) e saída em 1,75 s
    expect(spawns[0].t).toBeCloseTo(1.75, 1);
    expect(spawns[0].x).toBe(SPAWN_POS.x);
    const gap = spawns[1].t - spawns[0].t;
    expect(gap).toBeGreaterThanOrEqual(0.85 * s.spawnEvery - DT);
    expect(gap).toBeLessThanOrEqual(1.15 * s.spawnEvery + DT);
    await game.evidence('Dois pedidos saíram');
  });

  test('CL-RN-06 CL-RN-07 CL-RN-08 CL-RN-09 esteiras no sentido e na velocidade; desvio troca a cada pacote (bomba conta) com aviso de 0,5 s; arremesso para a rua', async ({ game }) => {
    await game.play({ seed: 3 });
    // pré-condições: vidas de sobra (ninguém pega os pacotes) e placar 80 (nível 9: esteiras e pedidos mais rápidos)
    await game.setLives(99);
    await game.setScore(80);
    const initial = (await game.state()).desvios.map((d) => d.state);
    // pré-condição: uma bomba na boca, para provar que ela também troca o desvio
    const bomb = await game.hook((h) => h.prepare.spawn('bomba'));

    let prev: CLState | null = null;
    let beltChecks = 0;
    let flashChecks = 0;
    let streetChecks = 0;
    let seen = 0;
    for (let i = 0; i < 360; i++) {
      await game.frames(6);
      const s = await game.state();
      const evs = await game.events(seen);
      seen += evs.length;
      for (const e of evs) {
        if (e.ev !== 'desce' && e.ev !== 'rua') continue;
        if (e.belt < 3 && s.time - e.t < FLASH_TIME - DT) {
          expect(s.desvios[e.belt].flash, `aviso do desvio ${e.belt + 1}`).toBeCloseTo(FLASH_TIME - (s.time - e.t), 6);
          flashChecks++;
        }
      }
      for (const d of s.desvios) expect(d.flash).toBeLessThanOrEqual(FLASH_TIME);
      if (prev) {
        for (const b of s.boxes) {
          const a = prev.boxes.find((p: CLBox) => p.id === b.id);
          if (!a) continue;
          if (a.state === 'belt' && b.state === 'belt' && a.belt === b.belt) {
            expect(b.x - a.x, `pacote ${b.id} na esteira ${b.belt + 1}`).toBeCloseTo(BELTS[b.belt].dir * s.beltSpeed * 6 * DT, 6);
            beltChecks++;
          }
          if (a.state === 'street' && b.state === 'street') {
            const dir = BELTS[b.belt].dir;
            expect(b.vx * dir).toBeGreaterThanOrEqual(18);
            expect(b.vx * dir).toBeLessThanOrEqual(28);
            expect(b.vx).toBe(a.vx);
            expect(b.vy - a.vy).toBeCloseTo(GRAVITY * 6 * DT, 6);
            streetChecks++;
          }
        }
      }
      prev = s;
    }
    const evs = await game.events();
    for (let belt = 0; belt < BELTS.length; belt++) {
      const pass = evs.filter((e) => (e.ev === 'desce' || e.ev === 'rua') && e.belt === belt);
      expect(pass.length, `pacotes que passaram pelo fim da esteira ${belt + 1}`).toBeGreaterThanOrEqual(belt === BELTS.length - 1 ? 2 : 3);
      if (belt === BELTS.length - 1) {
        expect(pass.every((e) => e.ev === 'rua'), 'a última esteira sempre joga na rua').toBe(true);
        continue;
      }
      pass.forEach((e, k) => {
        const expected = k % 2 === 0 ? initial[belt] : initial[belt] === 'desce' ? 'rua' : 'desce';
        expect(e.ev, `passagem ${k + 1} do desvio ${belt + 1}`).toBe(expected);
      });
    }
    expect(evs.some((e) => e.id === bomb && e.belt === 0 && (e.ev === 'desce' || e.ev === 'rua')), 'a bomba passou pelo desvio 1').toBe(true);
    // street: o primeiro quadro na rua sai com vy = −30 (o resto é gravidade)
    const rua = evs.find((e) => e.ev === 'rua')!;
    expect(rua.y + BOX_SIZE).toBe(BELTS[rua.belt].y);
    expect(beltChecks).toBeGreaterThan(50);
    expect(flashChecks).toBeGreaterThan(5);
    expect(streetChecks).toBeGreaterThan(20);
    await game.evidence('Desvios conferidos');
  });

  test('CL-RN-09 pacote jogado na rua sai com vy = −30 px/s', async ({ game }) => {
    await game.play();
    // pré-condição: chapeiro parado e um pacote na ponta da esteira 4 (sempre rua), a 1 quadro do fim
    await game.chef(false);
    const b4 = BELTS[3];
    const id = await game.hook((h, a) => h.prepare.spawn('normal', { state: 'belt', belt: 3, x: a.x, y: a.y }), { x: b4.x0 - BOX_SIZE / 2 + 0.1, y: b4.y - BOX_SIZE });
    await game.frames(1);
    const b = (await game.state()).boxes.find((x) => x.id === id)!;
    expect(b.state).toBe('street');
    expect(b.vy).toBe(-30);
  });
});
