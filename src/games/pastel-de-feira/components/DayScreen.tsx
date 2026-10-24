import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { H, MAX_FRAME_DT, MAX_STEPS_PER_FRAME, STEP, W, hourAt } from '../game/constants';
import { pointerDown, pointerUp, syncUi, toLogical, type InputEnv } from '../game/input';
import { buildLayout } from '../game/layout';
import { SCALE } from '../game/hires';
import { sound } from '../game/sound';
import { Tutorial } from '../game/tutorial';
import { drawAlerts, drawHighlight } from '../game/render/alerts';
import { drawPanel } from '../game/render/panel';
import { buildStaticLayer, renderScene } from '../game/render/scene';
import { DaySim } from '../game/sim/day';
import type { Command, DayConfig, DayResult } from '../game/types';
import { createUi } from '../game/ui';

interface Props {
  config: DayConfig;
  seed: number;
  /** Chamado uma vez, no corte seco das 14h. */
  onDone: (result: DayResult) => void;
  onExit: () => void;
}

type TutorialStation = import('../game/types').StationId | null;

interface Hud {
  clock: string;
  cash: string;
  queue: number;
  paused: boolean;
  tip: string;
}

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function clockText(t: number): string {
  const h = hourAt(t);
  const hh = Math.min(14, Math.floor(h));
  const mm = Math.min(59, Math.floor((h - hh) * 60));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function DayScreen({ config, seed, onDone, onExit }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const envRef = useRef<InputEnv | null>(null);
  const simRef = useRef<DaySim | null>(null);
  const [hud, setHud] = useState<Hud>({ clock: '07:00', cash: money(0), queue: 0, paused: false, tip: '' });
  const [muted, setMuted] = useState({ som: sound.isMuted('som'), musica: sound.isMuted('musica') });
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    const sim = new DaySim(config, seed);
    const layout = buildLayout(config.stations, { coolers: config.coolers });
    const statics = buildStaticLayer(layout);
    const env: InputEnv = { state: sim.state, layout, ui: createUi() };
    simRef.current = sim;
    envRef.current = env;

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    let finished = false;
    const tutorial = config.tutorial ? new Tutorial() : null;
    let tip = '';
    let highlight: TutorialStation = null;

    const pause = () => sim.dispatch({ type: 'pause' });
    const loop = (nowMs: number) => {
      const dt = Math.max(0, Math.min((nowMs - last) / 1000, MAX_FRAME_DT));
      last = nowMs;
      if (tutorial && !sim.isOver()) {
        const v = tutorial.observe(sim.state);
        sim.setHold(v.hold);
        if (sim.state.speed !== 1) sim.dispatch({ type: 'setSpeed', speed: 1 }); // RN-173: sem 2× nos passos guiados
        tip = v.text;
        highlight = v.station;
      }
      if (!sim.state.paused && !sim.isOver()) {
        acc += dt * sim.state.speed;
        let steps = 0;
        while (acc >= STEP && steps < MAX_STEPS_PER_FRAME) {
          sim.step();
          acc -= STEP;
          steps++;
        }
        if (acc > STEP * MAX_STEPS_PER_FRAME) acc = 0; // queda de FPS: fica mais lento, sem pular regras
      }
      syncUi(env, dt);
      renderScene(ctx, sim.state, layout, env.ui, statics);
      drawPanel(ctx, sim.state, env.ui);
      drawAlerts(ctx, sim.state, env.ui);
      drawHighlight(ctx, layout, highlight, env.ui);
      sound.play(sim.drainEvents());

      if (nowMs - hudAt > 100) {
        hudAt = nowMs;
        const t = sim.state.tick * STEP;
        setHud((h) => {
          const next = { clock: clockText(t), cash: money(sim.state.stats.revenue), queue: sim.state.customers.length, paused: sim.state.paused, tip };
          return h.clock === next.clock && h.cash === next.cash && h.queue === next.queue && h.paused === next.paused && h.tip === next.tip ? h : next;
        });
      }
      if (sim.isOver() && !finished) {
        finished = true;
        doneRef.current(sim.result()!);
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    ctx.imageSmoothingEnabled = false;
    raf = requestAnimationFrame(loop);
    sound.setMusic(true);

    const onBlur = () => {
      pause();
      for (const c of pointerUp(env)) sim.dispatch(c);
    };
    const onVisibility = () => {
      if (document.hidden) onBlur();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'KeyP') {
        sim.dispatch({ type: sim.state.paused ? 'resume' : 'pause' });
        e.preventDefault();
      }
    };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(raf);
      sound.stop();
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKey);
      simRef.current = null;
      envRef.current = null;
    };
  }, [config, seed]);

  const send = (cmds: Command[]) => {
    const sim = simRef.current;
    if (sim) for (const c of cmds) sim.dispatch(c);
  };
  const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const env = envRef.current;
    if (!env || env.state.paused) return;
    sound.unlock(); // o AudioContext só nasce num gesto
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = toLogical(e.currentTarget, e.clientX, e.clientY);
    send(pointerDown(env, x, y));
  };
  const onUp = () => {
    const env = envRef.current;
    if (env) send(pointerUp(env));
  };
  const toggleMute = (channel: 'som' | 'musica') => {
    sound.unlock();
    sound.setMuted(channel, !sound.isMuted(channel));
    setMuted({ som: sound.isMuted('som'), musica: sound.isMuted('musica') });
  };
  const togglePause = () => send([{ type: simRef.current?.state.paused ? 'resume' : 'pause' }]);

  return (
    <div className="day">
      <div className="hud">
        <span className="hud-clock">{hud.clock}</span>
        <span>Caixa {hud.cash}</span>
        <span>Fila {hud.queue}</span>
        <span>★ {config.reputation.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
        <button type="button" onClick={() => toggleMute('som')} aria-pressed={muted.som} aria-label="Efeitos sonoros">
          {muted.som ? 'Som: não' : 'Som: sim'}
        </button>
        <button type="button" onClick={() => toggleMute('musica')} aria-pressed={muted.musica} aria-label="Música">
          {muted.musica ? 'Música: não' : 'Música: sim'}
        </button>
        <button type="button" onClick={togglePause} aria-label="Pausar">
          Pausa
        </button>
      </div>
      {hud.tip && (
        <p className="tutorial-tip" role="status">
          {hud.tip}
        </p>
      )}
      <canvas
        ref={canvasRef}
        width={W * SCALE}
        height={H * SCALE}
        aria-label="Barraca de pastel"
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        onLostPointerCapture={onUp}
      />
      {hud.paused && (
        <div className="overlay" role="dialog" aria-label="Jogo pausado">
          <div className="menu">
            <h2>Pausado</h2>
            <button type="button" onClick={() => toggleMute('som')}>
              Efeitos: {muted.som ? 'desligados' : 'ligados'}
            </button>
            <button type="button" onClick={() => toggleMute('musica')}>
              Música: {muted.musica ? 'desligada' : 'ligada'}
            </button>
            <button type="button" onClick={togglePause}>
              Continuar
            </button>
            <button type="button" onClick={onExit}>
              Sair
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
