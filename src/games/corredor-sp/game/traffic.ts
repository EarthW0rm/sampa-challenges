/** Trânsito: carros que seguem a faixa e dão seta, motos no corredor, ônibus, caminhões, ambulância e contramão. */
import { BLUE_LANE, CORRIDORS, KMH, LANES, SPRITE_UNITS, ROAD_W } from './constants';
import { CAR_COLORS, LIGHTS, REMOVABLE, VEHICLE_LENGTH, VEHICLE_SPEED, type VehicleKind } from './data';

export type VehicleState = 'normal' | 'signal' | 'moving' | 'spinout';

export interface Vehicle {
  id: number;
  kind: VehicleKind;
  /** Chave do sprite (ou "moto:<raça>_<cat>|<cor>" para motos recoloridas). */
  sprite: string;
  spriteW: number;
  z: number;
  x: number;
  /** Faixa (0–3) dos veículos de quatro rodas; −1 para motos. */
  lane: number;
  speed: number;
  desired: number;
  halfW: number;
  len: number;
  state: VehicleState;
  timer: number;
  blink: -1 | 0 | 1;
  hazard: boolean;
  brake: boolean;
  fromX: number;
  targetX: number;
  targetLane: number;
  moveDur: number;
  /** Ônibus parado no ponto. */
  stopTimer: number;
  spin: number;
  spinDir: number;
  /** Distância ao jogador no quadro anterior (para contar ultrapassagens). */
  prevDz: number;
  removable: boolean;
  lights: [number, number, number, number][];
}

export interface TrafficParams {
  speedFactor: number;
  laneChangeRate: number;
  noSignalChance: number;
}

let nextId = 1;

function halfWidthOf(spriteW: number) {
  // um pouco menor que o desenho: dá para passar no corredor entre dois carros
  return ((spriteW * SPRITE_UNITS) / 2 / ROAD_W) * 0.72;
}

export function makeVehicle(
  kind: VehicleKind,
  z: number,
  x: number,
  lane: number,
  speedFactor: number,
  rand: () => number,
  spriteW: number,
  sprite: string,
): Vehicle {
  const [a, b] = VEHICLE_SPEED[kind];
  const kmh = (a + (b - a) * rand()) * (kind === 'ambulancia' || kind === 'contramao' ? 1 : speedFactor);
  const speed = kmh * KMH * (kind === 'contramao' ? -1 : 1);
  return {
    id: nextId++,
    kind,
    sprite,
    spriteW,
    z,
    x,
    lane,
    speed,
    desired: speed,
    halfW: halfWidthOf(spriteW),
    len: VEHICLE_LENGTH[kind],
    state: 'normal',
    timer: 1 + rand() * 4,
    blink: 0,
    hazard: false,
    brake: false,
    fromX: x,
    targetX: x,
    targetLane: lane,
    moveDur: 1,
    stopTimer: 0,
    spin: 0,
    spinDir: rand() < 0.5 ? -1 : 1,
    prevDz: Infinity,
    removable: REMOVABLE[kind],
    lights: LIGHTS[kind === 'contramao' ? 'moto' : kind] ?? LIGHTS.carro,
  };
}

export const carSprite = (rand: () => number) => `transito/carro_${CAR_COLORS[Math.floor(rand() * CAR_COLORS.length)]}`;

/** Há veículo de quatro rodas na faixa `lane` perto de z? */
export function laneBusy(list: Vehicle[], lane: number, z: number, ahead: number, behind: number, except?: Vehicle) {
  const lx = LANES[lane];
  return list.some((o) => {
    if (o === except || o.kind === 'moto' || o.kind === 'contramao') return false;
    const occupies = Math.abs(o.x - lx) < 0.3 || o.targetLane === lane;
    return occupies && o.z - z < ahead && z - o.z < behind;
  });
}

/** Veículo mais próximo à frente que ocupa a posição lateral x. */
function leaderAt(list: Vehicle[], v: Vehicle, x: number, halfW: number, range: number): Vehicle | null {
  let best: Vehicle | null = null;
  for (const o of list) {
    if (o === v || o.kind === 'contramao') continue;
    const dz = o.z - v.z;
    if (dz <= 0 || dz > range) continue;
    if (Math.abs(o.x - x) > o.halfW + halfW) continue;
    if (!best || o.z < best.z) best = o;
  }
  return best;
}

