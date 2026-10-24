import { devConfig } from '../../game/devConfig';
import { ALERT_BAND, buildLayout, coveredByPanel, hitTest, MIN_TARGET, PANEL, type Rect } from '../../game/layout';
import { panelControls } from '../../game/render/panel';
import { createState } from '../../game/sim/state';
import type { StationId } from '../../game/types';
import { createUi } from '../../game/ui';
import { check, checkEq, type Scenario } from '../harness';

const overlap = (a: Rect, b: Rect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const FREQUENT = new Set<string>(['fila', 'balcao', 'bancada', 'tacho1', 'tacho2', 'tacho3', 'estufa', 'moenda']);

export const layout: Scenario[] = [
  {
    id: 'rn74-zonas-sem-sobreposicao',
    rules: 'RN-74, RN-75',
    run() {
      const l = buildLayout(devConfig().stations);
      for (let i = 0; i < l.zones.length; i++) {
        check(!overlap(l.zones[i], ALERT_BAND), `${l.zones[i].id} invade a faixa de avisos`);
        check(l.zones[i].x >= 0 && l.zones[i].x + l.zones[i].w <= 640, `${l.zones[i].id} fora da largura`);
        for (let j = i + 1; j < l.zones.length; j++) {
          check(!overlap(l.zones[i], l.zones[j]), `${l.zones[i].id} sobrepõe ${l.zones[j].id}`);
        }
      }
    },
  },
  {
    id: 'rn75-frequentes-acima-do-painel',
    rules: 'RN-75',
    run() {
      const all: StationId[] = ['balcao', 'bancada', 'tacho1', 'tacho2', 'tacho3', 'estufa', 'moenda', 'mesas', 'expedicao', 'escritorio', 'descanso'];
      const l = buildLayout(all);
      for (const z of l.zones) {
        if (FREQUENT.has(z.id)) check(!coveredByPanel(z), `${z.id} não pode ficar sob o painel`);
      }
      check(l.zones.length === 12, 'todas as zonas existem na barraca cheia');
    },
  },
  {
    id: 'hit-test',
    rules: 'RN-74',
    run() {
      const l = buildLayout(devConfig().stations);
      const b = l.byId.get('balcao')!;
      checkEq(hitTest(l, b.x + 5, b.y + 5)?.id, 'balcao', 'toque no balcão');
      checkEq(hitTest(l, 0, 300), null, 'toque fora de qualquer zona');
      const t = l.byId.get('tacho1')!;
      checkEq(hitTest(l, t.x + 1, t.y + 1)?.id, 'tacho1', 'toque no tacho');
    },
  },
  {
    id: 'alvos-do-painel-72x72',
    rules: 'spec 4 (390 px)',
    run(seed) {
      for (const station of ['balcao', 'bancada', 'tacho1', 'moenda'] as const) {
        const st = createState(devConfig(), seed);
        st.ready.push({ id: 1, item: 'carne', quality: 80, readyAt: 0 });
        st.cups.push({ id: 2, item: 'caldo-puro' });
        st.assembled.push({ id: 3, item: 'queijo' });
        st.coins.push({ id: 4, amount: 9 });
        const ui = createUi();
        ui.panel = station;
        const controls = panelControls(st, ui);
        check(controls.length > 0, `${station} tem controles`);
        for (const c of controls) {
          check(c.rect.w >= MIN_TARGET && c.rect.h >= MIN_TARGET, `${station}/${c.label}: alvo menor que 72×72`);
          check(c.rect.x >= PANEL.x && c.rect.x + c.rect.w <= PANEL.x + PANEL.w, `${station}/${c.label}: fora do painel (x)`);
          check(c.rect.y >= PANEL.y && c.rect.y + c.rect.h <= PANEL.y + PANEL.h, `${station}/${c.label}: fora do painel (y)`);
        }
        for (let i = 0; i < controls.length; i++) {
          for (let j = i + 1; j < controls.length; j++) check(!overlap(controls[i].rect, controls[j].rect), `${station}: controles sobrepostos`);
        }
      }
    },
  },
];
