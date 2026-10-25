import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { H, MAX_FRAME_DT, STEP, W, hourAt, stepsFor } from '../game/constants';
import { keyDown, keyUp, pointerDown, pointerUp, syncUi, toLogical, type InputEnv } from '../game/input';
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
import { exposeForE2E } from '../game/e2eHook';

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
  speed: 1 | 2;
  guided: boolean;
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
  const [hud, setHud] = useState<Hud>({ clock: '07:00', cash: money(0), queue: 0, paused: false, tip: '', speed: 1, guided: !!config.tutorial });
  const [muted, setMuted] = useState({ som: sound.isMuted('som'), musica: sound.isMuted('musica') });
  const toggleSpeedRef = useRef<(() => void) | null>(null);
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
    const e2e = exposeForE2E(sim, env);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let hudAt = 0;
    let finished = false;
    const tutorial = config.tutorial ? new Tutorial() : null;
    let tip = '';
    let guided = !!tutorial;
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
        guided = !v.done;
        highlight = v.station;
      }
      if (!sim.state.paused && !sim.isOver()) {
        const r = stepsFor(acc, dt, sim.state.speed);
        acc = r.acc;
        for (let i = 0; i < r.steps; i++) sim.step();
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
          const next = { clock: clockText(t), cash: money(sim.state.stats.revenue), queue: sim.state.customers.length, paused: sim.state.paused, tip, speed: sim.state.speed, guided };
          return h.clock === next.clock && h.cash === next.cash && h.queue === next.queue && h.paused === next.paused && h.tip === next.tip && h.speed === next.speed && h.guided === next.guided ? h : next;
        });
      }
      if (sim.isOver() && !finished) {
        finished = true;
        e2e.finish(sim.result()!);
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
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      sound.unlock();
      const r = keyDown(env, e.code, e.repeat);
      if (!r) return;
      e.preventDefault();
      if (r.session === 'pause') sim.dispatch({ type: sim.state.paused ? 'resume' : 'pause' });
      else if (r.session === 'mute') toggleMuteBoth();
      else if (r.session === 'speed') toggleSpeed();
      for (const c of r.cmds) sim.dispatch(c);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      for (const c of keyUp(env, e.code)) sim.dispatch(c);
    };
    const toggleSpeed = () => {
      if (guided) return; // RN-173: sem 2× nos passos guiados
      sim.dispatch({ type: 'setSpeed', speed: sim.state.speed === 1 ? 2 : 1 });
    };
    toggleSpeedRef.current = toggleSpeed;
    const toggleMuteBoth = () => {
      const m = !(sound.isMuted('som') && sound.isMuted('musica'));
      sound.setMuted('som', m);
      sound.setMuted('musica', m);
      setMuted({ som: m, musica: m });
    };
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      cancelAnimationFrame(raf);
      e2e.dispose();
      sound.stop();
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKeyUp);
      toggleSpeedRef.current = null;
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
        <button type="button" onClick={() => toggleSpeedRef.current?.()} disabled={hud.guided} aria-pressed={hud.speed === 2} aria-label="Acelerar">
          {hud.speed === 2 ? '2×' : '1×'}
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