export function updateVehicle(
  v: Vehicle,
  list: Vehicle[],
  dt: number,
  p: TrafficParams,
  rand: () => number,
  player: { z: number; x: number },
) {
  if (v.state === 'spinout') {
    v.spin += dt;
    v.x += v.spinDir * dt * 1.6;
    v.speed *= Math.pow(0.4, dt);
    v.z += v.speed * dt;
    return;
  }

  // segue o da frente (motos têm a própria lógica)
  if (v.kind !== 'contramao' && v.kind !== 'moto') {
    const leader = leaderAt(list, v, v.x, v.halfW, 2600);
    const safe = 500 + (v.len + (leader?.len ?? 0)) / 2 + Math.max(0, v.speed) * 0.35;
    let target = v.desired;
    if (v.kind === 'onibus' && v.stopTimer > 0) target = 0;
    if (leader && leader.z - v.z < safe) target = Math.min(target, leader.speed * 0.95);
    v.brake = target < v.speed - 30;
    const rate = v.brake ? 1600 : 500;
    v.speed += Math.max(-rate * dt, Math.min(rate * dt, target - v.speed));
  }

  // ônibus parando no ponto (pisca-alerta)
  if (v.kind === 'onibus') {
    if (v.stopTimer > 0) {
      v.stopTimer -= dt;
      v.hazard = true;
      if (v.stopTimer <= 0) v.hazard = false;
    } else if (rand() < dt / 12) {
      v.stopTimer = 3 + rand() * 2;
    }
  }

  if (v.kind === 'moto') updateMoto(v, list, dt, rand, player);
  else if (v.kind !== 'contramao' && v.kind !== 'onibus') updateLaneChange(v, list, dt, p, rand, player);

  v.z += v.speed * dt;
}

function updateLaneChange(
  v: Vehicle,
  list: Vehicle[],
  dt: number,
  p: TrafficParams,
  rand: () => number,
  player: { z: number; x: number },
) {
  const truck = v.kind === 'caminhao';
  const ambulance = v.kind === 'ambulancia';
  if (v.state === 'signal') {
    v.timer -= dt;
    if (v.timer <= 0) {
      v.state = 'moving';
      v.timer = v.moveDur;
      v.fromX = v.x;
    }
    return;
  }
  if (v.state === 'moving') {
    v.timer -= dt;
    const t = 1 - Math.max(0, v.timer) / v.moveDur;
    v.x = v.fromX + (v.targetX - v.fromX) * (t * t * (3 - 2 * t));
    if (v.timer <= 0) {
      v.x = v.targetX;
      v.lane = v.targetLane;
      v.state = 'normal';
      v.blink = 0;
      v.timer = 2 + rand() * 5;
    }
    return;
  }
  if (ambulance) return;

  const dzPlayer = v.z - player.z;
  const nearPlayer = dzPlayer > 500 && dzPlayer < 2600;
  // fechada sem seta perto do jogador
  const cutChance = nearPlayer ? p.noSignalChance * 0.8 * dt : 0;
  const wants = rand() < p.laneChangeRate * dt || rand() < cutChance;
  if (!wants) return;
  const options = [v.lane - 1, v.lane + 1].filter((l) => l >= (truck ? 2 : 0) && l <= 3 && !(v.kind === 'onibus'));
  // fechada: prefere ir para o lado do jogador
  if (nearPlayer) options.sort((a, b) => Math.abs(LANES[a] - player.x) - Math.abs(LANES[b] - player.x));
  for (const lane of options) {
    if (laneBusy(list, lane, v.z, 1500, 1300, v)) continue;
    startLaneChange(v, lane, rand() < p.noSignalChance || (nearPlayer && rand() < p.noSignalChance));
    return;
  }
}

export function startLaneChange(v: Vehicle, lane: number, noSignal: boolean, quick = false) {
  const truck = v.kind === 'caminhao';
  const kmh = Math.abs(v.speed) / KMH;
  v.targetLane = lane;
  v.targetX = LANES[lane];
  v.fromX = v.x;
  v.moveDur = truck ? 1.8 : noSignal ? 0.7 : 1.1;
  v.blink = noSignal ? 0 : lane > v.lane ? 1 : -1;
  if (noSignal) {
    v.state = 'moving';
    v.timer = v.moveDur;
  } else {
    v.state = 'signal';
    // quanto mais rápido, menos tempo de seta
    v.timer = quick ? 0.45 : Math.max(0.6, Math.min(2.0, 2.2 - kmh / 70)) * (truck ? 1.4 : 1);
  }
}

function updateMoto(v: Vehicle, list: Vehicle[], dt: number, rand: () => number, player: { z: number; x: number }) {
  v.timer -= dt;
  if (v.timer <= 0) {
    v.timer = 2 + rand() * 4;
    const r = rand();
    v.targetX = r < 0.45 ? BLUE_LANE : r < 0.8 ? CORRIDORS[Math.floor(rand() * CORRIDORS.length)] : LANES[Math.floor(rand() * LANES.length)];
  }
  // desvia do jogador quando vem por trás
  const dz = player.z - v.z;
  if (dz > 0 && dz < 1500 && Math.abs(player.x - v.targetX) < 0.15) v.targetX += player.x > v.targetX ? -0.25 : 0.25;
  const step = 0.6 * dt;
  v.x += Math.max(-step, Math.min(step, v.targetX - v.x));
  const block = leaderAt(list, v, v.x, v.halfW, 900);
  if (block) v.speed = Math.min(v.speed, block.speed);
  else v.speed += Math.min(400 * dt, v.desired - v.speed);
}
