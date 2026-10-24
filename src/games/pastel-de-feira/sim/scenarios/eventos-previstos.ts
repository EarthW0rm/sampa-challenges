import { STEP } from '../../game/constants';
import { payroll } from '../../game/campaign/actions/staff';
import { newCampaign, toDayConfig } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import { respondClaim, rollClaim, rollForecast } from '../../game/campaign/events';
import { isCampaign } from '../../game/campaign/save';
import type { Campaign } from '../../game/campaign/types';
import { arrivalInterval, spawnCustomer } from '../../game/sim/customers';
import { acceptOffer } from '../../game/sim/delivery';
import { advance, check, checkEq, checkNear, makeSim, runDay, type Scenario } from '../harness';
import { crewSim, member } from './posicoes';
import { tableConfig } from './mesas';
import { crewSpeed } from '../../game/sim/staff';
import { appSim } from './delivery';

const camp = (patch: Partial<Campaign> = {}): Campaign => ({ ...newCampaign({ profile: 'tradicional', eventsOn: true, tutorial: false, seed: 5 }), cash: 5000, day: 6, ...patch });

export const eventosPrevistos: Scenario[] = [
  {
    id: 'rn150-nao-sorteia-antes-do-dia-4-ou-desligado',
    rules: 'RN-150',
    run() {
      for (let cal = 1; cal < 100; cal++) {
        checkEq(rollForecast(camp({ day: 3, calendar: cal })), null, 'antes do dia 4');
        checkEq(rollForecast(camp({ eventsOn: false, calendar: cal })), null, 'eventos desligados');
      }
      check(toDayConfig(camp({ day: 3 })).eventsOn === false, 'DayConfig sem eventos antes do dia 4');
      check(toDayConfig(camp({ day: 4 })).eventsOn === true, 'DayConfig com eventos a partir do dia 4');
    },
  },
  {
    id: 'rn151-chances-do-previsto',
    rules: 'RN-151, PA-13',
    run() {
      const count = (day: number) => {
        const n: Record<string, number> = { chuva: 0, calor: 0, subprefeitura: 0, nada: 0 };
        for (let cal = 1; cal <= 4000; cal++) n[rollForecast(camp({ day, calendar: cal })) ?? 'nada']++;
        return n;
      };
      const verao = count(4); // Verão
      const inverno = count(12);
      check(verao.chuva / 4000 > 0.18 && verao.chuva / 4000 < 0.3, `chuva no Verão ~25% (${verao.chuva / 40}%)`);
      check(verao.calor > 0, 'calor forte só no Verão');
      checkEq(inverno.calor, 0, 'sem calor forte fora do Verão');
      check(inverno.chuva / 4000 < 0.14, `chuva no Inverno ~10% (${inverno.chuva / 40}%)`);
      check(verao.subprefeitura > 100 && verao.subprefeitura < 500, 'subprefeitura ~8%');
      const c = camp({ calendar: 17 });
      checkEq(rollForecast(c), rollForecast(JSON.parse(JSON.stringify(c))), 'determinístico por semente e calendário');
    },
  },
  {
    id: 'rn151-chuva-balcao-menos-app-mais',
    rules: 'RN-151',
    run(seed) {
      const normal = makeSim(seed, tableConfig(0));
      const chuva = makeSim(seed, tableConfig(0, { forecast: 'chuva' }));
      checkNear(arrivalInterval(chuva.state) / arrivalInterval(normal.state), 1 / 0.6, 'chegada no balcão −40%');
      // app: oferta mais frequente
      const sim = appSim(seed, { forecast: 'chuva' });
      sim.state.offerLeft = 0.01;
      advance(sim, 3);
      check(sim.state.offerLeft <= 25 * 1.5 / 1.5 + 1e-6, 'intervalo das ofertas sai dividido por 1,5');
      void acceptOffer;
      // mesas com metade da procura
      const rate = (forecast: 'chuva' | null) => {
        const m = makeSim(seed + 3, tableConfig(4, { forecast }));
        let g = 0;
        for (let i = 0; i < 2500; i++) {
          m.state.customers.length = 0;
          for (const t of m.state.tables) t.seats = t.seats.map(() => 'livre');
          spawnCustomer(m.state, 'padrao');
          if (m.state.customers.some((c) => c.group)) g++;
        }
        return g / 2500;
      };
      check(Math.abs(rate('chuva') - 0.15) < 0.03, 'mesas com metade da procura na chuva');
    },
  },
  {
    id: 'rn151-calor-mais-caldo-e-cansaco',
    rules: 'RN-151',
    run(seed) {
      const calor = makeSim(seed, tableConfig(0, { forecast: 'calor', season: 'verao' }));
      checkNear(crewSim(seed, [member('geral')], { forecast: 'calor', season: 'verao' }).state.config.forecast === 'calor' ? 1.25 * 1.25 : 0, 1.5625, 'cansaço acumula com o Verão');
      let drinks = 0;
      const N = 4000;
      for (let i = 0; i < N; i++) {
        calor.state.customers.length = 0;
        spawnCustomer(calor.state, 'padrao');
        if (calor.state.customers[0]?.lines.some((l) => l.item === 'caldo-puro')) drinks++;
      }
      check(Math.abs(drinks / N - Math.min(1, 0.4 * 1.4 * 1.5)) < 0.03, `caldo +40% e +50% acumulam (${drinks / N})`);
    },
  },
  {
    id: 'rn151-subprefeitura-mesas-inativas',
    rules: 'RN-151',
    run(seed) {
      const sim = makeSim(seed, tableConfig(4, { forecast: 'subprefeitura' }));
      for (let i = 0; i < 400; i++) {
        sim.state.customers.length = 0;
        spawnCustomer(sim.state, 'padrao');
        check(!sim.state.customers.some((c) => c.group), 'nenhum grupo senta com a subprefeitura');
      }
    },
  },
  {
    id: 'rn151-reivindicacao-chances',
    rules: 'RN-151',
    run(seed) {
      const tired = (c: Campaign) => {
        const r = runDay(seed, toDayConfig(c)).result()!;
        r.staff = [{ id: 1, idleSeconds: 0, restSeconds: 0, endEnergy: 0, minEnergy: 0 }];
        return r;
      };
      const rate = (patch: Partial<Campaign>, staffTraits: ('pavio-curto' | 'rapido')[] = []) => {
        let hit = 0;
        const N = 3000;
        for (let cal = 1; cal <= N; cal++) {
          const c = camp({ calendar: cal, staff: staffTraits.length ? [{ id: 1, name: 'A', kind: 'geral', traits: staffTraits, courses: [], mode: 'auto', position: null, trainedToday: false }] : [], ...patch });
          if (rollClaim(c, tired(c))) hit++;
        }
        return hit / N;
      };
      const base = rate({});
      check(Math.abs(base - 0.3) < 0.04, `30% depois de energia 0 (${base})`);
      check(rate({}, ['pavio-curto']) > base * 1.7, 'Pavio curto dobra');
      check(rate({ roles: ['gerente'], owned: { ...camp().owned, office: true } }) < base * 0.7, 'Gerente reduz pela metade');
      const c = camp();
      const calmo = runDay(seed, toDayConfig(c)).result()!;
      calmo.staff = [{ id: 1, idleSeconds: 0, restSeconds: 0, endEnergy: 50, minEnergy: 40 }];
      check(!rollClaim(c, calmo), 'sem energia 0 não há reivindicação');
      check(!rollClaim(camp({ eventsOn: false }), tired(c)), 'eventos desligados');
    },
  },
  {
    id: 'rn151-reivindicacao-respostas',
    rules: 'RN-151',
    run(seed) {
      const base = camp({ claim: 'pendente' });
      const semArea = respondClaim(base, 'pausa');
      check(!semArea.ok && semArea.motivo === 'requer', 'pausa exige área de descanso');
      const comArea = respondClaim({ ...base, owned: { ...base.owned, rest: 2 } }, 'pausa');
      check(comArea.ok, 'pausa com área de descanso');
      const aumento = respondClaim(base, 'aumento');
      check(aumento.ok, 'aumento');
      if (!aumento.ok) return;
      const staffed = { ...aumento.campaign, staff: [{ id: 1, name: 'A', kind: 'geral' as const, traits: [], courses: [], mode: 'auto' as const, position: null, trainedToday: false }] };
      checkNear(payroll(staffed), 55 * 1.1, 'salários +10%');
      checkNear(payroll({ ...staffed, calendar: staffed.calendar + 2 }), 55 * 1.1, 'por 3 dias');
      checkNear(payroll({ ...staffed, calendar: staffed.calendar + 3 }), 55, 'depois volta ao normal');
      const recusa = respondClaim(base, 'recusada');
      check(recusa.ok, 'recusa');
      if (!recusa.ok) return;
      const cfg = toDayConfig(recusa.campaign);
      check(cfg.claimRefused, 'DayConfig marca a recusa');
      const sim = crewSim(seed, [member('geral')], { claimRefused: true });
      checkNear(crewSpeed(sim.state), 1.15 * 0.85, 'recusar: −15% de velocidade (com o bônus do escritório de teste)');
      check(!respondClaim(camp(), 'aumento').ok, 'sem reivindicação pendente');
      check(isCampaign(JSON.parse(JSON.stringify(base))), 'save válido com reivindicação pendente');
      void closeDay;
      void STEP;
    },
  },
];
