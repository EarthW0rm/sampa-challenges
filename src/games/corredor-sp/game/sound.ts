type ItemKind = 'pacote' | 'vida' | 'velocidade' | 'grau' | 'capacete';

/**
 * Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
 * O AudioContext só nasce em `unlock()`, chamado a partir de um gesto do jogador (tecla/clique);
 * antes disso, e com o som desligado, todas as chamadas são no-op.
 * Os sons contínuos (motor, terra, garoa, sirene) ficam em nós permanentes cujo ganho `drive()` e
 * `siren()` ajustam a cada quadro; `silence()` zera tudo (pausa, fim de jogo, sair da tela).
 */

const STORAGE_KEY = 'corredor-sp:som';
const MASTER_VOLUME = 0.5;

function loadMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

export interface DriveState {
  /** Velocidade em relação à máxima da moto (0–1,3). */
  speed: number;
  throttle: boolean;
  grau: boolean;
  boost: boolean;
  offroad: boolean;
  rain: boolean;
  /** Na velocidade máxima, acelerando: corte de giro (limitador de rotação). */
  limiter: boolean;
}

interface DriveNodes {
  saw: OscillatorNode;
  square: OscillatorNode;
  whine: OscillatorNode;
  engGain: GainNode;
  limGain: GainNode;
  limDepth: GainNode;
  limPitch: GainNode;
  whineGain: GainNode;
  lp: BiquadFilterNode;
  rumbleGain: GainNode;
  rainGain: GainNode;
  sirenOsc: OscillatorNode;
  sirenGain: GainNode;
}

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private muted = loadMuted();
  private drv: DriveNodes | null = null;
  private lastPass = 0;

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

  private out(pan: number | null): AudioNode {
    const ctx = this.ctx!;
    if (pan === null || !ctx.createStereoPanner) return this.master!;
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    p.connect(this.master!);
    return p;
  }

  private tone(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0, pan: number | null = null) {
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
    osc.connect(g).connect(this.out(pan));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filter: BiquadFilterType, f0: number, f1: number, delay = 0, pan: number | null = null, q = 0.8) {
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
    src.connect(flt).connect(g).connect(this.out(pan));
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // ------------------------------------------------------------- sons contínuos

  private ensureDrive(): DriveNodes | null {
    if (this.drv) return this.drv;
    if (!this.ctx || !this.master || !this.noiseBuf) return null;
    const ctx = this.ctx;
    const mk = (type: OscillatorType, f: number) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.start();
      return o;
    };
    const gain = () => {
      const g = ctx.createGain();
      g.gain.value = 0;
      return g;
    };
    const noiseLoop = () => {
      const s = ctx.createBufferSource();
      s.buffer = this.noiseBuf;
      s.loop = true;
      s.start();
      return s;
    };
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    lp.Q.value = 1.2;
    const engGain = gain();
    const saw = mk('sawtooth', 70);
    const square = mk('square', 35);
    saw.connect(engGain);
    square.connect(engGain);
    // corte de giro: um LFO quadrado abre e fecha o ganho do motor e derruba o tom a cada corte
    const limGain = ctx.createGain();
    limGain.gain.value = 1;
    engGain.connect(limGain).connect(lp).connect(this.master);
    const lfo = mk('square', 11);
    const limDepth = gain();
    const limPitch = gain();
    lfo.connect(limDepth).connect(limGain.gain);
    lfo.connect(limPitch);
    limPitch.connect(saw.frequency);
    limPitch.connect(square.frequency);
    const whineGain = gain();
    const whine = mk('triangle', 900);
    whine.connect(whineGain).connect(this.master);

    const rumbleGain = gain();
    const rl = ctx.createBiquadFilter();
    rl.type = 'lowpass';
    rl.frequency.value = 260;
    noiseLoop().connect(rl).connect(rumbleGain).connect(this.master);

    const rainGain = gain();
    const rh = ctx.createBiquadFilter();
    rh.type = 'highpass';
    rh.frequency.value = 3200;
    noiseLoop().connect(rh).connect(rainGain).connect(this.master);

    const sirenGain = gain();
    const sirenOsc = mk('square', 760);
    const sl = ctx.createBiquadFilter();
    sl.type = 'lowpass';
    sl.frequency.value = 1800;
    sirenOsc.connect(sl).connect(sirenGain).connect(this.master);

    this.drv = { saw, square, whine, engGain, limGain, limDepth, limPitch, whineGain, lp, rumbleGain, rainGain, sirenOsc, sirenGain };
    return this.drv;
  }

  /** Motor (tom e brilho sobem com a velocidade), terra, garoa e assobio do turbo. Chame todo quadro. */
  drive(s: DriveState) {
    if (!this.ready()) return;
    const d = this.ensureDrive();
    if (!d) return;
    const t = this.ctx!.currentTime;
    const r = Math.max(0, Math.min(1, s.speed));
    // faixa de tom baixa e macia (nada de agudo insistente); o corte de giro marca o topo
    const f = 48 + r * 95 + (s.grau ? 8 : 0) + (s.boost ? 10 : 0);
    d.saw.frequency.setTargetAtTime(f, t, 0.07);
    d.square.frequency.setTargetAtTime(f * 0.5, t, 0.07);
    d.lp.frequency.setTargetAtTime(330 + r * 650 + (s.throttle ? 180 : 0), t, 0.09);
    d.engGain.gain.setTargetAtTime(0.05 + r * 0.03 + (s.throttle ? 0.02 : 0), t, 0.09);
    d.limGain.gain.setTargetAtTime(s.limiter ? 0.62 : 1, t, 0.03);
    d.limDepth.gain.setTargetAtTime(s.limiter ? 0.38 : 0, t, 0.02);
    d.limPitch.gain.setTargetAtTime(s.limiter ? 16 : 0, t, 0.02);
    d.whine.frequency.setTargetAtTime(520 + r * 480, t, 0.1);
    d.whineGain.gain.setTargetAtTime(s.boost ? 0.012 : 0, t, 0.12);
    d.rumbleGain.gain.setTargetAtTime(s.offroad && r > 0.05 ? 0.1 + r * 0.1 : 0, t, 0.08);
    d.rainGain.gain.setTargetAtTime(s.rain ? 0.012 : 0, t, 0.4);
  }

  /** Sirene da ambulância; `vol` de 0 (longe) a 1 (perto). */
  siren(vol: number) {
    if (!this.ready()) return;
    const d = this.ensureDrive();
    if (!d) return;
    const t = this.ctx!.currentTime;
    const hi = Math.floor(performance.now() / 450) % 2 === 0;
    d.sirenOsc.frequency.setTargetAtTime(hi ? 960 : 700, t, 0.03);
    d.sirenGain.gain.setTargetAtTime(Math.max(0, Math.min(1, vol)) * 0.04, t, 0.08);
  }

  /** Silencia todos os sons contínuos. */
  silence() {
    const d = this.drv;
    if (!d || !this.ctx) return;
    const t = this.ctx.currentTime;
    for (const g of [d.engGain, d.limDepth, d.limPitch, d.whineGain, d.rumbleGain, d.rainGain, d.sirenGain]) g.gain.setTargetAtTime(0, t, 0.05);
  }

  // ------------------------------------------------------------- eventos

  /** Contagem regressiva: bipe por número; `go` = largada. */
  countBeep(go: boolean) {
    this.tone('square', go ? 880 : 440, go ? 880 : 440, go ? 0.45 : 0.16, 0.12);
    if (go) this.tone('square', 1320, 1320, 0.4, 0.07);
  }

  pickup(kind: ItemKind) {
    switch (kind) {
      case 'pacote':
        this.tone('square', 988, 988, 0.06, 0.1);
        this.tone('square', 1319, 1319, 0.1, 0.1, 0.06);
        break;
      case 'capacete':
        this.tone('triangle', 520, 780, 0.12, 0.14);
        this.noise(0.05, 0.12, 'highpass', 3000, 5000);
        break;
      case 'vida':
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.14, 0.13, i * 0.07));
        break;
      case 'grau':
        this.tone('sawtooth', 200, 600, 0.2, 0.1);
        this.tone('square', 600, 900, 0.12, 0.08, 0.15);
        break;
      case 'velocidade':
        this.noise(0.35, 0.3, 'bandpass', 500, 4000, 0, null, 1.4);
        this.tone('sawtooth', 300, 1200, 0.3, 0.09);
        break;
    }
  }

  /** Grau começa: arrancada rápida. */
  grauOn() {
    this.tone('sawtooth', 120, 320, 0.25, 0.09);
    this.noise(0.18, 0.1, 'bandpass', 400, 1500);
  }

  /** Capacete arremessado. */
  throwHelmet() {
    this.noise(0.22, 0.28, 'bandpass', 600, 2600, 0, null, 1.2);
    this.tone('square', 220, 460, 0.08, 0.1);
  }

  /** Capacetada num carro: bonk + o carro girando. */
  helmetHit() {
    this.tone('sine', 520, 110, 0.2, 0.4);
    this.tone('square', 1400, 600, 0.07, 0.1);
    this.tone('triangle', 1320, 1760, 0.12, 0.1, 0.1);
    this.noise(0.25, 0.2, 'bandpass', 900, 400, 0.05);
  }

  /** O capacete bate num veículo grande e quica. */
  helmetBounce() {
    this.tone('sine', 300, 120, 0.12, 0.3);
    this.tone('square', 180, 100, 0.08, 0.12);
  }

  coneHit() {
    this.tone('triangle', 800, 300, 0.12, 0.2);
    this.noise(0.08, 0.2, 'highpass', 2000, 3000);
  }

  /** Buraco que não derrubou: solavanco. */
  pothole() {
    this.tone('sine', 110, 45, 0.2, 0.5);
    this.noise(0.15, 0.3, 'lowpass', 900, 150);
  }

  /** Cone atropelado. */
  coneRun() {
    this.tone('triangle', 700, 250, 0.1, 0.18);
    this.noise(0.06, 0.18, 'highpass', 2500, 3500);
  }

  /** Batida: estrondo, lataria e tombo. */
  crash() {
    this.noise(0.6, 0.7, 'lowpass', 3200, 120, 0, null, 0.6);
    this.tone('sine', 130, 38, 0.5, 0.55);
    this.tone('square', 900, 250, 0.18, 0.12, 0.02);
    this.noise(0.5, 0.25, 'highpass', 1500, 400, 0.08);
  }

  /** Derrapada/arrancada de pneu (usada na batida com vidas sobrando). */
  skid() {
    this.noise(0.45, 0.18, 'bandpass', 1800, 900, 0, null, 3);
  }

  /** Ultrapassagem perto: sopro que passa. `pan` de −1 (esquerda) a 1 (direita). */
  overtake(pan: number) {
    const now = performance.now();
    if (now - this.lastPass < 180) return;
    this.lastPass = now;
    this.noise(0.28, 0.2, 'bandpass', 1800, 450, 0, pan, 1.2);
  }

  levelUp() {
    [523, 659, 784].forEach((f, i) => this.tone('square', f, f, 0.1, 0.1, i * 0.09));
    this.tone('square', 1047, 1047, 0.25, 0.1, 0.27);
  }

  rainStart() {
    this.noise(0.8, 0.12, 'highpass', 2500, 6000);
  }

  /** Fim de turno; `record` toca uma fanfarra maior. */
  gameOver(record: boolean) {
    if (record) {
      const notes: [number, number][] = [[523, 0], [523, 0.15], [523, 0.3], [659, 0.45], [784, 0.7], [659, 0.95], [784, 1.15], [1047, 1.4]];
      for (const [f, d] of notes) this.tone('square', f, f, d === 1.4 ? 0.6 : 0.16, 0.1, 0.1 + d);
      this.tone('triangle', 262, 262, 1.6, 0.14, 0.1);
    } else {
      [392, 370, 349, 311].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, i === 3 ? 0.5 : 0.2, 0.08, 0.1 + i * 0.2));
    }
  }
}

export const sfx = new Sfx();
