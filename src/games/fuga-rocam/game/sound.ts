/**
 * Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
 * O AudioContext só nasce em `unlock()` (gesto do jogador); antes disso, e com o som desligado,
 * tudo é no-op. Camada contínua: sirene (volume pela viatura mais próxima) e hélice do helicóptero.
 */

const STORAGE_KEY = 'fuga-rocam:som';
const MASTER_VOLUME = 0.5;

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
  // camada contínua
  private sirenOsc: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private heliGain: GainNode | null = null;
  private sirenT = 0;

  isMuted() {
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
        this.startLoops();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch {
      this.ctx = null;
    }
  }

  private ready() {
    return !!this.ctx && !!this.master && !this.muted && this.ctx.state !== 'closed';
  }

  private startLoops() {
    const ctx = this.ctx!;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'square';
    this.sirenOsc.frequency.value = 700;
    const flt = ctx.createBiquadFilter();
    flt.type = 'lowpass';
    flt.frequency.value = 1800;
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(flt).connect(this.sirenGain).connect(this.master!);
    this.sirenOsc.start();

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 180;
    bp.Q.value = 2;
    const chop = ctx.createGain();
    chop.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.5;
    lfo.connect(lfoGain).connect(chop.gain);
    lfo.start();
    this.heliGain = ctx.createGain();
    this.heliGain.gain.value = 0;
    src.connect(bp).connect(chop).connect(this.heliGain).connect(this.master!);
    src.start();
  }

  /** Sirene: nearest 0..1 (1 = colada); heli 0..1. Chamada todo quadro. */
  ambient(dt: number, nearest: number, heli: number) {
    if (!this.ready() || !this.sirenOsc || !this.sirenGain || !this.heliGain) return;
    const t = this.ctx!.currentTime;
    this.sirenT += dt;
    // "uó-uó": alterna entre duas notas
    const hi = Math.floor(this.sirenT * 2.4) % 2 === 0;
    this.sirenOsc.frequency.setTargetAtTime(hi ? 920 : 680, t, 0.04);
    this.sirenGain.gain.setTargetAtTime(Math.max(0, nearest) * 0.07, t, 0.12);
    this.heliGain.gain.setTargetAtTime(Math.max(0, heli) * 0.5, t, 0.2);
  }

  silence() {
    if (!this.ctx || !this.sirenGain || !this.heliGain) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(0, t, 0.05);
    this.heliGain.gain.setTargetAtTime(0, t, 0.05);
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) {
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

  start() {
    [392, 523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.1, 0.1, i * 0.08));
  }
  pickup() {
    this.tone('square', 660, 880, 0.08, 0.12);
    this.tone('square', 880, 1175, 0.1, 0.12, 0.08);
  }
  deliver() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.1, 0.12, i * 0.07));
    this.tone('triangle', 262, 262, 0.4, 0.18);
  }
  item(kind: string) {
    if (kind === 'vida') [523, 659, 784, 988, 1319].forEach((f, i) => this.tone('triangle', f, f, 0.09, 0.14, i * 0.06));
    else this.tone('triangle', 700, 1400, 0.14, 0.16);
  }
  turbo(on: boolean) {
    if (on) {
      this.noise(0.25, 0.18, 'bandpass', 500, 2500, 0, 1.2);
      this.tone('sawtooth', 120, 260, 0.25, 0.08);
    }
  }
  oil() {
    this.noise(0.18, 0.2, 'lowpass', 900, 300);
    this.tone('sine', 300, 150, 0.15, 0.12);
  }
  skid() {
    this.noise(0.5, 0.2, 'bandpass', 1800, 900, 0, 3);
    this.tone('sawtooth', 700, 300, 0.4, 0.07);
  }
  shield() {
    this.tone('square', 220, 110, 0.18, 0.16);
    this.noise(0.12, 0.2, 'highpass', 3000, 1500);
  }
  starUp(n: number) {
    const f = 440 + n * 60;
    this.tone('sawtooth', f, f * 0.7, 0.2, 0.12);
    this.tone('sawtooth', f * 1.5, f, 0.2, 0.1, 0.12);
  }
  starDown() {
    this.tone('triangle', 660, 440, 0.18, 0.1);
  }
  hide() {
    this.tone('triangle', 330, 220, 0.12, 0.1);
    this.noise(0.15, 0.12, 'lowpass', 600, 200);
  }
  caught() {
    this.noise(0.35, 0.3, 'lowpass', 1500, 100);
    this.tone('sawtooth', 300, 60, 0.6, 0.18);
  }
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => this.tone('triangle', f, f * 0.95, 0.28, 0.2, i * 0.22));
  }
  record() {
    [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.1, 0.12, i * 0.09));
  }
}

export const sfx = new Sfx();
