import {
  BALL_REST_Y,
  GRAVITY,
  PLUNGER_CHARGE_TIME,
  PLUNGER_MIN,
  PLUNGER_MIN_CHARGE,
  PLUNGER_RANGE,
  SAVER_SECONDS,
} from '../../src/games/pinball-paulista/game/constants';
import { expect, test } from './support/test';

const FRAME = 1 / 60;
/** Velocidade vertical 1 quadro depois de soltar (a gravidade já agiu 1 quadro). */
const vyAfter = (frames: number) => -(PLUNGER_MIN + PLUNGER_RANGE * Math.min(1, (frames * FRAME) / PLUNGER_CHARGE_TIME)) + GRAVITY * FRAME;

test.describe('Pinball Paulista — lançador e portão', () => {
  test('PP-RN-06 a carga baixa a bola e a velocidade de saída é PLUNGER_MIN + PLUNGER_RANGE × carga', async ({ game }) => {
    await game.open();
    await game.keyDown('Space', 27);
    let s = await game.state();
    const charge = (27 * FRAME) / PLUNGER_CHARGE_TIME;
    expect(s.charge).toBeCloseTo(charge, 9);
    expect(s.balls[0].y).toBeCloseTo(BALL_REST_Y + charge * 9, 9);
    await game.keyUp('Space', 1);
    s = await game.state();
    expect(s.balls[0].vy).toBeCloseTo(vyAfter(27), 6);
    expect(s.phase).toBe('play');
    expect(s.launched).toBe(true);
  });

  test('PP-RN-06 carga cheia em PLUNGER_CHARGE_TIME: segurar mais não aumenta; ↓ também lança', async ({ game }) => {
    await game.open();
    await game.keyDown('ArrowDown', 90);
    expect((await game.state()).charge).toBe(1);
    await game.keyUp('ArrowDown', 1);
    const s = await game.state();
    expect(s.balls[0].vy).toBeCloseTo(vyAfter(90), 6);
    expect(s.balls[0].vy).toBeCloseTo(-(PLUNGER_MIN + PLUNGER_RANGE) + GRAVITY * FRAME, 6);
    await game.advanceUntil((h) => h.state().balls[0].x < 210, 3);
  });

  test('PP-RN-06 toque de até PLUNGER_MIN_CHARGE não lança; fraco cai de volta e assenta; forte entra na mesa e liga o segura-bola', async ({ game }) => {
    await game.open();
    // 3 quadros = carga 0,056 ≤ PLUNGER_MIN_CHARGE: a bola volta ao lugar
    expect((3 * FRAME) / PLUNGER_CHARGE_TIME).toBeLessThanOrEqual(PLUNGER_MIN_CHARGE);
    await game.launch(3 * FRAME);
    let s = await game.state();
    expect(s.balls[0].rest).toBe(true);
    expect(s.balls[0].y).toBe(BALL_REST_Y);
    expect(s.phase).toBe('ready');
    // 0,1 s: sobe a rampa, não passa do portão e assenta de novo
    await game.launch(0.1);
    s = await game.state();
    expect(s.balls[0].rest).toBe(false);
    expect(s.phase).toBe('play');
    await game.advanceUntil((h) => h.state().balls[0].rest, 8);
    s = await game.state();
    expect(s.balls[0].x).toBeGreaterThan(214);
    // segura-bola parado enquanto a bola descansa na rampa
    const saver = s.saver;
    // ligado no 1º lançamento; correu só enquanto a bola estava fora da rampa
    expect(saver).toBeGreaterThan(0);
    expect(saver).toBeLessThan(SAVER_SECONDS);
    await game.ev.quiet(() => game.frames(60));
    expect((await game.state()).saver).toBe(saver);
    // forte: botão Lançar segurado 1 s
    await game.touchLaunch(1);
    await game.advanceUntil((h) => h.state().balls[0].x < 210, 3);
    s = await game.state();
    expect(s.ball).toBe(1);
  });

  test('PP-RN-04 portão de mão única: a bola da mesa rebate na saída da rampa', async ({ game }) => {
    await game.open();
    await game.launchIntoPlay();
    const t = await game.targets();
    // pré-condição: bola da mesa indo direto para o portão
    await game.placeBall(t.gate.x - 12, (t.gate.y1 + t.gate.y2) / 2, 300, 0);
    await game.ev.quiet(() => game.frames(20));
    const s = await game.state();
    expect(s.balls[0].x, 'não entrou na rampa').toBeLessThan(t.gate.x);
    expect(s.balls[0].vx).toBeLessThan(0);
  });
});
