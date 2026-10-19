import { H, W } from './constants';

/**
 * Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
 * O AudioContext só nasce em `unlock()`, chamado a partir de um gesto do jogador (tecla/clique);
 * antes disso, e com o som desligado, todas as chamadas são no-op.
 */

const STORAGE_KEY = 'capacete-voador:som';
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
  private flightNodes: { osc: OscillatorNode; gain: GainNode; pan: StereoPannerNode | null; wind: BiquadFilterNode } | null = null;

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
    if (m) this.flightStop();
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

  /** Arremesso: sopro curto subindo + "pop" do capacete saindo. */
  throw(x: number) {
    this.noise(0.22, 0.35, 'bandpass', 500, 2400, 0, x, 1.2);
    this.tone('square', 180, 420, 0.09, 0.12, 0, x);
  }

  /** Assobio contínuo enquanto o capacete voa; a altura do som acompanha a altura do capacete. */
  flightStart(x: number) {
    if (!this.ready() || this.flightNodes) return;
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.gain.exponentialRampToValueAtTime(0.07, ctx.currentTime + 0.05);
    const wind = ctx.createBiquadFilter();
    wind.type = 'lowpass';
    wind.frequency.value = 2400;
    let pan: StereoPannerNode | null = null;
    osc.connect(gain).connect(wind);
    if (ctx.createStereoPanner) {
      pan = ctx.createStereoPanner();
      wind.connect(pan).connect(this.master!);
    } else {
      wind.connect(this.master!);
    }
    osc.frequency.value = 420;
    osc.start();
    this.flightNodes = { osc, gain, pan, wind };
    this.flightUpdate(x, H / 2);
  }

  flightUpdate(x: number, y: number) {
    const n = this.flightNodes;
    if (!n || !this.ctx) return;
    const t = this.ctx.currentTime;
    const h = 1 - Math.max(0, Math.min(H, y)) / H; // 0 = chão, 1 = topo
    n.osc.frequency.setTargetAtTime(260 + h * 700, t, 0.03);
    // fora da tela por cima: fica mais baixinho
    n.gain.gain.setTargetAtTime(y < 0 ? 0.03 : 0.07, t, 0.05);
    if (n.pan) n.pan.pan.setTargetAtTime(Math.max(-0.8, Math.min(0.8, (x / W) * 2 - 1)), t, 0.05);
  }

  flightStop() {
    const n = this.flightNodes;
    this.flightNodes = null;
    if (!n || !this.ctx) return;
    const t = this.ctx.currentTime;
    try {
      n.gain.gain.cancelScheduledValues(t);
      n.gain.gain.setTargetAtTime(0.0001, t, 0.02);
      n.osc.stop(t + 0.12);
    } catch {
      /* já parado */
    }
  }

  /** Capacete caiu fora do campo: assobio que despenca. */
  miss(x: number) {
    this.tone('triangle', 520, 90, 0.35, 0.08, 0, x);
  }

  /** O capacete encosta no sol. */
  sun() {
    this.tone('sine', 880, 330, 0.3, 0.12);
    this.tone('sine', 660, 247, 0.3, 0.08, 0.08);
  }

  /** Explosão num prédio (abre a cratera). */
  boom(x: number) {
    this.noise(0.5, 0.7, 'lowpass', 2200, 90, 0, x, 0.6);
    this.tone('sine', 140, 38, 0.38, 0.5, 0, x);
  }

  /** Acerto na moto: estouro + lataria batendo. */
  motoHit(x: number) {
    this.noise(0.38, 0.6, 'lowpass', 3000, 160, 0, x, 0.6);
    this.tone('sine', 120, 40, 0.28, 0.4, 0, x);
    this.tone('square', 740, 210, 0.16, 0.1, 0.02, x);
    this.tone('square', 1180, 420, 0.1, 0.07, 0.07, x);
  }

  /** Moto destruída: explosão grande e demorada. */
  bigBoom(x: number) {
    this.noise(1.1, 0.9, 'lowpass', 2800, 60, 0, x, 0.5);
    this.tone('sine', 110, 28, 0.9, 0.65, 0, x);
    this.noise(0.5, 0.45, 'lowpass', 1800, 80, 0.28, x, 0.5);
    this.tone('sawtooth', 260, 40, 0.7, 0.12, 0.05, x);
  }

  /** Capacetada na cabeça: "bonk" cômico + brilho. */
  pilotHit(x: number) {
    this.tone('sine', 520, 110, 0.22, 0.45, 0, x);
    this.tone('square', 1500, 700, 0.08, 0.1, 0, x);
    this.tone('triangle', 1320, 1760, 0.12, 0.1, 0.12, x);
    this.tone('triangle', 1760, 2350, 0.14, 0.08, 0.2, x);
  }

  /** Vencedor da rodada: arpejo curto. */
  roundWin() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone('square', f, f, 0.14, 0.1, 0.1 + i * 0.1));
  }

  /** Rodada sem vencedor (treino, acertou a si mesmo): trombone triste. */
  roundLose() {
    [392, 370, 349, 311].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, i === 3 ? 0.5 : 0.2, 0.08, 0.1 + i * 0.2));
  }

  /** Fim de partida. */
  fanfare() {
    const notes: [number, number][] = [[523, 0], [523, 0.15], [523, 0.3], [659, 0.45], [784, 0.7], [659, 0.95], [784, 1.15], [1047, 1.4]];
    for (const [f, d] of notes) this.tone('square', f, f, d === 1.4 ? 0.6 : 0.16, 0.1, 0.1 + d);
    this.tone('triangle', 262, 262, 1.6, 0.14, 0.1);
  }
}

export const sfx = new Sfx();
