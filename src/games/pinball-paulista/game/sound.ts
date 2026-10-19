import { W } from './constants';

/**
 * Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
 * O AudioContext só nasce em `unlock()`, chamado a partir de um gesto do jogador (tecla/clique);
 * antes disso, e com o som desligado, todas as chamadas são no-op.
 */

const STORAGE_KEY = 'pinball-paulista:som';
const MASTER_VOLUME = 0.5;

type WaveType = OscillatorType;

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = loadMuted();

  isMuted(): boolean {
    return this.muted;
  }

  setMuted(m: boolean) {
    this.muted = m;
    try {
      localStorage.setItem(STORAGE_KEY, m ? 'off' : 'on');
    } catch {
      /* sem persistência: tudo bem */
    }
    if (this.master) this.master.gain.value = m ? 0 : MASTER_VOLUME;
  }

  /** Cria/retoma o AudioContext. Chame dentro de um gesto do usuário. */
  unlock() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER_VOLUME;
        const comp = this.ctx.createDynamicsCompressor();
        this.master.connect(comp).connect(this.ctx.destination);
        const len = this.ctx.sampleRate;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private ready(): boolean {
    return !!this.ctx && !!this.master && !this.muted && this.ctx.state !== 'closed';
  }

  /** Saída com pan estéreo de acordo com a posição x do campo. */
  private out(x: number | null): AudioNode {
    const ctx = this.ctx!;
    if (x === null || !ctx.createStereoPanner) return this.master!;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.max(-0.8, Math.min(0.8, (x / W) * 2 - 1));
    pan.connect(this.master!);
    return pan;
  }

  private tone(type: WaveType, f0: number, f1: number, dur: number, vol: number, delay = 0, x: number | null = null) {
    if (!this.ready()) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.out(x));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, delay = 0, x: number | null = null, q = 0.8) {
    if (!this.ready() || !this.noiseBuf) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const flt = ctx.createBiquadFilter();
    flt.type = filter;
    flt.Q.value = q;
    flt.frequency.setValueAtTime(f0, t);
    flt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt).connect(g).connect(this.out(x));
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------- eventos

  flipper(x: number) {
    this.noise(0.05, 0.25, 'bandpass', 900, 500, 0, x, 1.5);
    this.tone('square', 150, 90, 0.05, 0.1, 0, x);
  }

  /** Buzina de moto: o "pop" do bumper. */
  bumper(x: number, stage: number) {
    const f = 440 + stage * 110;
    this.tone('square', f, f * 1.5, 0.09, 0.14, 0, x);
    this.tone('triangle', f / 2, f / 3, 0.12, 0.2, 0, x);
  }

  sling(x: number) {
    this.tone('sawtooth', 300, 700, 0.06, 0.1, 0, x);
    this.noise(0.06, 0.2, 'highpass', 2000, 4000, 0, x);
  }

  target(x: number, lit: boolean) {
    this.tone('square', lit ? 988 : 784, lit ? 988 : 1175, 0.08, 0.1, 0, x);
  }

  rollover(i: number) {
    this.tone('triangle', 660 + i * 110, 660 + i * 110, 0.1, 0.12);
  }

  spinner(x: number) {
    this.tone('square', 1500, 1200, 0.025, 0.05, 0, x);
  }

  wall(x: number, v: number) {
    if (v < 80) return;
    this.tone('triangle', 200, 110, 0.04, Math.min(0.12, v / 3000), 0, x);
  }

  launch(power: number) {
    this.noise(0.2, 0.3, 'bandpass', 300 + power * 600, 1800, 0, null, 1);
    this.tone('square', 120, 260, 0.1, 0.12);
  }

  kickCapture(x: number) {
    this.tone('sine', 330, 80, 0.3, 0.3, 0, x);
  }

  kickEject(x: number) {
    this.noise(0.18, 0.3, 'bandpass', 400, 2200, 0, x, 1.2);
    this.tone('square', 220, 520, 0.12, 0.12, 0, x);
  }

  award() {
    [523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.1, 0.1, i * 0.08));
  }

  multiball() {
    [392, 523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.12, 0.1, i * 0.07));
    this.tone('triangle', 196, 196, 0.6, 0.15);
  }

  extraBall() {
    [659, 784, 1047, 1319, 1568].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.12, i * 0.08));
  }

  saver() {
    this.tone('triangle', 880, 440, 0.25, 0.12);
    this.tone('triangle', 660, 330, 0.25, 0.1, 0.12);
  }

  drain() {
    this.tone('sawtooth', 300, 60, 0.6, 0.15);
    this.noise(0.5, 0.2, 'lowpass', 1500, 100);
  }

  nudge() {
    this.noise(0.12, 0.35, 'lowpass', 600, 120);
  }

  tilt() {
    this.tone('sawtooth', 180, 60, 0.7, 0.2);
    this.tone('square', 90, 60, 0.7, 0.15, 0.05);
  }

  bonusTick() {
    this.tone('square', 1200, 1200, 0.03, 0.06);
  }

  fanfare() {
    const notes: [number, number][] = [[523, 0], [523, 0.15], [523, 0.3], [659, 0.45], [784, 0.7], [659, 0.95], [784, 1.15], [1047, 1.4]];
    for (const [f, d] of notes) this.tone('square', f, f, d === 1.4 ? 0.6 : 0.16, 0.1, 0.1 + d);
  }
}

export const sfx = new Sfx();
