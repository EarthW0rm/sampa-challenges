import { useMemo } from 'react';
import { fire, hire, rollCandidates, salaryFor, salaryOf, setMode, train } from '../../game/campaign/actions/staff';
import { positionsAvailable } from '../../game/campaign/positions';
import { REFUSAL_TEXT, type Campaign, type Candidate, type Staff } from '../../game/campaign/types';
import { COURSES, COURSE_IDS, FRYER_ONLY, POSITION_LABEL, TRAITS, type PositionId } from '../../game/data/staff';
import { money } from '../format';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
}

const KIND_LABEL = { fritador: 'Fritador', geral: 'Geral' } as const;

function Traits({ traits }: { traits: readonly (keyof typeof TRAITS)[] }) {
  if (traits.length === 0) return <span className="muted">sem traços</span>;
  return (
    <>
      {traits.map((t) => (
        <span key={t} className="badge" title={TRAITS[t].desc}>
          {TRAITS[t].name}
        </span>
      ))}
    </>
  );
}

export function StaffTab({ campaign: c, onChange }: Props) {
  const candidates = useMemo(() => rollCandidates(c), [c]);
  const positions = positionsAvailable(c);

  const doHire = (cand: Candidate) => {
    const r = hire(c, cand.id);
    if (r.ok) onChange(r.campaign);
  };
  const hireBlock = (cand: Candidate): string | null => {
    const r = hire(c, cand.id);
    return r.ok ? null : r.motivo === 'limite' ? 'Sem posição livre na barraca' : REFUSAL_TEXT[r.motivo];
  };
  const choosePosition = (s: Staff, value: string) => {
    const r = value === 'auto' ? setMode(c, s.id, 'auto') : setMode(c, s.id, 'fixo', value as PositionId);
    if (r.ok) onChange(r.campaign);
  };

  return (
    <section className="tab" aria-label="Equipe">
      <p className="hint">
        {c.staff.length} de {positions.length} posições. Fritador (R$ 75) é o único que tira do óleo e, na posição Troca de óleo, troca o
        óleo; Geral (R$ 55) ocupa as outras posições. A Montagem coloca em qualquer tacho; sem ela, o Fritador vai até a bancada montar.
        Salários saem no fechamento. O automático ocupa a posição vaga de maior prioridade.
      </p>

      <h3 className="group">Candidatos de hoje</h3>
      <ul className="list">
        {candidates.length === 0 && <li className="hint">Todos os candidatos de hoje foram contratados.</li>}
        {candidates.map((cand) => {
          const block = hireBlock(cand);
          return (
            <li className="item" key={cand.id}>
              <div className="item-main">
                <strong>
                  {cand.name} · {KIND_LABEL[cand.kind]}
                </strong>
                <span>
                  <Traits traits={cand.traits} />
                </span>
                {block && <span className="warn">{block}</span>}
              </div>
              <button type="button" disabled={block !== null} onClick={() => doHire(cand)}>
                Contratar · {money(salaryFor(c, cand.kind, cand.traits))}/dia
              </button>
            </li>
          );
        })}
      </ul>

      <h3 className="group">Equipe</h3>
      <ul className="list">
        {c.staff.length === 0 && <li className="hint">Você trabalha sozinho. Contrate para delegar funções.</li>}
        {c.staff.map((s) => (
          <li className="item staff" key={s.id}>
            <div className="item-main">
              <strong>
                {s.name} · {KIND_LABEL[s.kind]} · {money(salaryOf(c, s))}/dia
              </strong>
              <span>
                <Traits traits={s.traits} />
              </span>
              <span>{s.courses.length ? s.courses.map((x) => COURSES[x].name).join(', ') : 'sem cursos'}</span>
            </div>
            <label className="field">
              Posição
              <select value={s.mode === 'auto' ? 'auto' : s.position ?? 'auto'} onChange={(e) => choosePosition(s, e.target.value)}>
                <option value="auto">Automático</option>
                {positions.map((p) => (
                  <option key={p} value={p} disabled={FRYER_ONLY.includes(p) && s.kind !== 'fritador'}>
                    {POSITION_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <div className="courses">
              {COURSE_IDS.map((id) => {
                const r = train(c, s.id, id);
                const has = s.courses.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    disabled={has || !r.ok}
                    title={COURSES[id].desc}
                    onClick={() => r.ok && onChange(r.campaign)}
                  >
                    {has ? '✓ ' : ''}
                    {COURSES[id].name.replace('Boas Práticas de ', '')} {has ? '' : money(COURSES[id].price)}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => {
                const r = fire(c, s.id);
                if (r.ok) onChange(r.campaign);
              }}
            >
              Dispensar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
