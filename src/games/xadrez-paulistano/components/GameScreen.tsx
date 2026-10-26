import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { assetUrl, pieceKey, type Assets } from '../game/assets';
import { BISHOP, type Color, KNIGHT, type Outcome, QUEEN, ROOK } from '../game/chess';
import { H, W } from '../game/constants';
import { exposeGame } from '../game/e2eHook';
import { XadrezEngine } from '../game/engine';
import { SCALE } from '../game/hires';
import { levelLabel } from '../game/levels';
import { sfx } from '../game/sound';
import type { HudState, Settings } from '../game/types';

interface Props {
  assets: Assets;
  settings: Settings;
  onExit: () => void;
}

const PROMOTIONS = [
  { type: QUEEN, label: 'Dama' },
  { type: ROOK, label: 'Torre' },
  { type: BISHOP, label: 'Bispo' },
  { type: KNIGHT, label: 'Cavalo' },
];

const COLOR_NAME = ['brancas', 'pretas'];

function outcomeText(o: Outcome, names: [string, string]): { title: string; detail: string } {
  switch (o.kind) {
    case 'checkmate':
      return { title: `${names[o.winner]} venceu!`, detail: `Xeque-mate das ${COLOR_NAME[o.winner]}.` };
    case 'resign':
      return { title: `${names[o.winner]} venceu!`, detail: `${names[o.winner ^ 1]} desistiu.` };
    case 'stalemate':
      return { title: 'Empate', detail: 'Afogamento: quem tem a vez não tem lance legal e não está em xeque.' };
    case 'fifty':
      return { title: 'Empate', detail: '50 lances de cada lado sem captura nem movimento de peão.' };
    case 'repetition':
      return { title: 'Empate', detail: 'A mesma posição se repetiu três vezes.' };
    case 'material':
      return { title: 'Empate', detail: 'Material insuficiente: ninguém consegue dar xeque-mate.' };
  }
}

