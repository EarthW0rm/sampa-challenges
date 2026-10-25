import { CHALLENGES, CHALLENGE_OFFERS, CHALLENGE_OFFERS_WITH_DISPATCHER, MAX_ACTIVE_CHALLENGES, challengeById, type ChallengeDef } from '../../data/challenges';
import { Rng } from '../../rng';
import { cloneCampaign, lockedByDay } from '../campaign';
import { unlockDay } from '../../unlocks';
import type { ActionResult, Campaign } from '../types';

/** Desafios oferecidos hoje: até 2 (3 com Despachante), só os atingíveis e ainda não aceitos (RN-135, RN-137). */
export function rollChallenges(c: Campaign): ChallengeDef[] {
  if (!c.owned.office && lockedByDay(c, unlockDay('associacao'))) return []; // a partir do dia 3, ou já com a opção de liberar (RN-55a)
  const rng = new Rng(c.seed).fork(`desafios:${c.calendar}`);
  const pool = CHALLENGES.filter((d) => d.available(c) && !c.challenges.some((a) => a.id === d.id));
  const max = c.roles.includes('despachante') ? CHALLENGE_OFFERS_WITH_DISPATCHER : CHALLENGE_OFFERS;
  const n = Math.min(pool.length, rng.int(1, max));
  const out: ChallengeDef[] = [];
  const left = [...pool];
  for (let i = 0; i < n; i++) out.push(left.splice(rng.int(0, left.length - 1), 1)[0]);
  return out;
}

/** Aceitar é opcional e não paga nada: o prêmio sai só na conclusão (RN-135, PA-11). */
export function acceptChallenge(c: Campaign, id: string): ActionResult {
  const def = challengeById(id);
  if (!def || !rollChallenges(c).some((d) => d.id === id)) return { ok: false, motivo: 'requer' };
  if (c.challenges.length >= MAX_ACTIVE_CHALLENGES) return { ok: false, motivo: 'limite' };
  const next = cloneCampaign(c);
  next.challenges.push({ id, acceptedOn: c.calendar, deadline: c.calendar + def.days - 1, progress: 0 });
  return { ok: true, campaign: next };
}
