import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { assetUrl, type Assets } from '../game/assets';
import { H, W } from '../game/constants';
import { exposePinball } from '../game/e2eHook';
import { PinballEngine } from '../game/engine';
import { SCALE } from '../game/hires';
import { Input } from '../game/input';
import { sfx } from '../game/sound';
import type { HudState } from '../game/types';

interface Props {
  assets: Assets;
  onExit: () => void;
}

const LETTERS = ['M', 'O', 'T', 'O', 'B', 'O', 'Y'];
const KEYS = ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'KeyZ', 'Slash', 'Space', 'KeyA', 'KeyD'];

const fmt = (n: number) => n.toLocaleString('pt-BR');

export function GameScreen({ assets, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PinballEngine | null>(null);
  const inputRef = useRef(new Input());
  const [hud, setHud] = useState<HudState | null>(null);
  const [showOver, setShowOver] = useState(false);
  const [muted, setMuted] = useState(sfx.isMuted());

  // motor + laço de animação
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    const engine = new PinballEngine(assets, inputRef.current, setHud);
    engineRef.current = engine;
    const disposeHook = exposePinball(engine);
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
      disposeHook();
      engine.dispose();
      engineRef.current = null;
    };
  }, [assets]);

  // teclado
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
      if (e.code === 'KeyN') {
        if (!e.repeat) engine?.nudge();
        e.preventDefault();
        return;
      }
      if (KEYS.includes(e.code)) {
        input.keyDown(e.code);
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

  // fim de jogo com um pequeno atraso
  useEffect(() => {
    if (hud?.phase !== 'over') {
      setShowOver(false);
      return;
    }
    const t = setTimeout(() => setShowOver(true), 1000);
    return () => clearTimeout(t);
  }, [hud?.phase]);

  const hold = (key: 'touchLeft' | 'touchRight' | 'touchPlunger', on: boolean) => (e: ReactPointerEvent) => {
    e.preventDefault();
    inputRef.current[key] = on;
  };
  const holdProps = (key: 'touchLeft' | 'touchRight' | 'touchPlunger') => ({
    onPointerDown: hold(key, true),
    onPointerUp: hold(key, false),
    onPointerCancel: hold(key, false),
    onPointerLeave: hold(key, false),
  });

  // sair para o título: salva o recorde antes (o título lê o recorde ao renderizar, antes do cleanup do motor)
  const exitToTitle = () => {
    engineRef.current?.dispose();
    onExit();
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

  const status = hud && (
    <div className="chips">
      {hud.saver && <span className="chip chip-green">Segura-bola</span>}
      {hud.wave && <span className="chip chip-green">Onda verde</span>}
      {hud.multiball && <span className="chip chip-red">Multiball</span>}
      {hud.extra && <span className="chip chip-gold">Bola extra</span>}
      {hud.tilt && <span className="chip chip-red">Tilt</span>}
    </div>
  );

  return (
    <main className="game">
      <nav className="game-bar">
        <button type="button" onClick={exitToTitle}>
          ← Menu
        </button>
        {hud && (
          <span className="ballno">
            Bola {hud.ball}/{hud.ballsTotal}
          </span>
        )}
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
        <div className="strip" aria-hidden="true">
          <span className="strip-score">{fmt(hud.score)}</span>
          <span>×{hud.mult}</span>
          <span className="strip-rec">{hud.newRecord ? 'NOVO RECORDE' : `REC ${fmt(hud.record)}`}</span>
        </div>
      )}

      <div className="board">
        <aside className="side side-left">
          {hud && (
            <>
              <div className="panel">
                <h3>Bolas</h3>
                <div className="helmets" aria-label={`Bola ${hud.ball} de ${hud.ballsTotal}`}>
                  {Array.from({ length: hud.ballsTotal }, (_, i) => (
                    <img key={i} className={i < hud.ball - 1 ? 'used' : ''} src={assetUrl(i < hud.ball - 1 ? 'capacete_1' : 'capacete_0')} alt="" />
                  ))}
                </div>
              </div>
              <div className="panel">
                <h3>Multiplicador</h3>
                <div className="mult">×{hud.mult}</div>
                <div className="pips">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <i key={n} className={n <= hud.mult ? 'on' : ''} />
                  ))}
                </div>
              </div>
              <div className="panel">
                <h3>Motoboy</h3>
                <div className="letters">
                  {LETTERS.map((l, i) => (
                    <b key={i} className={hud.letters[i] ? 'on' : ''}>
                      {l}
                    </b>
                  ))}
                </div>
                <p className="small">7 letras = multiball</p>
              </div>
              <div className="panel">
                <h3>Semáforos</h3>
                <div className="pips">
                  {[0, 1, 2].map((n) => (
                    <i key={n} className={n < hud.greens ? 'on green' : ''} />
                  ))}
                </div>
                <p className="small">3 verdes = onda verde</p>
              </div>
            </>
          )}
        </aside>

        <div className="stage">
          <canvas ref={canvasRef} width={W * SCALE} height={H * SCALE} aria-label="Mesa de pinball da Avenida Paulista" />

          <div className="touch-zones" aria-hidden="true">
            <div className="touch left" {...holdProps('touchLeft')}>
              <span>◀</span>
            </div>
            <div className="touch right" {...holdProps('touchRight')}>
              <span>▶</span>
            </div>
          </div>

          {hud?.phase === 'ready' && !paused && (
            <div className="hint" aria-hidden="true">
              Segure <b>ESPAÇO</b> ou <b>LANÇAR</b> e solte
            </div>
          )}

          {hud?.bonus && (
            <div className="bonus" role="status">
              <h2>BÔNUS DA BOLA</h2>
              <p>
                {fmt(hud.bonus.base)} × {hud.bonus.mult}
              </p>
              <p className="bonus-total">{hud.bonus.total > 0 ? `+${fmt(hud.bonus.total)}` : hud.tilt ? 'TILT: sem bônus' : '+0'}</p>
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
                  <button type="button" onClick={exitToTitle}>
                    Menu
                  </button>
                </div>
              </div>
            </div>
          )}

          {showOver && hud && (
            <div className="overlay" role="dialog" aria-label="Fim de jogo">
              <div className="overlay-box">
                <h2>FIM DE JOGO</h2>
                <p className="final-score">{fmt(hud.score)} pontos</p>
                <p className="final-record">{hud.newRecord ? 'Novo recorde!' : `Recorde: ${fmt(hud.record)}`}</p>
                <div className="overlay-actions">
                  <button type="button" className="primary" onClick={restart} autoFocus>
                    Jogar de novo
                  </button>
                  <button type="button" onClick={exitToTitle}>
                    Menu
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <aside className="side side-right">
          {hud && (
            <>
              <div className="panel">
                <h3>Pontos</h3>
                <div className="score">{fmt(hud.score)}</div>
              </div>
              <div className="panel">
                <h3>Recorde</h3>
                <div className={hud.newRecord ? 'rec new' : 'rec'}>{hud.newRecord ? 'NOVO!' : fmt(hud.record)}</div>
              </div>
              <div className="panel">
                <h3>Status</h3>
                {status}
                {!hud.saver && !hud.wave && !hud.multiball && !hud.extra && !hud.tilt && <p className="small">–</p>}
              </div>
              <div className="panel keys">
                <h3>Teclas</h3>
                <p className="small">
                  ← / Z · → / /<br />
                  Espaço lança<br />
                  N sacode · P pausa
                </p>
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="actions">
        <button type="button" className="launch" {...holdProps('touchPlunger')}>
          Lançar (segure e solte)
        </button>
        <button type="button" onClick={() => engineRef.current?.nudge()}>
          Sacudir
        </button>
      </div>
    </main>
  );
}
