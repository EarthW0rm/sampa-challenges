import { buySpace, buyTachoExtra } from '../../game/campaign/actions/upgrades';
import { fire, hire, payroll, rollCandidates, salaryFor, setMode, train } from '../../game/campaign/actions/staff';
import { cloneCampaign, newCampaign } from '../../game/campaign/campaign';
import { closeDay } from '../../game/campaign/closing';
import { positionsAvailable } from '../../game/campaign/positions';
import { isCampaign } from '../../game/campaign/save';
import type { ActionResult, Campaign, Refusal } from '../../game/campaign/types';
import { check, checkEq, checkNear, runDay, type Scenario } from '../harness';
import { toDayConfig } from '../../game/campaign/campaign';

const rich = (patch: Partial<Campaign> = {}): Campaign => ({
  ...newCampaign({ profile: 'negociante', eventsOn: false, tutorial: false, seed: 21 }),
  cash: 10000,
  ...patch,
});

function must(r: ActionResult): Campaign {
  check(r.ok, `ação recusada: ${r.ok ? '' : r.motivo}`);
  return r.campaign;
}

function refused(r: ActionResult, motivo: Refusal, msg: string): void {
  check(!r.ok, `${msg}: deveria recusar`);
  if (!r.ok) checkEq(r.motivo, motivo, msg);
}

/** Contrata o primeiro candidato do tipo pedido. */
function hireKind(c: Campaign, kind: 'fritador' | 'geral'): Campaign {
  const cand = rollCandidates(c).find((x) => x.kind === kind)!;
  return must(hire(c, cand.id));
}

