import { useState, type FormEvent } from 'react';
import { assetUrl } from '../game/assets';
import type { Difficulty, GameMode, Settings } from '../game/types';

interface Props {
  initial: Settings;
  onStart: (settings: Settings) => void;
}

const MODES: { id: GameMode; title: string; desc: string }[] = [
  { id: 'pvp', title: '2 jogadores', desc: 'Dois humanos se revezando no mesmo teclado.' },
  { id: 'pvc', title: 'Contra o computador', desc: 'Você à esquerda, o computador à direita.' },
  { id: 'practice', title: 'Treino', desc: 'O outro motoboy só fica parado. Mire à vontade.' },
];

const DIFFICULTIES: { id: Difficulty; title: string; desc: string }[] = [
  { id: 'facil', title: 'Fácil', desc: 'Nunca acerta.' },
  { id: 'medio', title: 'Médio', desc: 'Vai ajustando a mira a cada tiro.' },
  { id: 'dificil', title: 'Difícil', desc: 'Acerta em no máximo 3 tiros.' },
];

const GRAVITIES = [
  { label: 'Terra', value: 9.8 },
  { label: 'Lua', value: 1.6 },
  { label: 'Marte', value: 3.7 },
  { label: 'Júpiter', value: 24.8 },
];

export function Menu({ initial, onStart }: Props) {
  const [s, setS] = useState<Settings>(initial);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setS((prev) => ({ ...prev, [key]: value }));

  const p2Label = s.mode === 'pvp' ? 'Jogador 2' : s.mode === 'pvc' ? 'Computador' : 'Motoboy-alvo';

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const names: [string, string] = [
      s.names[0].trim() || 'Jogador 1',
      s.mode === 'pvp' ? s.names[1].trim() || 'Jogador 2' : p2Label,
    ];
    onStart({ ...s, names, gravity: s.gravity > 0 ? s.gravity : 9.8 });
  };

  return (
    <main className="menu">
      <header className="menu-header">
        <div className="logo-row" aria-hidden="true">
          <img src={assetUrl('p1_dano0_arremesso')} alt="" />
          <img src={assetUrl('capacete_p1_1')} alt="" className="logo-banana" />
          <img src={assetUrl('p2_dano0')} alt="" className="logo-flip" />
        </div>
        <h1>CAPACETE VOADOR</h1>
        <p>Capacetes voando sobre o Copan, o Itália e o MASP.</p>
        <p className="rules">
          Cada acerto na moto quebra uma peça: no 3º ela é destruída. Acertou o piloto, venceu a rodada.
        </p>
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

        {s.mode === 'pvc' && (
          <fieldset>
            <legend>Dificuldade do computador</legend>
            <div className="cards">
              {DIFFICULTIES.map((d) => (
                <label key={d.id} className={`card ${s.difficulty === d.id ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="difficulty"
                    value={d.id}
                    checked={s.difficulty === d.id}
                    onChange={() => set('difficulty', d.id)}
                  />
                  <span className="card-title">{d.title}</span>
                  <span className="card-desc">{d.desc}</span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <fieldset>
          <legend>Jogadores</legend>
          <div className="row">
            <label className="field">
              <span>Nome do jogador 1</span>
              <input
                value={s.names[0]}
                maxLength={14}
                onChange={(e) => set('names', [e.target.value, s.names[1]])}
              />
            </label>
            <label className="field">
              <span>{s.mode === 'pvp' ? 'Nome do jogador 2' : 'Adversário'}</span>
              <input
                value={s.mode === 'pvp' ? s.names[1] : p2Label}
                maxLength={14}
                disabled={s.mode !== 'pvp'}
                onChange={(e) => set('names', [s.names[0], e.target.value])}
              />
            </label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Regras</legend>
          <div className="row">
            {s.mode !== 'practice' && (
              <label className="field">
                <span>Pontos para vencer</span>
                <select value={s.pointsToWin} onChange={(e) => set('pointsToWin', Number(e.target.value))}>
                  {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="field">
              <span>Gravidade (m/s²)</span>
              <input
                type="number"
                step="0.1"
                min="0.5"
                max="50"
                value={s.gravity}
                onChange={(e) => set('gravity', Number(e.target.value))}
              />
            </label>
          </div>
          <div className="chips" role="group" aria-label="Atalhos de gravidade">
            {GRAVITIES.map((g) => (
              <button
                type="button"
                key={g.label}
                className={`chip ${s.gravity === g.value ? 'selected' : ''}`}
                onClick={() => set('gravity', g.value)}
              >
                {g.label} {g.value}
              </button>
            ))}
          </div>
          <label className="check">
            <input type="checkbox" checked={s.rain} onChange={(e) => set('rain', e.target.checked)} />
            <span>Garoa (só visual)</span>
          </label>
        </fieldset>

        <button type="submit" className="start">
          Jogar
        </button>
      </form>
    </main>
  );
}
