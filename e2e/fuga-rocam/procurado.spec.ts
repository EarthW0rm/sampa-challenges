import { GARAGE_COOLDOWN, HEAT_COOL, HEAT_COOL_HIDDEN, HEAT_PER_STAR, HEAT_SEEN, HIDE_MAX, SIGHT_TILES } from '../../src/games/fuga-rocam/game/constants';
import { mapById } from '../../src/games/fuga-rocam/game/maps';
import { Nav } from '../../src/games/fuga-rocam/game/nav';
import { expect, test } from './support/test';

const stars = (heat: number) => 1 + Math.min(4, Math.floor(heat / HEAT_PER_STAR));
/** Viaturas por estrela e ordem das personas (topo do engine.ts). */
const QUOTA: Record<number, { car: number; moto: number; heli: number }> = {
  1: { car: 1, moto: 0, heli: 0 },
  2: { car: 1, moto: 1, heli: 0 },
  3: { car: 2, moto: 1, heli: 0 },
  4: { car: 2, moto: 2, heli: 0 },
  5: { car: 3, moto: 2, heli: 1 },
};

test.describe('Fuga da Rocam — procurado', () => {
  test('FR-RN-17 FR-RN-18 calor sobe à vista e cai fora dela; estrelas pela faixa de calor', async ({ game, page }) => {
    await game.start('centro');
    // pré-condição rara: calor de 2 estrelas antes de sair
    await game.hook((h) => h.prepare.heat(30));
    await game.turn('ArrowLeft');
    await game.frames(1);
    let s = await game.state();
    expect(s.stars).toBe(stars(s.heat));
    expect(s.stars).toBe(2);
    expect(s.message).toBe(`Procurado: ${stars(30)} estrelas!`);
    await expect(page.locator('.fuga-rocam .stars')).toHaveAttribute('aria-label', `Procurado: ${stars(30)} estrelas`);
    // fora de vista: cai HEAT_COOL por segundo
    const h0 = s.heat;
    await game.frames(30);
    s = await game.state();
    expect(s.copList.every((c) => !c.sees)).toBe(true);
    expect(h0 - s.heat).toBeCloseTo(HEAT_COOL / 2, 6);

    // pré-condição rara: carro atrás da moto, na mesma rua (a até SIGHT_TILES de caminho)
    await game.hook((h, x) => h.prepare.cop('car', x + 4, 14, 2), s.player.tx);
    await game.frames(1);
    s = await game.state();
    const seer = s.copList.at(-1)!;
    expect(seer.d).toBeLessThanOrEqual(SIGHT_TILES);
    expect(seer.sees).toBe(true);
    expect(s.lastSeen?.t).toBeCloseTo(s.time, 6);
    const h1 = s.heat;
    await game.frames(30);
    s = await game.state();
    expect(s.heat - h1, 'visto: sobe HEAT_SEEN por segundo').toBeCloseTo(HEAT_SEEN / 2, 6);
    // a visão vale pela distância de caminho
    for (const c of s.copList) expect(c.sees, `viatura a ${c.d} tiles`).toBe(c.d >= 0 && c.d <= SIGHT_TILES && c.alpha > 0.5 && !c.leaving);
    // as faixas de estrelas
    for (const v of [0, HEAT_PER_STAR - 0.5, HEAT_PER_STAR * 3, 100]) {
      await game.hook((h, x) => h.prepare.heat(x), v);
      await game.frames(1);
      s = await game.state();
      expect(s.stars, `calor ${s.heat}`).toBe(stars(s.heat));
    }
  });

  test('FR-RN-19 FR-RN-20 FR-RN-21 viaturas por estrela, personas, helicóptero e saída do excedente', async ({ game }) => {
    test.setTimeout(150_000);
    await game.start('marginal', { seed: 21 });
    await game.turn('ArrowLeft');
    const corners: [number, number][] = [[2, 2], [37, 22], [37, 2], [2, 22]];
    let k = 0;
    let s = await game.state();
    let peak = { car: 0, moto: 0 };
    const personas = new Map<number, string>();
    // pré-condição rara: calor no máximo, renovado a cada 1 s (cai fora de vista)
    for (let i = 0; i < 40 && !(peak.car === QUOTA[5].car && peak.moto === QUOTA[5].moto && s.heliPos); i++) {
      await game.hook((h) => h.prepare.heat(100));
      if (s.phase === 'caught') s = await game.waitCaught();
      const t = corners[k % corners.length];
      s = await game.goToTile(t[0], t[1], { avoidCops: true, until: (x) => x.phase !== 'play' && x.phase !== 'ready' ? true : x.time > s.time + 1 });
      if (Math.hypot(s.player.x - (t[0] * 16 + 8), s.player.y - (t[1] * 16 + 8)) < 20) k++;
      const active = s.copList.filter((c) => !c.leaving);
      const q = QUOTA[s.stars];
      const car = active.filter((c) => c.cls === 'car').length;
      const moto = active.filter((c) => c.cls === 'moto').length;
      expect(car, `carros com ${s.stars} estrelas`).toBeLessThanOrEqual(q.car);
      expect(moto, `motos com ${s.stars} estrelas`).toBeLessThanOrEqual(q.moto);
      if (s.stars === 5) peak = { car: Math.max(peak.car, car), moto: Math.max(peak.moto, moto) };
      for (const c of s.copList) personas.set(c.id, `${c.cls}:${c.persona}`);
    }
    expect(peak).toEqual({ car: QUOTA[5].car, moto: QUOTA[5].moto });
    expect(s.heliPos, 'helicóptero com 5 estrelas').not.toBeNull();
    // personas na ordem de PERSONAS, sem repetir enquanto houver outra livre
    const seen = [...personas.values()];
    expect(seen.filter((p) => p.startsWith('car')).slice(0, 2)).toEqual(['car:chaser', 'car:blocker']);
    expect(seen.filter((p) => p.startsWith('moto')).slice(0, 2)).toEqual(['moto:fast', 'moto:ambush']);

    // calor zerado: o helicóptero vai embora e as viaturas a mais saem
    await game.hook((h) => h.prepare.heat(0));
    for (let i = 0; i < 30; i++) {
      if (s.phase === 'caught') s = await game.waitCaught();
      const t = corners[k++ % corners.length];
      s = await game.goToTile(t[0], t[1], { avoidCops: true, until: (x) => x.phase === 'caught' || x.time > s.time + 1 });
      if (!s.heliPos && s.copList.filter((c) => !c.leaving).length <= QUOTA[s.stars].car + QUOTA[s.stars].moto && s.copList.length <= 3) break;
    }
    expect(s.heliPos).toBeNull();
    expect(s.copList.filter((c) => !c.leaving).length).toBeLessThanOrEqual(QUOTA[s.stars].car + QUOTA[s.stars].moto);
  });

  test('FR-RN-22 garagem esconde até HIDE_MAX, esfria rápido e tranca ao sair', async ({ game, page }) => {
    await game.start('centro', { seed: 2 });
    const map = mapById('centro');
    const nav = new Nav(map);
    const st = map.start;
    const garages = (await game.targets()).garages;
    const g = garages.sort((a, b) => nav.dist('player', [st.tx, st.ty], [a.tx, a.ty]) - nav.dist('player', [st.tx, st.ty], [b.tx, b.ty]))[0];
    let s = await game.goToTile(g.tx, g.ty, { until: (x) => x.hidden });
    expect(s.hidden).toBe(true);
    expect(s.message).toBe('Escondido na garagem');
    await expect(page.getByRole('status')).toContainText('Escondido');
    // pré-condição rara: calor alto para ver o esfriamento
    await game.hook((h) => h.prepare.heat(60));
    await game.frames(30);
    s = await game.state();
    expect(60 - s.heat).toBeCloseTo(HEAT_COOL_HIDDEN / 2, 6);
    // sai sozinho depois de HIDE_MAX
    await game.advanceUntil((h) => !h.state().hidden, HIDE_MAX + 1, undefined, 3);
    s = await game.state();
    expect(s.hideT).toBe(0);
    expect(s.garageCd).toBeGreaterThan(GARAGE_COOLDOWN - 0.2);
    // trancada: a moto não entra de novo enquanto conta o GARAGE_COOLDOWN
    const back = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'][s.player.dir] as 'ArrowLeft';
    await game.turn(back);
    await game.frames(60);
    s = await game.state();
    expect(s.hidden).toBe(false);
    expect([s.player.tx, s.player.ty]).not.toEqual([g.tx, g.ty]);
    if (s.phase === 'play') {
      await game.advanceUntil((h) => h.state().garageCd === 0 || h.state().phase !== 'play', GARAGE_COOLDOWN, undefined, 6);
      s = await game.goToTile(g.tx, g.ty, { until: (x) => x.hidden || x.phase !== 'play' });
      if (s.phase === 'play') expect(s.hidden, 'destrancou: entra de novo').toBe(true);
    }
  });
});
