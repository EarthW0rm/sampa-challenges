/**
 * Som sintetizado com WebAudio (sem arquivos de áudio). O AudioContext só nasce em `unlock()`
 * (primeiro gesto do jogador); antes disso, sem suporte ou com o canal mudo, tudo é no-op.
 * Dois canais com mudo separado e persistente: efeitos (`pastel-de-feira:som`) e música
 * (`pastel-de-feira:musica`), valores `on`/`off`.
 */
import type { SimEvent, SimEventType } from './types';

export type Channel = 'som' | 'musica';

const KEY: Record<Channel, string> = { som: 'pastel-de-feira:som', musica: 'pastel-de-feira:musica' };
const SFX_VOLUME = 0.35;
const MUSIC_VOLUME = 0.12;
/** Cadência mínima de um mesmo efeito, para eventos em rajada não virarem ruído. */
const MIN_GAP = 0.08;

function loadMuted(channel: Channel): boolean {
  try {
    return localStorage.getItem(KEY[channel]) === 'off';
  } catch {
    return false;
  }
}

// escala de baião/feira: notas em Hz de um loop curto de 8 compassos de 4 tempos
const NOTES = [261.63, 293.66, 329.63, 392, 440, 392, 329.63, 293.66];
const BASS = [130.81, 130.81, 196, 196, 174.61, 174.61, 196, 196];
const BEAT = 0.3;

class Sound {
  private ctx: AudioContext | null = null;
  private sfx: GainNode | null = null;
  private music: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private muted: Record<Channel, boolean> = { som: loadMuted('som'), musica: loadMuted('musica') };
  private last = new Map<SimEventType, number>();
  private musicTimer: ReturnType<typeof setTimeout> | null = null;
  private musicStep = 0;
  private musicOn = false;

  isMuted(channel: Channel): boolean {
    return this.muted[channel];
  }

  setMuted(channel: Channel, value: boolean): void {
    this.muted[channel] = value;
    try {
      localStorage.setItem(KEY[channel], value ? 'off' : 'on');
    } catch {
      /* modo privado: vale só nesta sessão */
    }
    this.applyVolumes();
  }

  private applyVolumes(): void {
    if (this.sfx) this.sfx.gain.value = this.muted.som ? 0 : SFX_VOLUME;
    if (this.music) this.music.gain.value = this.muted.musica ? 0 : MUSIC_VOLUME;
  }

  /** Chamar num gesto do jogador (toque/tecla). Cria o contexto uma vez e o retoma se estiver suspenso. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.connect(ctx.destination);
        this.sfx = ctx.createGain();
        this.sfx.connect(comp);
        this.music = ctx.createGain();
        this.music.connect(comp);
        this.applyVolumes();
        const len = ctx.sampleRate;
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.musicOn && !this.musicTimer) this.tickMusic();
    } catch {
      this.ctx = null;
    }
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, dest: GainNode | null, slideTo?: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !dest) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g).connect(dest);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private hiss(dur: number, vol: number, freq: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.noise || !this.sfx) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  /** Toca o efeito de cada evento da simulação (chamar com `drainEvents()`). */
  play(events: readonly SimEvent[]): void {
    if (!this.ctx || this.muted.som) return;
    const now = this.ctx.currentTime;
    for (const e of events) {
      const prev = this.last.get(e.type) ?? -1;
      if (now - prev < MIN_GAP) continue;
      this.last.set(e.type, now);
      this.effect(e.type);
    }
  }

  private effect(type: SimEventType): void {
    const s = this.sfx;
    switch (type) {
      case 'colocou':
        this.hiss(0.45, 0.8, 3000); // fritura
        break;
      case 'alarme_ponto':
        this.tone(880, 0.12, 'square', 0.25, s);
        this.tone(1175, 0.18, 'square', 0.25, s, undefined, 0.14);
        break;
      case 'alarme_queima':
      case 'queimou':
        this.tone(220, 0.3, 'sawtooth', 0.3, s, 110);
        break;
      case 'cobrou':
      case 'grupo_pagou':
        this.tone(988, 0.08, 'square', 0.2, s);
        this.tone(1319, 0.2, 'square', 0.2, s, undefined, 0.08); // moeda
        break;
      case 'entregou':
      case 'comanda_entregue':
        this.tone(523, 0.1, 'triangle', 0.3, s);
        this.tone(659, 0.12, 'triangle', 0.3, s, undefined, 0.09);
        break;
      case 'oferta_app':
      case 'moto_chegou':
        this.tone(660, 0.1, 'sine', 0.35, s);
        this.tone(880, 0.14, 'sine', 0.35, s, undefined, 0.12);
        break;
      case 'cliente_chegou':
        this.tone(440, 0.06, 'sine', 0.15, s);
        break;
      case 'evento_inicio':
        this.tone(330, 0.4, 'sawtooth', 0.3, s, 165);
        break;
      case 'tirou_no_ponto':
      case 'caldo_pronto':
        this.tone(740, 0.12, 'triangle', 0.3, s);
        break;
      case 'item_errado':
      case 'paciencia_esgotou':
      case 'cliente_perdido_fila':
        this.tone(196, 0.25, 'square', 0.2, s, 130);
        break;
      case 'corte_seco':
        this.tone(392, 0.5, 'triangle', 0.35, s, 196);
        break;
      default:
        break;
    }
  }

  /** Liga/desliga o loop de música (a música só toca durante o Dia de Feira). */
  setMusic(on: boolean): void {
    this.musicOn = on;
    if (!on) {
      if (this.musicTimer) clearTimeout(this.musicTimer);
      this.musicTimer = null;
    } else if (this.ctx && !this.musicTimer) this.tickMusic();
  }

  private tickMusic(): void {
    if (!this.musicOn || !this.ctx) return;
    const i = this.musicStep++ % NOTES.length;
    if (!this.muted.musica) {
      this.tone(NOTES[i], BEAT * 0.9, 'triangle', 0.5, this.music);
      if (i % 2 === 0) this.tone(BASS[i], BEAT * 1.8, 'sine', 0.6, this.music);
    }
    this.musicTimer = setTimeout(() => {
      this.musicTimer = null;
      this.tickMusic();
    }, BEAT * 1000);
  }

  /** Para tudo ao sair da tela do dia. */
  stop(): void {
    this.setMusic(false);
  }
}

export const sound = new Sound();