export function GameScreen({ assets, settings, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<XadrezEngine | null>(null);
  const movesRef = useRef<HTMLOListElement>(null);
  const [hud, setHud] = useState<HudState | null>(null);
  const [muted, setMuted] = useState(() => sfx.isMuted());
  const [showOver, setShowOver] = useState(false);
  const [confirm, setConfirm] = useState<'resign' | 'new' | null>(null);

  // motor + laço de animação
  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    const engine = new XadrezEngine(assets, settings, setHud);
    engineRef.current = engine;
    const disposeHook = exposeGame(engine);
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
      disposeHook();
      engine.dispose();
      engineRef.current = null;
    };
  }, [assets, settings]);

  // teclado (setas, Enter/Espaço, Esc) e desbloqueio do áudio
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      sfx.unlock();
      const target = e.target as HTMLElement | null;
      const onControl = !!target?.closest('button, input, select, a');
      if (onControl && (e.code === 'Enter' || e.code === 'Space')) return;
      if (engineRef.current?.keyDown(e.code)) e.preventDefault();
    };
    const unlock = () => sfx.unlock();
    window.addEventListener('keydown', down);
    window.addEventListener('pointerdown', unlock);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('pointerdown', unlock);
    };
  }, []);

  const outcomeKey = hud?.outcome ? JSON.stringify(hud.outcome) : '';
  useEffect(() => {
    setShowOver(!!outcomeKey);
    setConfirm(null);
  }, [outcomeKey]);

  const moveCount = hud?.moves.length ?? 0;
  useEffect(() => {
    const el = movesRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [moveCount]);

  // o botão de confirmação volta ao normal se ninguém clicar
  useEffect(() => {
    if (!confirm) return;
    const t = setTimeout(() => setConfirm(null), 3000);
    return () => clearTimeout(t);
  }, [confirm]);

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
  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => engineRef.current?.pointerUp(...toLogical(e));

  const toggleSound = () => {
    sfx.unlock();
    sfx.setMuted(!muted);
    setMuted(!muted);
  };

  const engine = engineRef.current;
  const inProgress = !!hud && !hud.outcome && hud.moves.length > 0;

  const newGame = () => {
    if (inProgress && confirm !== 'new') return setConfirm('new');
    setConfirm(null);
    engine?.restart();
  };
  const resign = () => {
    if (confirm !== 'resign') return setConfirm('resign');
    setConfirm(null);
    engine?.resign();
  };

  const pairs: [number, string, string | undefined][] = [];
  for (let i = 0; i < moveCount; i += 2) pairs.push([i / 2 + 1, hud!.moves[i], hud!.moves[i + 1]]);

  const over = hud?.outcome ? outcomeText(hud.outcome, hud.names) : null;
  const promo = hud?.promotion ?? null;

  return (
    <main className="game">
      <nav className="game-bar">
        <button type="button" onClick={onExit}>
          ← Menu
        </button>
        <span className="mode-label">
          {settings.mode === 'pvc' ? `Contra o computador · nível ${settings.level} (${levelLabel(settings.level)})` : '2 jogadores'}
        </span>
        <span className="bar-actions">
          <button type="button" onClick={toggleSound} aria-pressed={!muted} title="Ligar/desligar os efeitos sonoros">
            Som: {muted ? 'desligado' : 'ligado'}
          </button>
          <button type="button" onClick={() => engine?.flip()} title="Ver o tabuleiro do outro lado">
            Girar
          </button>
        </span>
      </nav>

      <div className="stage">
        <canvas
          ref={canvasRef}
          width={W * SCALE}
          height={H * SCALE}
          aria-label="Tabuleiro de xadrez. Clique ou arraste as peças; no teclado, setas e Enter."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={() => engine?.pointerLeave()}
        />

        {promo !== null && (
          <div className="overlay" role="dialog" aria-label="Promoção do peão">
            <div className="overlay-box">
              <h2>Promover a…</h2>
              <div className="promo-options">
                {PROMOTIONS.map((p) => (
                  <button key={p.type} type="button" className="promo" onClick={() => engine?.choosePromotion(p.type)} autoFocus={p.type === QUEEN}>
                    <img src={assetUrl(pieceKey(promo as Color, p.type))} alt="" />
                    <span>{p.label}</span>
                  </button>
                ))}
              </div>
              <button type="button" className="link" onClick={() => engine?.cancelPromotion()}>
                Cancelar
              </button>
            </div>
          </div>
        )}

        {over && showOver && (
          <div className="overlay" role="dialog" aria-label="Fim de partida">
            <div className="overlay-box">
              <h2>{over.title}</h2>
              <p>{over.detail}</p>
              <div className="overlay-actions">
                <button type="button" className="primary" onClick={() => engine?.restart()} autoFocus>
                  Jogar de novo
                </button>
                <button type="button" onClick={() => setShowOver(false)}>
                  Ver tabuleiro
                </button>
                <button type="button" onClick={onExit}>
                  Menu
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="controls">
        <button type="button" onClick={() => engine?.undo()} disabled={!hud?.canUndo}>
          Desfazer
        </button>
        <button type="button" onClick={resign} disabled={!hud || !!hud.outcome} className={confirm === 'resign' ? 'danger' : ''}>
          {confirm === 'resign' ? 'Confirmar desistência' : 'Desistir'}
        </button>
        <button type="button" onClick={newGame} className={confirm === 'new' ? 'danger' : ''}>
          {confirm === 'new' ? 'Abandonar esta partida?' : 'Nova partida'}
        </button>
      </div>

      <section className="moves" aria-label="Lances da partida">
        <h2>Lances</h2>
        {pairs.length ? (
          <ol ref={movesRef} className="moves-list">
            {pairs.map(([n, w, b]) => (
              <li key={n}>
                <span className="move-n">{n}.</span> {w} {b ?? ''}
              </li>
            ))}
          </ol>
        ) : (
          <p className="moves-empty">As brancas começam.</p>
        )}
      </section>

      <p className="hint">
        Clique numa peça e depois na casa de destino, ou arraste. No teclado: setas e Enter. Notação: R rei, D dama, T torre, B bispo,
        C cavalo.
      </p>
    </main>
  );
}
