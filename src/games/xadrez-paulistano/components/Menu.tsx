import { useState, type CSSProperties, type FormEvent } from 'react';
import { assetUrl } from '../game/assets';
import { LEVEL_MAX, LEVEL_MIN } from '../game/constants';
import { clampLevel, levelLabel, levelProfile } from '../game/levels';
import type { ColorChoice, GameMode, Settings } from '../game/types';

interface Props {
  initial: Settings;
  onStart: (settings: Settings) => void;
}

const MODES: { id: GameMode; title: string; desc: string }[] = [
  { id: 'pvc', title: 'Contra o computador', desc: 'Você escolhe a cor e a força do adversário.' },
  { id: 'pvp', title: '2 jogadores', desc: 'Duas pessoas no mesmo aparelho, uma de cada vez.' },
];

const COLORS: { id: ColorChoice; title: string; img: string }[] = [
  { id: 'white', title: 'Brancas', img: 'wk' },
  { id: 'black', title: 'Pretas', img: 'bk' },
  { id: 'random', title: 'Sorteio', img: 'wq' },
];

function levelHint(level: number): string {
  const p = levelProfile(level);
  const time = (p.timeMs / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  const depth = level >= LEVEL_MAX ? 'o mais fundo que der' : `${p.depth} ${p.depth === 1 ? 'lance' : 'lances'} à frente`;
  const extras = [p.noise ? 'erra a avaliação de propósito' : '', p.blunder >= 0.01 ? `${Math.round(p.blunder * 100)}% de lances sem pensar` : '']
    .filter(Boolean)
    .join(', ');
  return `Pensa até ${time} s, ${depth}${extras ? `; ${extras}` : ''}.`;
}

export function Menu({ initial, onStart }: Props) {
  const [s, setS] = useState<Settings>(initial);
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => setS((prev) => ({ ...prev, [key]: value }));
  const setLevel = (v: number) => set('level', clampLevel(v));

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onStart({ ...s, names: [s.names[0].trim() || 'Jogador 1', s.names[1].trim() || 'Jogador 2'] });
  };

  return (
    <main className="menu">
      <header className="menu-header">
        <div className="logo-row" aria-hidden="true">
          <img src={assetUrl('wk')} alt="" />
          <img src={assetUrl('bn')} alt="" />
          <img src={assetUrl('wq')} alt="" />
        </div>
        <h1>XADREZ PAULISTANO</h1>
        <p>Um tabuleiro de calçada paulistana em frente à Catedral da Sé.</p>
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
          <>
            <fieldset>
              <legend>Força do computador</legend>
              <div className="level">
                <div className="level-head">
                  <output htmlFor="xadrez-level" className="level-num">
                    {s.level}
                  </output>
                  <span className="level-name">{levelLabel(s.level)}</span>
                </div>
                <div className="level-row">
                  <button type="button" className="level-step" onClick={() => setLevel(s.level - 1)} aria-label="Diminuir nível">
                    −
                  </button>
                  <input
                    id="xadrez-level"
                    type="range"
                    min={LEVEL_MIN}
                    max={LEVEL_MAX}
                    step={1}
                    value={s.level}
                    aria-valuetext={`${s.level}, ${levelLabel(s.level)}`}
                    onChange={(e) => setLevel(Number(e.target.value))}
                    style={{ '--fill': `${((s.level - LEVEL_MIN) / (LEVEL_MAX - LEVEL_MIN)) * 100}%` } as CSSProperties}
                  />
                  <button type="button" className="level-step" onClick={() => setLevel(s.level + 1)} aria-label="Aumentar nível">
                    +
                  </button>
                </div>
                <div className="level-scale" aria-hidden="true">
                  <span>1 · Iniciante</span>
                  <span>100 · Mestre</span>
                </div>
                <p className="level-hint">{levelHint(s.level)}</p>
              </div>
            </fieldset>

            <fieldset>
              <legend>Suas peças</legend>
              <div className="cards cards-3">
                {COLORS.map((c) => (
                  <label key={c.id} className={`card card-piece ${s.color === c.id ? 'selected' : ''}`}>
                    <input type="radio" name="color" value={c.id} checked={s.color === c.id} onChange={() => set('color', c.id)} />
                    {c.id === 'random' ? (
                      <span className="piece-pair" aria-hidden="true">
                        <img src={assetUrl('wk')} alt="" />
                        <img src={assetUrl('bk')} alt="" />
                      </span>
                    ) : (
                      <img src={assetUrl(c.img)} alt="" aria-hidden="true" />
                    )}
                    <span className="card-title">{c.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </>
        )}

        <fieldset>
          <legend>Jogadores</legend>
          <div className="row">
            <label className="field">
              <span>{s.mode === 'pvp' ? 'Brancas' : 'Seu nome'}</span>
              <input value={s.names[0]} maxLength={14} onChange={(e) => set('names', [e.target.value, s.names[1]])} />
            </label>
            {s.mode === 'pvp' && (
              <label className="field">
                <span>Pretas</span>
                <input value={s.names[1]} maxLength={14} onChange={(e) => set('names', [s.names[0], e.target.value])} />
              </label>
            )}
          </div>
          {s.mode === 'pvp' && (
            <label className="check">
              <input type="checkbox" checked={s.autoFlip} onChange={(e) => set('autoFlip', e.target.checked)} />
              <span>Girar o tabuleiro para quem vai jogar</span>
            </label>
          )}
        </fieldset>

        <button type="submit" className="start">
          Jogar
        </button>
      </form>
    </main>
  );
}
