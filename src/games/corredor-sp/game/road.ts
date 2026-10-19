/** Pista pseudo-3D em segmentos (curvas e subidas) e o cenário fixo de cada avenida. */
import { SEG_LEN } from './constants';
import type { TrackId } from './data';

export interface Scenery {
  key: string;
  /** x normalizado (além de ±1 fica fora da pista). */
  x: number;
  flip?: boolean;
}

export interface Segment {
  index: number;
  /** Altura no início e no fim do segmento. */
  y1: number;
  y2: number;
  curve: number;
  /** Faixa de cor alternada (zebra, grama, tracejado). */
  band: number;
  sprites: Scenery[];
}

export interface Track {
  segments: Segment[];
  length: number;
}

const easeIn = (a: number, b: number, p: number) => a + (b - a) * p * p;
const easeInOut = (a: number, b: number, p: number) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);

class Builder {
  segments: Segment[] = [];
  private lastY() {
    return this.segments.length ? this.segments[this.segments.length - 1].y2 : 0;
  }
  private add(curve: number, y: number) {
    const i = this.segments.length;
    this.segments.push({ index: i, y1: this.lastY(), y2: y, curve, band: Math.floor(i / 3) % 2, sprites: [] });
  }
  /** Trecho com entrada, miolo e saída; `hill` em múltiplos de SEG_LEN (positivo sobe). */
  road(enter: number, hold: number, leave: number, curve: number, hill = 0) {
    enter = Math.round(enter);
    hold = Math.round(hold);
    leave = Math.round(leave);
    const startY = this.lastY();
    const endY = startY + hill * SEG_LEN;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) this.add(easeIn(0, curve, n / enter), easeInOut(startY, endY, (n + 1) / total));
    for (let n = 0; n < hold; n++) this.add(curve, easeInOut(startY, endY, (enter + n + 1) / total));
    for (let n = 0; n < leave; n++) this.add(easeInOut(curve, 0, n / leave), easeInOut(startY, endY, (enter + hold + n + 1) / total));
  }
  straight(n: number, hill = 0) {
    this.road(n / 3, n / 3, n / 3, 0, hill);
  }
  /** Fecha o laço voltando à altura zero. */
  close() {
    const y = this.lastY();
    this.road(30, 30, 30, 0, -y / SEG_LEN);
  }
}

/** Gerador pseudoaleatório com semente (o cenário é o mesmo a cada partida). */
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function layout(id: TrackId): Builder {
  const b = new Builder();
  if (id === '23-de-maio') {
    b.straight(60);
    b.road(30, 60, 30, 2, 0);
    b.road(40, 40, 40, 0, 30); // viaduto
    b.road(40, 40, 40, 0, -30);
    b.road(25, 50, 25, -3);
    b.straight(40);
    b.road(30, 30, 30, 3, 15);
    b.road(30, 30, 30, -3, -15);
    b.straight(80);
    b.road(30, 80, 30, 2.5, 25);
    b.road(30, 40, 30, -2, -10);
    b.straight(50);
    b.road(20, 40, 20, -4, 0);
    b.road(20, 40, 20, 4, 0);
  } else if (id === 'radial-leste') {
    b.straight(150);
    b.road(40, 80, 40, 1.5, 10);
    b.straight(200, -10);
    b.road(40, 60, 40, -1.5, 0);
    b.straight(120, 15); // viaduto
    b.straight(120, -15);
    b.road(30, 50, 30, 2, 0);
    b.straight(180);
  } else {
    b.straight(80);
    b.road(30, 60, 30, -2.5, 0);
    b.road(30, 70, 30, 2, 8);
    b.straight(100, -8);
    b.road(40, 80, 40, -3, 0);
    b.straight(60);
    b.road(30, 60, 30, 3, 12);
    b.road(30, 60, 30, -2, -12);
    b.straight(120);
    b.road(30, 40, 30, 2.5, 0);
  }
  b.close();
  return b;
}

function decorate(id: TrackId, segs: Segment[]) {
  const r = rng(id.length * 97 + segs.length);
  const n = segs.length;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  segs.forEach((s, i) => {
    const sp = s.sprites;
    if (i % 6 === 0) {
      sp.push({ key: 'cenario/poste', x: 1.2 });
      sp.push({ key: 'cenario/poste', x: -1.2, flip: true });
    }
    if (i % 220 === 40) sp.push({ key: `cenario/placa_${id}`, x: 1.45 });
    if (id === '23-de-maio') {
      if (i % 2 === 0 && i % 60 > 6) sp.push({ key: `cenario/grafite_${Math.floor(i / 2) % 3}`, x: 1.65 });
      if (i % 60 === 2) sp.push({ key: pick(['cenario/outdoor_lokodog', 'cenario/outdoor_capacete']), x: 2.1 });
      if (i % 5 === 0) sp.push({ key: pick(['cenario/arvore_ipe_roxo', 'cenario/arvore_ipe_amarelo', 'cenario/arvore_comum']), x: -1.6 - r() * 0.6 });
      if (i % 9 === 4) sp.push({ key: `cenario/predio_${Math.floor(r() * 3)}`, x: -2.6 - r() * 0.6 });
    } else if (id === 'radial-leste') {
      if (i % 2 === 0) sp.push({ key: 'cenario/mureta', x: -1.12 });
      if (i % 12 === 0) sp.push({ key: 'cenario/cohab', x: 2.3 + r() * 0.4 });
      if (i % 7 === 3) sp.push({ key: 'cenario/arvore_comum', x: 1.55 });
      if (i % 70 === 30) sp.push({ key: pick(['cenario/outdoor_capacete', 'cenario/outdoor_seguranca', 'cenario/outdoor_lokodog']), x: 2.0 });
      if (i % 10 === 5) sp.push({ key: `cenario/predio_${Math.floor(r() * 3)}`, x: -3.6 - r() * 0.5 });
    } else {
      const comunidade = i > n * 0.3 && i < n * 0.62;
      if (i % 9 === 0) sp.push({ key: `cenario/predio_${Math.floor(i / 9) % 3}`, x: 2.0 + r() * 0.5 });
      if (i % 9 === 5) sp.push({ key: 'cenario/arvore_comum', x: 1.55 });
      if (i % 80 === 20) sp.push({ key: 'cenario/outdoor_seguranca', x: 1.9 });
      if (comunidade) {
        if (i % 3 === 0) sp.push({ key: `cenario/casa_comunidade_${Math.floor(r() * 3)}`, x: -1.55 - r() * 0.3 });
        if (i % 3 === 1) sp.push({ key: `cenario/casa_comunidade_${Math.floor(r() * 3)}`, x: -2.3 - r() * 0.4 });
      } else {
        if (i % 2 === 0) sp.push({ key: 'cenario/mureta', x: -1.12 });
        if (i % 6 === 3) sp.push({ key: 'cenario/arvore_comum', x: -1.7 });
      }
    }
  });
}

export function buildTrack(id: TrackId): Track {
  const b = layout(id);
  const segments = b.segments.map((s, i) => ({ ...s, index: i, band: Math.floor(i / 3) % 2 }));
  decorate(id, segments);
  return { segments, length: segments.length * SEG_LEN };
}

/** Segmento que contém a posição z (z absoluto, a pista se repete). */
export function segmentAt(track: Track, z: number): Segment {
  const n = track.segments.length;
  const i = Math.floor(z / SEG_LEN) % n;
  return track.segments[(i + n) % n];
}
