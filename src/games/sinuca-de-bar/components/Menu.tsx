import { useState, type FormEvent } from 'react';
import { LEVELS, type Level } from '../game/ai';
import { assetUrl } from '../game/assets';
import type { RuleSet } from '../game/rules';
import type { BreakChoice, GameMode, Settings } from '../game/types';

interface Props {
  initial: Settings;
  onStart: (settings: Settings) => void;
}

const MODES: { id: GameMode; title: string; desc: string }[] = [
  { id: 'pvc', title: 'Contra o computador', desc: 'Você contra a máquina do boteco.' },
  { id: 'pvp', title: '2 jogadores', desc: 'Duas pessoas no mesmo aparelho, revezando o taco.' },
];

const RULE_SETS: { id: RuleSet; title: string; desc: string; balls: number[] }[] = [
  { id: 'lisas', title: 'Lisas × listradas', desc: '1 a 7 contra 9 a 15. Quem limpar o grupo mata a bola 8.', balls: [3, 8, 11] },
  { id: 'parimpar', title: 'Ímpares × pares', desc: 'Ímpares (1 a 13) contra pares (2 a 14). A bola 15 é a castigo.', balls: [5, 15, 6] },
];

const LEVEL_IDS: Level[] = [1, 2, 3];

export function Menu({ initial, onStart }: Props) {
  const [s, setS] = useState<Settings>(initial);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setS((prev) => ({ ...prev, [key]: value }));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onStart({ ...s, names: [s.names[0].trim() || 'Jogador 1', s.names[1].trim() || 'Jogador 2'] });
  };

  const breakers: { id: BreakChoice; title: string }[] = [
    { id: 'p1', title: s.mode === 'pvc' ? 'Você' : 'Jogador 1' },
    { id: 'p2', title: s.mode === 'pvc' ? 'Computador' : 'Jogador 2' },
    { id: 'random', title: 'Sorteio' },
  ];

  return (
    <main className="menu">
      <header className="menu-header">
        <div className="logo-row" aria-hidden="true">
          {[1, 8, 9, 0].map((n) => (
            <img key={n} src={assetUrl(`b${n}`)} alt="" />
          ))}
        </div>
        <h1>SINUCA DE BAR</h1>
        <p>Ficha na mesa, giz no taco e regra da casa.</p>
      </header>

      <form className="menu-form" onSubmit={submit}>
        <fieldset>
          <legend>Modo de jogo</legend>
          <div className="cards">
            {MODES.map((m) => (
              <label key={m.id} className={`card ${s.mode === m.id ? 'selected' : ''}`}>
                <input type="radio" name="mode" value={m.id} checked={s.mode === m.id} onChange={() => set('mode', m.id)} />
                <span className="card-title">{m.title}</span>
                <span className="card-desc">{m.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend>Regra da casa</legend>
          <div className="cards">
            {RULE_SETS.map((r) => (
              <label key={r.id} className={`card ${s.rules === r.id ? 'selected' : ''}`}>
                <input type="radio" name="rules" value={r.id} checked={s.rules === r.id} onChange={() => set('rules', r.id)} />
                <span className="card-balls" aria-hidden="true">
                  {r.balls.map((n) => (
                    <img key={n} src={assetUrl(`b${n}`)} alt="" />
                  ))}
                </span>
                <span className="card-title">{r.title}</span>
                <span className="card-desc">{r.desc}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {s.mode === 'pvc' && (
          <fieldset>
            <legend>Computador</legend>
            <div className="cards cards-3">
              {LEVEL_IDS.map((id) => (
                <label key={id} className={`card ${s.level === id ? 'selected' : ''}`}>
                  <input type="radio" name="level" value={id} checked={s.level === id} onChange={() => set('level', id)} />
                  <span className="card-title">{LEVELS[id].label}</span>
                  <span className="card-desc">{LEVELS[id].desc}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend>Jogadores</legend>
          <div className="row">
            <label className="field">
              <span>{s.mode === 'pvp' ? 'Jogador 1' : 'Seu nome'}</span>
              <input value={s.names[0]} maxLength={14} onChange={(e) => set('names', [e.target.value, s.names[1]])} />
            </label>
            {s.mode === 'pvp' && (
              <label className="field">
                <span>Jogador 2</span>
                <input value={s.names[1]} maxLength={14} onChange={(e) => set('names', [s.names[0], e.target.value])} />
              </label>
            )}
          </div>
          <div className="choice-row" role="radiogroup" aria-label="Quem dá a saída">
            <span className="choice-label">Saída:</span>
            {breakers.map((b) => (
              <label key={b.id} className={`chip ${s.breaker === b.id ? 'selected' : ''}`}>
                <input type="radio" name="breaker" value={b.id} checked={s.breaker === b.id} onChange={() => set('breaker', b.id)} />
                {b.title}
              </label>
            ))}
          </div>
        </fieldset>

        <button type="submit" className="start">
          Jogar
        </button>
      </form>
    </main>
  );
}
