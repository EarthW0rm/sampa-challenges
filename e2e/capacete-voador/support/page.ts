import { expect, type Locator, type Page } from '@playwright/test';
import type { CapaceteE2E } from '../../../src/games/capacete-voador/game/e2eHook';
import type { EngineE2EState, SimulatedShot } from '../../../src/games/capacete-voador/game/engine';
import { H, W } from '../../../src/games/capacete-voador/game/constants';
import type { Difficulty, GameMode, PlayerIndex } from '../../../src/games/capacete-voador/game/types';
import type { Evidence } from '../../support/evidence';
import { BaseGamePage, type BaseBootOptions } from '../../support/game-page';

export type CVState = EngineE2EState;
export type Sim = SimulatedShot;

export const MODE_TITLE: Record<GameMode, string> = { pvp: '2 jogadores', pvc: 'Contra o computador', practice: 'Treino' };
export const DIFFICULTY_TITLE: Record<Difficulty, string> = { facil: 'Fácil', medio: 'Médio', dificil: 'Difícil' };

export interface MenuOptions {
  mode?: GameMode;
  difficulty?: Difficulty;
  /** Nome do jogador 1 (e do 2 no modo 2 jogadores), digitados no campo. */
  names?: [string, string?];
  points?: number;
  /** Valor digitado no campo de gravidade. */
  gravity?: string;
  /** Atalho de gravidade (rótulo do botão: Terra, Lua, Marte, Júpiter). */
  gravityChip?: 'Terra' | 'Lua' | 'Marte' | 'Júpiter';
  rain?: boolean;
}

/** Critério de busca de tiro: evento do voo e, se for acerto, em quem. */
export interface ShotQuery {
  kind: SimulatedShot['kind'];
  index?: PlayerIndex | null;
  player?: PlayerIndex;
  /** Só tiros que passam pelo sol. */
  sun?: boolean;
  /** Para `out`: saída pelo chão (`y ≥ H`) ou pela lateral. */
  side?: 'floor' | 'lateral' | 'time';
  angles?: [number, number];
  velocities?: [number, number];
  /** Ponto final do voo dentro de uma faixa de x (ex.: um prédio). */
  minX?: number;
  maxX?: number;
}

/** Página do Capacete Voador: a base comum mais os gestos do menu e do formulário de mira. */
export class CapacetePage extends BaseGamePage<CapaceteE2E> {
  constructor(page: Page, ev: Evidence) {
    super(page, ev, {
      id: 'capacete-voador',
      logical: { w: W, h: H },
      hookName: '__e2e',
      soundOff: { 'capacete-voador:som': 'off' },
    });
  }

  /** Abre o jogo (menu). */
  async open(opts: BaseBootOptions = {}): Promise<void> {
    await this.boot({ seed: 1, ...opts });
    await expect(this.page.getByRole('heading', { name: 'CAPACETE VOADOR' })).toBeVisible();
  }

  get startButton(): Locator {
    return this.page.locator('.capacete-voador .menu-form button.start');
  }

  /** Escolhe as opções do menu pela tela (cada escolha é uma evidência). */
  async menu(o: MenuOptions = {}): Promise<void> {
    const p = this.page;
    if (o.mode) await p.locator('.capacete-voador .card', { hasText: MODE_TITLE[o.mode] }).click();
    if (o.difficulty) await p.locator('.capacete-voador .card', { hasText: DIFFICULTY_TITLE[o.difficulty] }).click();
    if (o.names?.[0] !== undefined) await p.getByLabel('Nome do jogador 1').fill(o.names[0]);
    if (o.names?.[1] !== undefined) await p.getByLabel('Nome do jogador 2').fill(o.names[1]);
    if (o.points !== undefined) await p.getByLabel('Pontos para vencer').selectOption(String(o.points));
    if (o.gravityChip) await p.locator('.capacete-voador .chip', { hasText: o.gravityChip }).click();
    if (o.gravity !== undefined) await p.getByLabel('Gravidade (m/s²)').fill(o.gravity);
    if (o.rain !== undefined) await p.getByLabel('Garoa (só visual)').setChecked(o.rain);
  }

