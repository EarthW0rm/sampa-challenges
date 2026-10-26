import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { assetUrl, type Assets } from '../game/assets';
import { H, HEAT_MAX, W } from '../game/constants';
import { e2eSeed } from '../../../shared/e2e/hook';
import { exposeFuga } from '../game/e2eHook';
import { FugaEngine } from '../game/engine';
import { SCALE } from '../game/hires';
import { Input } from '../game/input';
import { mapById } from '../game/maps';
import { sfx } from '../game/sound';
import type { Dir, HudState, JobKind, MapId } from '../game/types';

interface Props {
  assets: Assets;
  mapId: MapId;
  onExit: () => void;
}

const KEYS = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyX', 'KeyZ', 'KeyE'];
const KIND_LABEL: Record<JobKind, string> = { normal: 'Pedido', fragil: 'Frágil', urgente: 'Urgente', pesado: 'Pesado' };
const fmt = (n: number) => n.toLocaleString('pt-BR');

export function GameScreen({ assets, mapId, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<FugaEngine | null>(null);
  const inputRef = useRef(new Input());
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [showOver, setShowOver] = useState(false);
  const [muted, setMuted] = useState(sfx.isMuted());
  const map = mapById(mapId);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    // nos testes a semente segue o Math.random semeado (fora deles, e2eSeed() = undefined: semente da hora)
    const engine = new FugaEngine(assets, inputRef.current, setHud, mapId, e2eSeed());
    engineRef.current = engine;
    const disposeHook = exposeFuga(engine);
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      engine.update(Math.max(0, Math.min((now - last) / 1000, 0.1)));
      last = now;
      engine.render(ctx);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      disposeHook();
      engine.dispose();
      engineRef.current = null;
    };
  }, [assets, mapId]);

  useEffect(() => {
    const input = inputRef.current;
    const down = (e: KeyboardEvent) => {
      sfx.unlock();
      const engine = engineRef.current;
      if (e.code === 'KeyP' || e.code === 'Escape') {
        if (engine) engine.setPaused(!engine.isPaused);
        e.preventDefault();
        return;
      }
      if (KEYS.includes(e.code)) {
        if (!e.repeat || e.code.startsWith('Arrow') || e.code.startsWith('Key')) input.keyDown(e.code);
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => input.keyUp(e.code);
    const blur = () => {
      input.clear();
      engineRef.current?.setPaused(true);
    };
    const unlock = () => sfx.unlock();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    window.addEventListener('pointerdown', unlock);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      window.removeEventListener('pointerdown', unlock);
    };
  }, []);

  useEffect(() => {
    if (hud?.phase !== 'over') {
      setShowOver(false);
      return;
    }
    const t = setTimeout(() => setShowOver(true), 900);
    return () => clearTimeout(t);
  }, [hud?.phase]);

  const setDir = (d: Dir) => (e: ReactPointerEvent) => {
    e.preventDefault();
    inputRef.current.want = d;
  };
  const onStageDown = (e: ReactPointerEvent) => {
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onStageMove = (e: ReactPointerEvent) => {
    const s = swipe.current;
    if (!s || e.pointerType === 'mouse') return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    inputRef.current.want = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 0 : 2) : dy > 0 ? 1 : 3;
    swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onStageUp = () => {
    swipe.current = null;
  };
  const turbo = (on: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    inputRef.current.touchTurbo = on;
  };

  const restart = () => {
    setShowOver(false);
    engineRef.current?.restart();
  };
  const toggleMute = () => {
    sfx.setMuted(!sfx.isMuted());
    setMuted(sfx.isMuted());
  };

  const paused = hud?.phase === 'paused';
  const over = hud?.phase === 'over';

  return (
    <main className="game">
      <nav className="game-bar">
        <button type="button" onClick={onExit}>
          ← Mapas
        </button>
        <span className="map-title" style={{ color: map.accent }}>
          {map.name}
        </span>
        <span className="bar-actions">
          <button type="button" onClick={toggleMute} aria-pressed={muted}>
            {muted ? 'Som: não' : 'Som: sim'}
          </button>
          <button type="button" onClick={() => engineRef.current?.setPaused(!paused)} disabled={over} aria-pressed={paused}>
            {paused ? 'Continuar' : 'Pausar'}
          </button>
        </span>
      </nav>

      {hud && (
        <section className="hud" aria-label="Painel">
          <div className="hud-row">
            <span className="hud-score">{fmt(hud.score)}</span>
            <span className={hud.newRecord ? 'hud-rec new' : 'hud-rec'}>{hud.newRecord ? 'NOVO RECORDE' : `REC ${fmt(hud.record)}`}</span>
            <span className="hearts" aria-label={`${hud.lives} vidas`}>
              {Array.from({ length: Math.max(3, hud.lives) }, (_, i) => (
                <img key={i} src={assetUrl(i < hud.lives ? 'coracao_cheio' : 'coracao_vazio')} alt="" />
              ))}
            </span>
          </div>
          <div className="hud-row">
            <span className="stars" aria-label={`Procurado: ${hud.stars} estrelas`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <i key={n} className={n <= hud.stars ? 'on' : ''}>
                  ★
                </i>
              ))}
            </span>
            <span className="meter heat" title="Procurado">
              <b style={{ width: `${(hud.heat / HEAT_MAX) * 100}%` }} />
            </span>
            <span className={hud.turboLocked ? 'meter turbo locked' : 'meter turbo'} title="Turbo">
              <b style={{ width: `${hud.turbo * 100}%` }} />
            </span>
            <span className="chips">
              <span className={hud.shield ? 'chip on' : 'chip'}>
                <img src={assetUrl('capacete_hud')} alt="" /> {hud.shield ? 'escudo' : '–'}
              </span>
              <span className={hud.oil > 0 ? 'chip on' : 'chip'}>
                <img src={assetUrl('item_oleo')} alt="" /> ×{hud.oil}
              </span>
            </span>
          </div>
          <div className="hud-row job">
            {hud.job ? (
              <span className={`job-tag ${hud.job.kind}`}>
                {KIND_LABEL[hud.job.kind]} · {hud.job.stage === 'pickup' ? 'ir buscar' : 'entregar'}
                {hud.job.timeLeft !== null && hud.job.stage === 'drop' && <b className={hud.job.timeLeft <= 5 ? 'late' : ''}> · {hud.job.timeLeft}s</b>}
              </span>
            ) : (
              <span className="job-tag">Aguardando pedido…</span>
            )}
            <span className="deliveries">Entregas: {hud.deliveries}</span>
            <span className={hud.hidden ? 'msg hide' : 'msg'} role="status">
              {hud.hidden ? `Escondido · ${hud.hideLeft}s` : hud.message}
            </span>
          </div>
        </section>
      )}

      <div
        className="stage"
        onPointerDown={onStageDown}
        onPointerMove={onStageMove}
        onPointerUp={onStageUp}
        onPointerCancel={onStageUp}
        style={{ touchAction: 'none' }}
      >
        <canvas ref={canvasRef} width={W * SCALE} height={H * SCALE} aria-label={`Mapa ${map.name}`} />

        {hud?.phase === 'ready' && !paused && (
          <div className="hint" aria-hidden="true">
            Aperte uma <b>seta</b> (ou deslize) para sair
          </div>
        )}

        {paused && (
          <div className="overlay" role="dialog" aria-label="Pausa">
            <div className="overlay-box">
              <h2>PAUSA</h2>
              <div className="overlay-actions">
                <button type="button" className="primary" onClick={() => engineRef.current?.setPaused(false)} autoFocus>
                  Continuar
                </button>
                <button type="button" onClick={onExit}>
                  Mapas
                </button>
              </div>
            </div>
          </div>
        )}

        {showOver && hud && (
          <div className="overlay" role="dialog" aria-label="Fim de jogo">
            <div className="overlay-box">
              <h2>PEGO PELA ROCAM</h2>
              <p className="final-score">{fmt(hud.score)} pontos</p>
              <p className="final-record">
                {hud.deliveries} entrega{hud.deliveries === 1 ? '' : 's'} · {hud.newRecord ? 'Novo recorde!' : `Recorde: ${fmt(hud.record)}`}
              </p>
              <div className="overlay-actions">
                <button type="button" className="primary" onClick={restart} autoFocus>
                  Jogar de novo
                </button>
                <button type="button" onClick={onExit}>
                  Mapas
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="touch-controls" aria-label="Controles de toque">
        <div className="dpad">
          <button type="button" className="up" aria-label="Cima" onPointerDown={setDir(3)}>
            ▲
          </button>
          <button type="button" className="left" aria-label="Esquerda" onPointerDown={setDir(2)}>
            ◀
          </button>
          <button type="button" className="right" aria-label="Direita" onPointerDown={setDir(0)}>
            ▶
          </button>
          <button type="button" className="down" aria-label="Baixo" onPointerDown={setDir(1)}>
            ▼
          </button>
        </div>
        <div className="act">
          <button
            type="button"
            className="turbo-btn"
            onPointerDown={turbo(true)}
            onPointerUp={turbo(false)}
            onPointerCancel={turbo(false)}
            onPointerLeave={turbo(false)}
          >
            TURBO
          </button>
          <button type="button" className="oil-btn" onPointerDown={() => inputRef.current.pressOil()}>
            ÓLEO
          </button>
        </div>
      </div>
      <p className="keys-help">Setas/WASD: direção · Espaço: turbo · X: óleo · P: pausa</p>
    </main>
  );
}
