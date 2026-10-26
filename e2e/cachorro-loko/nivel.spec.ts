import { BELTS, BOMBS_FROM_SCORE, BOX_SIZE, MAX_LIVES } from '../../src/games/cachorro-loko/game/constants';
import type { CLEvent } from '../../src/games/cachorro-loko/game/e2eHook';
import { FPS } from '../support/game-page';
import { expect, test } from './support/test';

/** Curva do manual (CL-RN-23): fórmulas do `engine.ts`. */
const beltSpeed = (level: number) => Math.min(24 + (level - 1) * 4, 64);
const spawnEvery = (level: number) => Math.max(3.4 * Math.pow(0.9, level - 1), 1.1);
const POWERS = ['turbo', 'grau', 'ima', 'dobro', 'vida'];

test.describe('Cachorro Loko — nível e sorteio', () => {
  test('CL-RN-22 CL-RN-23 nível a cada 10 pontos; velocidade das esteiras e intervalo dos pedidos pela curva, com os limites', async ({ game, page }) => {
    await game.play();
    // pré-condições: chapeiro parado e placar 9 (falta 1 ponto para o nível 2)
    await game.chef(false);
    await game.setScore(9);
    let s = await game.state();
    expect(s).toMatchObject({ level: 1, beltSpeed: beltSpeed(1) });
    expect(s.spawnEvery).toBeCloseTo(spawnEvery(1), 9);
    await game.settle(await game.dropOnDog('normal'));
    s = await game.state();
    expect(s).toMatchObject({ score: 10, level: 2, beltSpeed: beltSpeed(2) });
    expect(s.spawnEvery).toBeCloseTo(spawnEvery(2), 9);
    await expect(page.locator('.cachorro-loko .level')).toHaveText('Nível 2');

    // velocidade medida: pacote na esteira 2 (←) anda beltSpeed px/s
    const id = await game.hook((h, a) => h.prepare.spawn('normal', { state: 'belt', belt: 1, x: 200, y: a }), BELTS[1].y - BOX_SIZE);
    await game.frames(FPS / 2);
    const b = (await game.state()).boxes.find((x) => x.id === id)!;
    expect(b.x - 200).toBeCloseTo(-beltSpeed(2) / 2, 6);

    // pré-condição: placares altos para ver os limites (nível 11: esteira no teto; nível 12: intervalo no piso)
    for (const [score, level] of [[49, 5], [100, 11], [110, 12], [300, 31]] as const) {
      await game.setScore(score);
      s = await game.state();
      expect(s.level).toBe(level);
      expect(s.beltSpeed).toBe(beltSpeed(level));
      expect(s.spawnEvery).toBeCloseTo(spawnEvery(level), 9);
    }
    expect(beltSpeed(11)).toBe(64);
    expect(spawnEvery(12)).toBe(1.1);

    // intervalo real no nível 31: 1,1 s ±15%
    // pré-condição: vidas de sobra para os pacotes caírem sem acabar o turno
    await game.setLives(99);
    const t0 = (await game.state()).time;
    await game.chef(true);
    await game.advanceUntil((h, t) => h.events().filter((e) => e.ev === 'spawn' && e.t >= t).length >= 6, 20, t0);
    const spawns = (await game.events()).filter((e) => e.ev === 'spawn' && e.t >= t0);
    for (let i = 1; i < spawns.length; i++) {
      const gap = spawns[i].t - spawns[i - 1].t;
      expect(gap).toBeGreaterThanOrEqual(0.85 * 1.1 - 1 / FPS);
      expect(gap).toBeLessThanOrEqual(1.15 * 1.1 + 1 / FPS);
    }
  });

  test('CL-RN-14 CL-RN-15 bombas só a partir de BOMBS_FROM_SCORE; especial depois de 5 comuns e garantido no 11º; vida só se faltar coração', async ({ game }) => {
    await game.play({ seed: 5 });
    // pré-condições: placar logo abaixo de BOMBS_FROM_SCORE e vidas de sobra (ninguém pega os pacotes)
    await game.setScore(BOMBS_FROM_SCORE - 1);
    await game.setLives(99);
    await game.advanceUntil((h) => h.events().filter((e) => e.ev === 'spawn').length >= 15, 80, undefined, 60);
    const before = (await game.events()).filter((e) => e.ev === 'spawn');
    expect(before.filter((e) => e.kind === 'bomba'), `sem bomba abaixo de ${BOMBS_FROM_SCORE} pontos`).toEqual([]);

    // pré-condição: placar 100 (nível 11, chance de bomba no teto de 18%)
    await game.setScore(100);
    await game.advanceUntil((h) => h.events().filter((e) => e.ev === 'spawn').length >= 75, 90, undefined, 60);
    const all: CLEvent[] = (await game.events()).filter((e) => e.ev === 'spawn');
    const after = all.slice(before.length);
    const bombs = after.filter((e) => e.kind === 'bomba').length;
    expect(bombs, 'bombas a partir de BOMBS_FROM_SCORE').toBeGreaterThan(0);
    expect(bombs / after.length).toBeLessThan(0.4);

    // especiais: contando só os pedidos não-bomba, cada especial sai entre o 5º e o 11º
    let count = 0;
    let specials = 0;
    for (const e of all) {
      if (e.kind === 'bomba') continue;
      count++;
      if (e.kind !== 'normal') {
        expect(POWERS).toContain(e.kind);
        expect(count, `especial ${e.kind} no pedido ${count} desde o último`).toBeGreaterThanOrEqual(5);
        expect(count).toBeLessThanOrEqual(11);
        specials++;
        count = 0;
      }
      expect(count, 'nunca 11 comuns seguidos').toBeLessThan(11);
    }
    expect(specials).toBeGreaterThanOrEqual(5);
    expect(all.some((e) => e.kind === 'vida'), `com ${MAX_LIVES}+ vidas a caixa de vida não sai`).toBe(false);
    await game.evidence(`${all.length} pedidos: ${bombs} bombas, ${specials} especiais`);
  });
});