  /** Clica em "Jogar" e espera o motor publicar o gancho. */
  async start(): Promise<void> {
    await this.startButton.click();
    await this.waitHook();
    await expect(this.canvas).toBeVisible();
    // um quadro para o canvas ter o 1º desenho (o relógio não anda sozinho)
    await this.frames(1);
  }

  /** Abre, escolhe as opções e começa a partida. */
  async play(o: MenuOptions = {}, boot: BaseBootOptions = {}): Promise<void> {
    await this.open(boot);
    await this.menu(o);
    await this.start();
  }

  panel(p: PlayerIndex): Locator {
    return this.page.locator(`.capacete-voador .player-panel.${p === 0 ? 'left' : 'right'}`);
  }

  angleInput(p: PlayerIndex = 0): Locator {
    return this.panel(p).locator('.aim-form input').nth(0);
  }

  velocityInput(p: PlayerIndex = 0): Locator {
    return this.panel(p).locator('.aim-form input').nth(1);
  }

  fireButton(p: PlayerIndex = 0): Locator {
    return this.panel(p).getByRole('button', { name: 'Lançar!' });
  }

  state(): Promise<CVState> {
    return this.hook((h) => h.state());
  }

  targets(): Promise<ReturnType<CapaceteE2E['targets']>> {
    return this.hook((h) => h.targets());
  }

  sim(angle: number, velocity: number, player?: PlayerIndex): Promise<Sim> {
    return this.hook((h, a) => h.simulateShot(a.angle, a.velocity, a.player), { angle, velocity, player });
  }

  /** Preenche ângulo e velocidade do jogador `p` (texto livre: serve para entradas inválidas). */
  async aim(angle: number | string, velocity: number | string, p: PlayerIndex = 0): Promise<void> {
    await this.ev.quiet(async () => {
      await this.angleInput(p).fill(String(angle));
      await this.velocityInput(p).fill(String(velocity));
    });
    await this.ev.action(`Mira do ${p === 0 ? 'jogador 1' : 'jogador 2'}: ângulo "${angle}", velocidade "${velocity}"`);
  }

  /** Lança com Enter (no campo de velocidade) ou com o botão "Lançar!" e roda 1 quadro. */
  async fire(how: 'enter' | 'botao' = 'enter', p: PlayerIndex = 0): Promise<void> {
    await this.ev.quiet(async () => {
      if (how === 'enter') await this.velocityInput(p).press('Enter');
      else await this.fireButton(p).click();
      await this.frames(1);
    });
    await this.ev.action(how === 'enter' ? 'Enter no formulário de mira' : 'Clique em "Lançar!"');
  }

  /** Espera o tiro `n` (padrão: o último disparado) terminar e o jogo sair da explosão. */
  async waitShot(maxSeconds = 30): Promise<CVState> {
    await this.advanceUntil((h) => {
      const s = h.state();
      return s.phase !== 'flying' && s.phase !== 'exploding';
    }, maxSeconds, undefined, 30);
    const s = await this.state();
    await this.evidence(`Tiro ${s.shotsFired} terminou: ${s.outcomes.at(-1)?.kind ?? '?'}`);
    return s;
  }

  /** Mira, lança (Enter) e espera o voo terminar. */
  async shoot(angle: number, velocity: number, p: PlayerIndex = 0, how: 'enter' | 'botao' = 'enter'): Promise<CVState> {
    await this.aim(angle, velocity, p);
    await this.fire(how, p);
    return this.waitShot();
  }

  /** Avança até ser a vez de mirar do jogador `p` (formulário na tela). */
  async waitAim(p: PlayerIndex, maxSeconds = 60): Promise<void> {
    await this.advanceUntil((h, who) => {
      const s = h.state();
      return s.phase === 'aiming' && s.turn === who;
    }, maxSeconds, p, 30);
    await expect(this.angleInput(p)).toBeVisible();
  }

