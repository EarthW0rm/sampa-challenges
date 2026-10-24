import { COURSES, FRYER_ONLY, SALARY, STAFF_NAMES, TRAITS, TRAIT_COUNT_WEIGHTS, TRAIT_IDS, CANDIDATES_PER_KIND, type CourseId, type PositionId, type StaffKind, type TraitId } from '../../data/staff';
import { FORECAST } from '../../data/events';
import { ROLES } from '../../data/office';
import { Rng } from '../../rng';
import { cloneCampaign, round2 } from '../campaign';
import { positionsAvailable } from '../positions';
import type { ActionResult, Campaign, Candidate, Staff } from '../types';

const profileSalaryFactor = (c: Campaign): number => (c.profile === 'gestor' ? 0.9 : 1);

/** Salário diário: base do tipo × traços × perfil do pasteleiro (RN-47, RN-110, RN-114). */
export function salaryFor(c: Campaign, kind: StaffKind, traits: readonly TraitId[]): number {
  let v = SALARY[kind];
  for (const t of traits) v *= TRAITS[t].salary;
  return round2(v * profileSalaryFactor(c));
}

export const salaryOf = (c: Campaign, s: Staff): number => salaryFor(c, s.kind, s.traits);

/** Soma dos salários do dia, debitada no fechamento (RN-47). */
export const payroll = (c: Campaign): number =>
  round2((c.calendar <= c.raiseUntil ? FORECAST.claimRaise : 1) * (c.staff.reduce((n, s) => n + salaryOf(c, s), 0) + c.roles.reduce((n, r) => n + ROLES[r].salary * profileSalaryFactor(c), 0)));

/** Candidatos do dia: até 3 de cada tipo, 0 a 2 traços, sorteados pela semente e pelo calendário (RN-113). */
export function rollCandidates(c: Campaign): Candidate[] {
  const rng = new Rng(c.seed).fork(`candidatos:${c.calendar}`);
  const out: Candidate[] = [];
  const names = [...STAFF_NAMES];
  for (const kind of ['fritador', 'geral'] as const) {
    for (let i = 0; i < CANDIDATES_PER_KIND; i++) {
      const count = rng.weighted([0, 1, 2], (n) => TRAIT_COUNT_WEIGHTS[n]) ?? 0;
      const pool = [...TRAIT_IDS];
      const traits: TraitId[] = [];
      for (let t = 0; t < count; t++) traits.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
      const name = names.splice(rng.int(0, names.length - 1), 1)[0];
      out.push({ id: `${c.calendar}-${kind}-${i}`, name, kind, traits });
    }
  }
  return out.filter((cand) => !c.hiredToday.includes(cand.id));
}

type Refuse = { ok: false; motivo: 'semCaixa' | 'limite' | 'requer' };
const no = (motivo: Refuse['motivo']): Refuse => ({ ok: false, motivo });

/** Contratar um candidato do dia, sem custo extra. Não passa do número de posições (RN-48). */
export function hire(c: Campaign, candidateId: string): ActionResult {
  const cand = rollCandidates(c).find((x) => x.id === candidateId);
  if (!cand) return no('requer');
  if (c.staff.length >= positionsAvailable(c).length) return no('limite');
  const next = cloneCampaign(c);
  next.staff.push({
    id: next.nextStaffId++, name: cand.name, kind: cand.kind, traits: [...cand.traits], courses: [], mode: 'auto',
    position: null, trainedToday: false,
  });
  next.hiredToday.push(cand.id);
  return { ok: true, campaign: next };
}

/** Dispensar, sem custo extra (RN-48). */
export function fire(c: Campaign, staffId: number): ActionResult {
  if (!c.staff.some((s) => s.id === staffId)) return no('requer');
  const next = cloneCampaign(c);
  next.staff = next.staff.filter((s) => s.id !== staffId);
  return { ok: true, campaign: next };
}

/** Fixo numa posição ou automático (RN-45). Fritador e Trocador de óleo só para o tipo Fritador (RN-49). */
export function setMode(c: Campaign, staffId: number, mode: 'fixo' | 'auto', position?: PositionId): ActionResult {
  const s = c.staff.find((x) => x.id === staffId);
  if (!s) return no('requer');
  if (mode === 'fixo') {
    if (!position || !positionsAvailable(c).includes(position)) return no('requer');
    if (FRYER_ONLY.includes(position) && s.kind !== 'fritador') return no('requer');
    if (c.staff.some((o) => o.id !== staffId && o.mode === 'fixo' && o.position === position)) return no('limite');
  }
  const next = cloneCampaign(c);
  const t = next.staff.find((x) => x.id === staffId)!;
  t.mode = mode;
  t.position = mode === 'fixo' ? position! : null;
  return { ok: true, campaign: next };
}

/** Treinamento: pago no Preparo, efeito permanente, 1 curso por funcionário por dia (RN-118). */
export function train(c: Campaign, staffId: number, course: CourseId): ActionResult {
  const s = c.staff.find((x) => x.id === staffId);
  const def = COURSES[course];
  if (!s || !def) return no('requer');
  if (s.trainedToday || s.courses.includes(course)) return no('limite');
  if (def.price > c.cash + 1e-9) return no('semCaixa');
  const next = cloneCampaign(c);
  next.cash = round2(next.cash - def.price);
  const t = next.staff.find((x) => x.id === staffId)!;
  t.courses.push(course);
  t.trainedToday = true;
  return { ok: true, campaign: next };
}
