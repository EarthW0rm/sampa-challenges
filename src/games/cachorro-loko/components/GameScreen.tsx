import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { assetUrl, type Assets, type AssetKey } from '../game/assets';
import { H, MAX_LIVES, W } from '../game/constants';
import { exposeCachorroLoko } from '../game/e2eHook';
import { CachorroLokoEngine } from '../game/engine';
import { SCALE } from '../game/hires';
import { Input } from '../game/input';
import type { HudState, PowerKind } from '../game/types';

interface Props {
  assets: Assets;
  onExit: () => void;
}

const POWER_INFO: Record<PowerKind, { icon: AssetKey; label: string }> = {
  turbo: { icon: 'turbo', label: 'Turbo' },
  grau: { icon: 'grau', label: 'Grau' },
  ima: { icon: 'ima', label: 'Ímã' },
  dobro: { icon: 'dobro', label: '×2' },
};

const pad = (n: number) => String(n).padStart(3, '0');

export function GameScreen({ assets, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<CachorroLokoEngine | null>(null);
  const inputRef = useRef(new Input());
  const [hud, setHud] = useState<HudState | null>(null);
  const [showOver, setShowOver] = useState(false);

  // motor + laço de animação
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    const engine = new CachorroLokoEngine(assets, inputRef.current, setHud);
    engineRef.current = engine;
    // gancho dos testes de ponta a ponta (inerte para o jogador)
    const disposeE2E = exposeCachorroLoko(engine, () => canvasRef.current?.parentElement ?? null);
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
      disposeE2E();
      cancelAnimationFrame(raf);
      engineRef.current = null;
    };
  }, [assets]);

  // teclado
  useEffect(() => {
    const input = inputRef.current;
    const down = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (engine) engine.setPaused(!engine.isPaused);
        e.preventDefault();
        return;
      }
      if (['ArrowLeft', 'ArrowRight', 'KeyA', 'KeyD'].includes(e.code)) {
        input.keyDown(e.code);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => input.keyUp(e.code);
    const blur = () => engineRef.current?.setPaused(true);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  // tela de fim de jogo com um pequeno atraso para ver o cachorro tonto
  useEffect(() => {
    if (hud?.phase !== 'over') {
      setShowOver(false);
      return;
    }
    const t = setTimeout(() => setShowOver(true), 1200);
    return () => clearTimeout(t);
  }, [hud?.phase]);

  const touch = (side: 'left' | 'right', on: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    if (side === 'left') inputRef.current.touchLeft = on;
    else inputRef.current.touchRight = on;
  };

  const restart = () => {
    setShowOver(false);
    engineRef.current?.restart();
  };

  const paused = hud?.phase === 'paused';

  return (
    <main className="game">
      <nav className="game-bar">
        <button type="button" onClick={onExit}>
          ← Menu
        </button>
        {hud && <span className="level">Nível {hud.level}</span>}
        <button
          type="button"
          onClick={() => engineRef.current?.setPaused(!paused)}
          disabled={hud?.phase === 'over'}
          aria-pressed={paused}
        >
          {paused ? 'Continuar' : 'Pausar'}
        </button>
      </nav>

      <div className="stage">
        <canvas ref={canvasRef} width={W * SCALE} height={H * SCALE} aria-label="Rua com o restaurante, as esteiras e o cachorro motoboy" />

        {hud && (
          <>
            <div className="hud-left">
              <div className="lives" aria-label={`${hud.lives} vidas`}>
                {Array.from({ length: Math.max(3, Math.min(MAX_LIVES, hud.lives)) }, (_, i) => (
                  <img key={i} src={assetUrl(i < hud.lives ? 'coracao_cheio' : 'coracao_vazio')} alt="" />
                ))}
              </div>
              <div className="powers">
                {(Object.keys(hud.powers) as PowerKind[]).map((k) => (
                  <div key={k} className="power">
                    <img src={assetUrl(POWER_INFO[k].icon)} alt="" />
                    <span>
                      {POWER_INFO[k].label} {hud.powers[k]}s
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div className="hud-right">
              <div className="score">ENTREGAS {pad(hud.score)}</div>
              <div className="record">{hud.newRecord ? 'NOVO RECORDE!' : `RECORDE ${pad(hud.record)}`}</div>
            </div>
          </>
        )}

        <div className="touch-zones" aria-hidden="true">
          <div
            className="touch left"
            onPointerDown={touch('left', true)}
            onPointerUp={touch('left', false)}
            onPointerCancel={touch('left', false)}
            onPointerLeave={touch('left', false)}
          >
            <span>◀</span>
          </div>
          <div
            className="touch right"
            onPointerDown={touch('right', true)}
            onPointerUp={touch('right', false)}
            onPointerCancel={touch('right', false)}
            onPointerLeave={touch('right', false)}
          >
            <span>▶</span>
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
                <button type="button" onClick={onExit}>
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}

        {showOver && hud && (
          <div className="overlay" role="dialog" aria-label="Fim de jogo">
            <div className="overlay-box">
              <h2>FIM DO TURNO</h2>
              <p className="final-score">{hud.score} entregas</p>
              <p className="final-record">{hud.newRecord ? 'Novo recorde!' : `Recorde: ${hud.record}`}</p>
              <div className="overlay-actions">
                <button type="button" className="primary" onClick={restart} autoFocus>
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
    </main>
  );
}