  /** Avança até a próxima rodada começar (fase de mira ou o computador pensando). */
  async waitRound(round: number, maxSeconds = 30): Promise<void> {
    await this.advanceUntil((h, r) => h.state().round >= r, maxSeconds, round, 30);
  }

  /**
   * Procura, com a simulação do jogo (`simulateShot`), um tiro inteiro que termine como pedido. Varre a
   * grade inteira no navegador numa chamada só. `null` se não houver nesta cidade.
   */
  findShot(q: ShotQuery): Promise<{ angle: number; velocity: number; sim: Sim } | null> {
    return this.hook(
      (h, a) => {
        const s = h.state();
        const player = a.q.player ?? s.turn;
        const q = a.q;
        const [a0, a1] = q.angles ?? [1, 179];
        const [v0, v1] = q.velocities ?? [5, 200];
        for (let v = v0; v <= v1; v++) {
          for (let ang = a0; ang <= a1; ang++) {
            const r = h.simulateShot(ang, v, player);
            if (r.kind !== q.kind) continue;
            if (q.index !== undefined && r.index !== q.index) continue;
            if (q.sun !== undefined && r.touchedSun !== q.sun) continue;
            if (q.minX !== undefined && r.x < q.minX) continue;
            if (q.maxX !== undefined && r.x > q.maxX) continue;
            if (q.side === 'floor' && !(r.y >= a.h && r.x >= 0 && r.x <= a.w)) continue;
            if (q.side === 'lateral' && !(r.x < -10 || r.x > a.w + 10)) continue;
            if (q.side === 'time' && (r.x < -10 || r.x > a.w + 10 || r.y >= a.h)) continue;
            return { angle: ang, velocity: v, sim: r };
          }
        }
        return null;
      },
      { q, w: W, h: H },
    );
  }

  /** Como `findShot`, mas clica em "Reiniciar" (cidade nova, pela tela) até achar; no máximo `tries` cidades. */
  async findShotOrRestart(q: ShotQuery, tries = 8): Promise<{ angle: number; velocity: number; sim: Sim }> {
    for (let i = 0; i < tries; i++) {
      const found = await this.findShot(q);
      if (found) return found;
      await this.restart();
    }
    throw new Error(`nenhum tiro ${JSON.stringify(q)} em ${tries} cidades`);
  }

  /** Tiro que não acerta nenhum motoboy (prédio ou saída), para passar a vez. */
  async harmless(p: PlayerIndex): Promise<{ angle: number; velocity: number; sim: Sim }> {
    const b = (await this.findShot({ kind: 'building', player: p, angles: [30, 80] })) ?? (await this.findShot({ kind: 'out', player: p }));
    if (!b) throw new Error(`sem tiro inofensivo para o jogador ${p + 1}`);
    return b;
  }

  /** Mira e lança um tiro inofensivo do jogador `p` (humano) e espera o voo terminar. */
  async passTurn(p: PlayerIndex): Promise<CVState> {
    const b = await this.harmless(p);
    return this.shoot(b.angle, b.velocity, p);
  }

  /** Texto da faixa de mensagem no meio do campo. */
  banner(): Locator {
    return this.page.locator('.capacete-voador .banner');
  }

  /** Volta ao menu pela barra da partida. */
  async backToMenu(): Promise<void> {
    await this.page.getByRole('button', { name: '← Menu' }).click();
    await expect(this.startButton).toBeVisible();
  }

  /** Botão "Reiniciar" da barra: placar zerado, cidade nova. */
  async restart(): Promise<void> {
    await this.page.getByRole('button', { name: 'Reiniciar' }).click();
    await this.frames(1);
  }

  /** Placar exibido no rodapé do campo (`a >Placar< b`). */
  async shownScore(): Promise<[number, number]> {
    const t = (await this.page.locator('.capacete-voador .scoreboard span').first().textContent()) ?? '';
    const m = /(\d+)\s*>Placar<\s*(\d+)/.exec(t);
    if (!m) throw new Error(`placar ilegível: ${t}`);
    return [Number(m[1]), Number(m[2])];
  }
}
