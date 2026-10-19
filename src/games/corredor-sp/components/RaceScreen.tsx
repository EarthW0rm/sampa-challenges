import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Assets } from '../game/assets';
import { H, W } from '../game/constants';
import { CorredorEngine, type HudState, type RaceConfig } from '../game/engine';
import { Input } from '../game/input';
import { sfx } from '../game/sound';

interface Props {
  assets: Assets;
  config: RaceConfig;
  onBack: () => void;
}

const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyA', 'KeyD', 'KeyW', 'KeyS', 'Space', 'KeyX', 'Enter', 'NumpadEnter'];

export function RaceScreen({ assets, config, onBack }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CorredorEngine | null>(null);
  const inputRef = useRef(new Input());
  const [hud, setHud] = useState<HudState | null>(null);
  const [showOver, setShowOver] = useState(false);
  const [run, setRun] = useState(0);
  const [muted, setMuted] = useState(sfx.isMuted());

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    inputRef.current.clear();
    // no celular a moto acelera sozinha
    inputRef.current.autoAccel = window.matchMedia?.('(pointer: coarse)').matches ?? false;
    const engine = new CorredorEngine(assets, config, inputRef.current, setHud);
    engineRef.current = engine;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      engine.update((now - last) / 1000);
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
  }, [assets, config, run]);

  useEffect(() => {
    const input = inputRef.current;
    const down = (e: KeyboardEvent) => {
      sfx.unlock();
      if (e.code === 'KeyP' || e.code === 'Escape') {
        const en = engineRef.current;
        if (en) en.setPaused(!en.isPaused);
        e.preventDefault();
        return;
      }
      if (KEYS.includes(e.code)) {
        input.keyDown(e.code);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => input.keyUp(e.code);
    const blur = () => engineRef.current?.setPaused(true);
    const unlock = () => sfx.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  useEffect(() => {
    if (hud?.phase !== 'over') {
      setShowOver(false);
      return;
    }
    const t = setTimeout(() => setShowOver(true), 1500);
    return () => clearTimeout(t);
  }, [hud?.phase]);

  const hold = (k: 'left' | 'right' | 'brake' | 'grau', on: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    inputRef.current.autoAccel = true;
    inputRef.current.touch[k] = on;
  };
  const touchBtn = (k: 'left' | 'right' | 'brake' | 'grau', label: string, cls: string) => (
    <button
      type="button"
      className={`tbtn ${cls}`}
      aria-label={label}
      onPointerDown={hold(k, true)}
      onPointerUp={hold(k, false)}
      onPointerCancel={hold(k, false)}
      onPointerLeave={hold(k, false)}
    >
      {label}
    </button>
  );

  const paused = hud?.paused ?? false;
  const fmt = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return (
    <main className="race">
      <nav className="race-bar">
        <button type="button" onClick={onBack}>
          ← Trocar moto ou pista
        </button>
        <button
          type="button"
          onClick={() => {
            sfx.setMuted(!sfx.isMuted());
            setMuted(sfx.isMuted());
          }}
          aria-pressed={muted}
        >
          {muted ? 'Som: não' : 'Som: sim'}
        </button>
        <button type="button" onClick={() => engineRef.current?.setPaused(!paused)} disabled={hud?.phase === 'over'} aria-pressed={paused}>
          {paused ? 'Continuar' : 'Pausar'}
        </button>
      </nav>

      <div className="stage">
        <canvas ref={canvasRef} width={W} height={H} aria-label="Avenida com trânsito vista de trás da moto" />

        <div className="touch" aria-hidden="true">
          <div className="touch-left">
            {touchBtn('left', '◀', 'dir')}
            {touchBtn('right', '▶', 'dir')}
          </div>
          <div className="touch-right">
            {touchBtn('brake', 'FREIO', 'act')}
            {touchBtn('grau', 'GRAU', 'act')}
            <button
              type="button"
              className="tbtn act"
              aria-label="Capacete"
              onPointerDown={(e) => {
                e.preventDefault();
                inputRef.current.autoAccel = true;
                inputRef.current.queueThrow();
              }}
            >
              CAPACETE
            </button>
          </div>
        </div>

        {paused && (
          <div className="overlay" role="dialog" aria-label="Pausa">
            <div className="overlay-box">
              <h2>PAUSA</h2>
              <div className="overlay-actions">
                <button type="button" className="primary" onClick={() => engineRef.current?.setPaused(false)} autoFocus>
                  Continuar
                </button>
                <button type="button" onClick={onBack}>
                  Trocar moto ou pista
                </button>
              </div>
            </div>
          </div>
        )}

        {showOver && hud && (
          <div className="overlay" role="dialog" aria-label="Fim de turno">
            <div className="overlay-box">
              <h2>FIM DE TURNO</h2>
              <p className="final-points">{hud.points} pontos</p>
              <p className="final-detail">
                ({fmt(hud.time)} na pista + {hud.meters} m rodados) × (1 + {hud.packages} pacotes) · {hud.overtakes} ultrapassagens
              </p>
              <p className="final-detail">{hud.newRecord ? 'Novo recorde nesta pista!' : `Recorde da pista: ${hud.record}`}</p>
              <div className="overlay-actions">
                <button
                  type="button"
                  className="primary"
                  autoFocus
                  onClick={() => {
                    setShowOver(false);
                    setRun((r) => r + 1);
                  }}
                >
                  Correr de novo
                </button>
                <button type="button" onClick={onBack}>
                  Trocar moto ou pista
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
