import { useEffect, useRef, useState } from 'react';
import type { Assets } from '../game/assets';
import { ANGLE_MAX, ANGLE_MIN, H, VELOCITY_MAX, VELOCITY_MIN, W } from '../game/constants';
import { CapaceteEngine, type HudState } from '../game/engine';
import { SCALE } from '../game/hires';
import { sfx } from '../game/sound';
import type { PlayerIndex, Settings } from '../game/types';
import { AimForm } from './AimForm';

interface Props {
  assets: Assets;
  settings: Settings;
  onExit: () => void;
}

export function GameScreen({ assets, settings, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CapaceteEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [muted, setMuted] = useState(() => sfx.isMuted());

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const engine = new CapaceteEngine(assets, settings, setHud);
    engineRef.current = engine;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      engine.update(now - last);
      last = now;
      engine.render(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      engine.dispose();
      engineRef.current = null;
    };
  }, [assets, settings]);

  // o navegador só libera o áudio depois de um gesto do jogador
  useEffect(() => {
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const toggleSound = () => {
    sfx.unlock();
    sfx.setMuted(!muted);
    setMuted(!muted);
  };

  const engine = engineRef.current;
  const names = settings.names;
  const practice = settings.mode === 'practice';

  const panel = (p: PlayerIndex) => {
    if (!hud || !engine) return null;
    const active = hud.turn === p && (hud.phase === 'aiming' || hud.phase === 'thinking');
    const human = engine.isHuman(p);
    return (
      <section className={`player-panel ${p === 0 ? 'left' : 'right'} ${active ? 'active' : ''}`} aria-live="polite">
        <h2>{names[p]}</h2>
        <div className="moto-hp" aria-label={`Moto: ${Math.max(0, 3 - hud.damage[p])} de 3`}>
          MOTO{' '}
          {[0, 1, 2].map((i) => (
            <span key={i} className={i < 3 - hud.damage[p] ? 'pip on' : 'pip'} />
          ))}
        </div>
        {active && human && hud.phase === 'aiming' && (
          <AimForm
            key={`${hud.round}-${p}-${hud.practiceShots}-${hud.scores.join()}`}
            initial={hud.lastShots[p]}
            onFire={(shot) => engine.submitShot(shot)}
          />
        )}
        {active && !human && (
          <div className="computer-shot">
            {hud.computerShot ? (
              <>
                <div>Ângulo: {hud.computerShot.angle}</div>
                <div>Velocidade: {hud.computerShot.velocity}</div>
              </>
            ) : (
              <div className="thinking">Mirando…</div>
            )}
          </div>
        )}
        {!active && hud.lastShots[p] && (
          <div className="last-shot">
            Último: {hud.lastShots[p]!.angle}° / {hud.lastShots[p]!.velocity}
          </div>
        )}
      </section>
    );
  };

  const windText = hud ? (hud.wind === 0 ? 'sem vento' : `${hud.wind > 0 ? '→' : '←'} ${Math.abs(hud.wind)}`) : '';
  const gameOver = hud?.phase === 'gameOver';
  const champion = hud ? (hud.scores[0] > hud.scores[1] ? 0 : 1) : 0;

  return (
    <main className="game">
      <nav className="game-bar">
        <button type="button" onClick={onExit}>
          ← Menu
        </button>
        <span className="mode-label">
          {settings.mode === 'pvp' && '2 jogadores'}
          {settings.mode === 'pvc' &&
            `Contra o computador · ${{ facil: 'fácil', medio: 'médio', dificil: 'difícil' }[settings.difficulty]}`}
          {practice && 'Treino'}
          {hud && ` · rodada ${hud.round}`}
        </span>
        <span className="bar-actions">
          <button type="button" onClick={toggleSound} aria-pressed={!muted} title="Ligar/desligar os efeitos sonoros">
            Som: {muted ? 'desligado' : 'ligado'}
          </button>
          <button type="button" onClick={() => engine?.restart()}>
            Reiniciar
          </button>
        </span>
      </nav>

      <div className="stage">
        <canvas ref={canvasRef} width={W * SCALE} height={H * SCALE} aria-label="Campo de batalha sobre os prédios de São Paulo" />
        {panel(0)}
        {panel(1)}

        {hud && (
          <div className="scoreboard">
            {practice ? (
              <span>
                Tiros {hud.practiceShots} · Acertos {hud.practiceHits}
              </span>
            ) : (
              <span>
                {hud.scores[0]} &gt;Placar&lt; {hud.scores[1]}
              </span>
            )}
            <span className="wind">Vento {windText}</span>
          </div>
        )}

        {hud?.message && !gameOver && <div className="banner">{hud.message}</div>}

        {gameOver && hud && (
          <div className="overlay" role="dialog" aria-label="Fim de jogo">
            <div className="overlay-box">
              <h2>{names[champion]} venceu!</h2>
              <p>
                {hud.scores[0]} × {hud.scores[1]}
              </p>
              <div className="overlay-actions">
                <button type="button" onClick={() => engine?.restart()}>
                  Jogar de novo
                </button>
                <button type="button" onClick={onExit}>
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="hint">
        Digite ângulo ({ANGLE_MIN}–{ANGLE_MAX}) e velocidade ({VELOCITY_MIN}–{VELOCITY_MAX}) e pressione Enter. Ângulos acima
        de 90 lançam para trás. Acertar o piloto vence a rodada; a moto aguenta 3 acertos.
      </p>
    </main>
  );
}