export const equipe: Scenario[] = [
  {
    id: 'rn113-candidatos-do-dia',
    rules: 'RN-113',
    run() {
      const c = rich();
      const a = rollCandidates(c);
      checkEq(a.length, 6, '3 candidatos de cada tipo');
      checkEq(a.filter((x) => x.kind === 'fritador').length, 3, 'fritadores');
      check(a.every((x) => x.traits.length <= 2 && new Set(x.traits).size === x.traits.length), '0 a 2 traços distintos');
      checkEq(JSON.stringify(rollCandidates(cloneCampaign(c))), JSON.stringify(a), 'o mesmo dia gera os mesmos candidatos');
      const outro = rich({ calendar: 2 });
      check(JSON.stringify(rollCandidates(outro)) !== JSON.stringify(a), 'outro dia, outros candidatos');
      check(new Set(a.map((x) => x.name)).size === a.length, 'nomes distintos');
    },
  },
  {
    id: 'rn47-114-salario-com-tracos',
    rules: 'RN-47, RN-114',
    run() {
      const c = rich();
      checkNear(salaryFor(c, 'fritador', []), 75, 'Fritador base');
      checkNear(salaryFor(c, 'geral', []), 55, 'Geral base');
      checkNear(salaryFor(c, 'fritador', ['rapido']), 86.25, 'Fritador Rápido (75 × 1,15)');
      checkNear(salaryFor(c, 'geral', ['caprichoso', 'distraido']), 51.43, 'combinação de traços');
      checkNear(salaryFor(c, 'geral', ['pavio-curto']), 49.5, 'Pavio curto −10%');
      checkNear(salaryFor({ ...c, profile: 'gestor' }, 'geral', []), 49.5, 'perfil Gestor −10%');
    },
  },
  {
    id: 'rn48-contratar-e-dispensar',
    rules: 'RN-48',
    run() {
      let c = rich();
      checkEq(positionsAvailable(c).join(','), 'balcao,montagem1,fritador1,trocador,moenda', 'posições da barraca inicial');
      c = hireKind(hireKind(hireKind(c, 'fritador'), 'geral'), 'geral');
      checkEq(c.staff.length, 3, 'contratou 3');
      checkEq(rollCandidates(c).length, 3, 'contratados saem da lista do dia');
      c = hireKind(c, 'geral');
      c = hireKind(c, 'fritador');
      checkEq(c.staff.length, 5, 'lotou as 5 posições');
      refused(hire(c, rollCandidates(c)[0].id), 'limite', 'mais funcionários que posições');
      refused(hire(c, 'inexistente'), 'requer', 'candidato que não existe');
      c = must(fire(c, c.staff[0].id));
      checkEq(c.staff.length, 4, 'dispensou');
      refused(fire(c, 999), 'requer', 'dispensar quem não existe');
      let g = must(buySpace(rich(), 2));
      g = must(buyTachoExtra(g));
      checkEq(positionsAvailable(g).length, 7, 'um tacho a mais: +2 posições (Montagem e Fritador)');
    },
  },
  {
    id: 'rn49-posicao-so-para-o-tipo-certo',
    rules: 'RN-49, PA-03, D-01',
    run() {
      let c = hireKind(hireKind(rich(), 'fritador'), 'geral');
      const fr = c.staff.find((s) => s.kind === 'fritador')!;
      const ge = c.staff.find((s) => s.kind === 'geral')!;
      refused(setMode(c, ge.id, 'fixo', 'fritador1'), 'requer', 'Geral não frita');
      refused(setMode(c, ge.id, 'fixo', 'trocador'), 'requer', 'Geral não troca óleo');
      c = must(setMode(c, ge.id, 'fixo', 'balcao'));
      check(c.staff.find((s) => s.id === ge.id)!.position === 'balcao', 'Geral no balcão');
      c = must(setMode(c, fr.id, 'fixo', 'fritador1'));
      refused(setMode(c, fr.id, 'fixo', 'balcao'), 'limite', 'posição já ocupada por outro fixo');
      c = must(setMode(c, fr.id, 'fixo', 'moenda'));
      refused(setMode(c, fr.id, 'fixo', 'garcom'), 'requer', 'posição inexistente (sem mesas)');
      c = must(setMode(c, fr.id, 'auto'));
      checkEq(c.staff.find((s) => s.id === fr.id)!.position, null, 'automático sem posição');
      refused(setMode(c, 999, 'auto'), 'requer', 'funcionário inexistente');
    },
  },
  {
    id: 'rn118-treinamento',
    rules: 'RN-118',
    run() {
      let c = hireKind(rich(), 'fritador');
      const id = c.staff[0].id;
      c = must(train(c, id, 'fritura'));
      checkEq(c.cash, 9880, 'curso de fritura R$ 120');
      check(c.staff[0].courses.includes('fritura'), 'curso registrado');
      refused(train(c, id, 'higiene'), 'limite', 'segundo curso no mesmo dia');
      c.staff[0].trainedToday = false;
      refused(train(c, id, 'fritura'), 'limite', 'curso repetido');
      refused(train({ ...c, cash: 10 }, id, 'atendimento'), 'semCaixa', 'sem caixa');
      c = must(train(c, id, 'higiene'));
      checkEq(c.cash, 9880 - 80, 'curso de higiene R$ 80');
      refused(train(c, 99, 'fritura'), 'requer', 'funcionário inexistente');
    },
  },
  {
    id: 'rn47-salarios-no-fechamento',
    rules: 'RN-47',
    run(seed) {
      let c = hireKind(hireKind(rich(), 'fritador'), 'geral');
      c.staff[0].traits = ['rapido'];
      c.staff[1].traits = [];
      const esperado = salaryFor(c, c.staff[0].kind, ['rapido']) + salaryFor(c, c.staff[1].kind, []);
      checkNear(payroll(c), esperado, 'folha');
      const cash = c.cash;
      const out = closeDay(c, runDay(seed, toDayConfig(c)).result()!);
      const line = out.balance.lines.find((l) => l.id === 'salarios');
      checkNear(line!.amount, -esperado, 'linha do balanço');
      checkNear(out.campaign.cash, cash - esperado, 'caixa debitado');
      c = out.campaign;
      check(c.staff.every((s) => !s.trainedToday) && c.hiredToday.length === 0, 'novo dia: cursos e candidatos reiniciam');
    },
  },
  {
    id: 'save-valida-equipe',
    rules: 'plan 3.3',
    run() {
      const c = hireKind(rich(), 'fritador');
      check(isCampaign(JSON.parse(JSON.stringify(c))), 'campanha com equipe é válida');
      const bad = JSON.parse(JSON.stringify(c));
      bad.staff[0].traits = ['voador'];
      check(!isCampaign(bad), 'traço inexistente');
      const bad2 = JSON.parse(JSON.stringify(c));
      bad2.staff[0].mode = 'auto';
      bad2.staff[0].position = 'balcao';
      check(!isCampaign(bad2), 'automático com posição');
      const bad3 = JSON.parse(JSON.stringify(c));
      bad3.staff.push({ ...bad3.staff[0] });
      check(!isCampaign(bad3), 'id duplicado');
    },
  },
];
