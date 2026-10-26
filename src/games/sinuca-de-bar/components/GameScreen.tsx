import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';
import { LEVELS } from '../game/ai';
import type { Assets } from '../game/assets';
import { H, W } from '../game/constants';
import { exposeSinuca } from '../game/e2eHook';
import { SinucaEngine } from '../game/engine';
import { SCALE } from '../game/hires';
import { RULES } from '../game/rules';
import { sfx } from '../game/sound';
import type { HudState, Settings } from '../game/types';

interface Props {
  assets: Assets;
  settings: Settings;
  onExit: () => void;
}

export function GameScreen({ assets, settings, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SinucaEngine | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [muted, setMuted] = useState(() => sfx.isMuted());
  const [showOver, setShowOver] = useState(false);
  const [confirmNew, setConfirmNew] = useState(false);

  // motor + laço de animação
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    const engine = new SinucaEngine(assets, settings, setHud);
    engineRef.current = engine;
    const disposeE2E = exposeSinuca(engine);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      engine.update(Math.max(0, Math.min((now - last) / 1000, 0.05)));
      last = now;
      engine.render(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      disposeE2E();
      engine.dispose();
      engineRef.current = null;
    };
  }, [assets, settings]);

  // teclado (setas, Espaço/Enter, WASD com bola na mão) e desbloqueio do áudio
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx.unlock();
      const target = e.target as HTMLElement | null;
      const onControl = !!target?.closest('button, input, select, a');
      if (onControl && (e.code === 'Enter' || e.code === 'Space')) return;
      if (onControl && target?.matches('input[type="range"]') && e.code.startsWith('Arrow')) return;
      if (engineRef.current?.keyDown(e.code, e.shiftKey)) e.preventDefault();
    };
    const unlock = () => sfx.unlock();
    window.addEventListener('keydown', down);
    window.addEventListener('pointerdown', unlock);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('pointerdown', unlock);
    };
  }, []);

  const winner = hud?.winner ?? null;
  useEffect(() => {
    setShowOver(winner !== null);
    setConfirmNew(false);
  }, [winner]);

  // o botão de confirmação volta ao normal se ninguém clicar
  useEffect(() => {
    if (!confirmNew) return;
    const t = setTimeout(() => setConfirmNew(false), 3000);
    return () => clearTimeout(t);
  }, [confirmNew]);

  const toLogical = (e: ReactPointerEvent<HTMLCanvasElement>): [number, number] => {
    const r = e.currentTarget.getBoundingClientRect();
    return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H];
  };
  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    engineRef.current?.pointerDown(...toLogical(e));
  };
  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => engineRef.current?.pointerMove(...toLogical(e));
  const onPointerUp = () => engineRef.current?.pointerUp();

  const toggleSound = () => {
    sfx.unlock();
    sfx.setMuted(!muted);
    setMuted(!muted);
  };

  const engine = engineRef.current;
  const canShoot = !!hud?.canShoot;
  const power = hud?.power ?? 0;

  const newGame = () => {
    if (winner === null && !confirmNew) return setConfirmNew(true);
    setConfirmNew(false);
    engine?.restart();
  };

  const rules = RULES[settings.rules];
  const mode = settings.mode === 'pvc' ? `Contra o computador (${LEVELS[settings.level].label})` : '2 jogadores';
  const turnName = hud ? hud.players[hud.turn].name : '';

  let status = '';
  if (hud && winner === null) {
    if (hud.thinking) status = `${turnName} está mirando…`;
    else if (hud.canShoot) status = hud.ballInHand ? `${turnName} tem bola na mão: posicione a branca e dê a tacada.` : `Vez de ${turnName}.`;
    else status = 'Bolas rolando…';
  }

  return (
    <main className="game">
      <nav className="game-bar">
        <button type="button" onClick={onExit}>
          ← Menu
        </button>
        <span className="mode-label">
          {mode} · {rules.names.A} × {rules.names.B} · mata a {rules.castigo}
        </span>
        <button type="button" onClick={toggleSound} aria-pressed={!muted} title="Ligar/desligar os efeitos sonoros">
          Som: {muted ? 'desligado' : 'ligado'}
        </button>
      </nav>

      <div className="stage">
        <canvas
          ref={canvasRef}
          width={W * SCALE}
          height={H * SCALE}
          aria-label="Mesa de sinuca. Toque ou arraste na mesa para mirar; com bola na mão, arraste a branca."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />

        {hud && winner !== null && showOver && (
          <div className="overlay" role="dialog" aria-label="Fim de partida">
            <div className="overlay-box">
              <h2>{hud.players[winner].cpu ? 'O computador venceu!' : `${hud.players[winner].name} venceu!`}</h2>
              <p>{hud.endReason}</p>
              <p className="score">
                Placar: {hud.players[0].name} {hud.players[0].wins} × {hud.players[1].wins} {hud.players[1].name}
              </p>
              <div className="overlay-actions">
                <button type="button" className="primary" onClick={() => engine?.restart()} autoFocus>
                  Jogar de novo
                </button>
                <button type="button" onClick={() => setShowOver(false)}>
                  Ver mesa
                </button>
                <button type="button" onClick={onExit}>
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <p className="status" aria-live="polite">
        {status}
      </p>

      <div className="controls">
        <div className="aim-buttons">
          <button type="button" onClick={() => engine?.rotate(-1)} disabled={!canShoot} aria-label="Girar a mira para a esquerda">
            ◀
          </button>
          <button type="button" onClick={() => engine?.rotate(-0.2)} disabled={!canShoot} aria-label="Ajuste fino para a esquerda">
            ‹
          </button>
          <button type="button" onClick={() => engine?.rotate(0.2)} disabled={!canShoot} aria-label="Ajuste fino para a direita">
            ›
          </button>
          <button type="button" onClick={() => engine?.rotate(1)} disabled={!canShoot} aria-label="Girar a mira para a direita">
            ▶
          </button>
        </div>
        <label className="power">
          <span>Força {Math.round(power * 100)}%</span>
          <input
            type="range"
            min={5}
            max={100}
            step={1}
            value={Math.round(power * 100)}
            onChange={(e) => engine?.setPower(Number(e.target.value) / 100)}
            style={{ '--fill': `${((power * 100 - 5) / 95) * 100}%` } as CSSProperties}
          />
        </label>
        <button type="button" className="primary shoot" onClick={() => engine?.shoot()} disabled={!canShoot}>
          Tacar!
        </button>
      </div>

      <div className="controls">
        <button type="button" onClick={newGame} className={confirmNew ? 'danger' : ''}>
          {confirmNew ? 'Abandonar esta partida?' : 'Nova partida'}
        </button>
      </div>

      <p className="hint">
        Toque ou arraste na mesa para mirar (a linha amarela mostra para onde a bola vai; vermelha = bola que não pode ser tocada
        primeiro). Ajuste a força e clique em Tacar. Teclado: ←/→ mira (Shift = fino), ↑/↓ força, Espaço tacada, WASD move a branca
        com bola na mão.
      </p>
    </main>
  );
}
