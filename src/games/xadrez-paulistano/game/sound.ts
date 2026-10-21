/**
 * Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
 * O AudioContext só nasce em `unlock()`, chamado a partir de um gesto do jogador (tecla/clique);
 * antes disso, e com o som desligado, todas as chamadas são no-op.
 */

const STORAGE_KEY = 'xadrez-paulistano:som';
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

  private tone(type: WaveType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
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
    osc.connect(g).connect(this.master!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, delay = 0, q = 0.8) {
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
    src.connect(flt).connect(g).connect(this.master!);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------- eventos

  /** Peça de madeira batendo na pedra. */
  move() {
    this.noise(0.05, 0.35, 'bandpass', 1400, 700, 0, 2);
    this.tone('triangle', 220, 140, 0.06, 0.18);
  }

  capture() {
    this.noise(0.09, 0.45, 'bandpass', 900, 400, 0, 1.5);
    this.tone('square', 180, 90, 0.08, 0.12);
    this.noise(0.05, 0.3, 'bandpass', 1600, 900, 0.06, 2);
  }

  castle() {
    this.move();
    this.noise(0.05, 0.3, 'bandpass', 1200, 600, 0.11, 2);
    this.tone('triangle', 200, 130, 0.06, 0.15, 0.11);
  }

  check() {
    this.tone('square', 784, 784, 0.08, 0.08, 0.04);
    this.tone('square', 1047, 1047, 0.12, 0.08, 0.13);
  }

  select() {
    this.tone('triangle', 660, 660, 0.03, 0.05);
  }

  illegal() {
    this.tone('square', 140, 110, 0.12, 0.08);
  }

  win() {
    const notes: [number, number][] = [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.4]];
    for (const [f, d] of notes) this.tone('square', f, f, d === 0.4 ? 0.5 : 0.14, 0.1, d);
  }

  lose() {
    const notes: [number, number][] = [[392, 0], [330, 0.18], [262, 0.36]];
    for (const [f, d] of notes) this.tone('triangle', f, f * 0.98, 0.22, 0.14, d);
  }

  draw() {
    this.tone('triangle', 523, 523, 0.18, 0.12);
    this.tone('triangle', 392, 392, 0.3, 0.12, 0.18);
  }
}

export const sfx = new Sfx();
