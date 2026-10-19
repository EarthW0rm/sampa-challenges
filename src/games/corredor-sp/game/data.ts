/** Dados de escolha (pistas, cachorros, motos, cores) e tabelas do trânsito. */

export type TrackId = '23-de-maio' | 'radial-leste' | 'nacoes-unidas';
export type BreedId = 'caramelo' | 'pitbull' | 'pincher' | 'collie';
export type CategoryId = '150' | '600' | '1000';
export type VehicleKind = 'carro' | 'taxi' | 'suv' | 'onibus' | 'caminhao' | 'ambulancia' | 'moto' | 'contramao';

export interface TrackInfo {
  id: TrackId;
  name: string;
  description: string;
  /** Peso de cada tipo de veículo no sorteio do trânsito comum. */
  traffic: Partial<Record<VehicleKind, number>>;
}

export const TRACKS: TrackInfo[] = [
  {
    id: '23-de-maio',
    name: 'Av. 23 de Maio',
    description: 'Murais de grafite, ipês e o Obelisco. Curvas suaves e viadutos.',
    traffic: { carro: 50, taxi: 8, suv: 12, moto: 18, onibus: 6, caminhao: 6 },
  },
  {
    id: 'radial-leste',
    name: 'Radial Leste',
    description: 'Retas longas com o metrô ao lado. Mais ônibus e caminhões.',
    traffic: { carro: 40, taxi: 6, suv: 10, moto: 16, onibus: 14, caminhao: 14 },
  },
  {
    id: 'nacoes-unidas',
    name: 'Av. das Nações Unidas',
    description: 'Berrini, Ponte Estaiada e o trecho da comunidade.',
    traffic: { carro: 46, taxi: 6, suv: 16, moto: 18, onibus: 6, caminhao: 8 },
  },
];

export const BREEDS: { id: BreedId; name: string }[] = [
  { id: 'caramelo', name: 'Vira-lata caramelo' },
  { id: 'pitbull', name: 'Pitbull' },
  { id: 'pincher', name: 'Pincher' },
  { id: 'collie', name: 'Border collie' },
];

export const CATEGORIES: { id: CategoryId; name: string; desc: string }[] = [
  { id: '150', name: 'CêGezinha', desc: 'Motos 150cc com baú. Mais lentas, fáceis de controlar.' },
  { id: '600', name: 'Hornetão', desc: 'Motos 600cc com mochila térmica. Rápidas e nervosas.' },
  { id: '1000', name: 'Tratorzão', desc: 'Big trail 1000cc com malas. As mais rápidas e pesadas.' },
];

export interface MotoModel {
  id: string;
  name: string;
  category: CategoryId;
  /** Velocidade máxima (km/h). */
  vmax: number;
  /** Aceleração (km/h por segundo). */
  accel: number;
  /** Frenagem (km/h por segundo). */
  brake: number;
  /** Velocidade lateral máxima (larguras de meia pista por segundo). */
  steer: number;
  /** Notas de 1 a 5 mostradas no menu. */
  dots: { acc: number; brk: number; ctl: number };
}

export const MODELS: MotoModel[] = [
  { id: 'pao-de-queijo', name: 'Pão de Queijo 150', category: '150', vmax: 112, accel: 30, brake: 95, steer: 2.1, dots: { acc: 3, brk: 4, ctl: 5 } },
  { id: 'entregadora', name: 'Entregadora 150', category: '150', vmax: 118, accel: 36, brake: 80, steer: 1.9, dots: { acc: 4, brk: 3, ctl: 4 } },
  { id: 'foguetinho', name: 'Foguetinho 150', category: '150', vmax: 126, accel: 38, brake: 65, steer: 1.7, dots: { acc: 4, brk: 2, ctl: 3 } },
  { id: 'corisco', name: 'Corisco 600', category: '600', vmax: 195, accel: 60, brake: 100, steer: 1.75, dots: { acc: 4, brk: 4, ctl: 4 } },
  { id: 'tubarao', name: 'Tubarão 600', category: '600', vmax: 188, accel: 58, brake: 120, steer: 1.55, dots: { acc: 4, brk: 5, ctl: 3 } },
  { id: 'marimbondo', name: 'Marimbondo 600', category: '600', vmax: 205, accel: 70, brake: 85, steer: 1.55, dots: { acc: 5, brk: 3, ctl: 3 } },
  { id: 'jabuti', name: 'Jabuti 1000', category: '1000', vmax: 212, accel: 52, brake: 105, steer: 1.6, dots: { acc: 3, brk: 4, ctl: 4 } },
  { id: 'rinoceronte', name: 'Rinoceronte 1000', category: '1000', vmax: 222, accel: 60, brake: 125, steer: 1.3, dots: { acc: 4, brk: 5, ctl: 2 } },
  { id: 'bufalo', name: 'Búfalo 1000', category: '1000', vmax: 235, accel: 72, brake: 90, steer: 1.3, dots: { acc: 5, brk: 3, ctl: 2 } },
];

export const COLORS: { id: string; name: string; hex: string }[] = [
  { id: 'vermelho', name: 'Vermelho', hex: '#d42a2a' },
  { id: 'azul', name: 'Azul', hex: '#3d7fb5' },
  { id: 'preto', name: 'Preto', hex: '#2a2533' },
  { id: 'branco', name: 'Branco', hex: '#e8e2d0' },
  { id: 'amarelo', name: 'Amarelo', hex: '#e8b83f' },
  { id: 'verde', name: 'Verde', hex: '#3fa65a' },
];

export const CAR_COLORS = ['branco', 'prata', 'preto', 'vermelho', 'azul', 'amarelo'] as const;

/** Lanternas traseiras de cada sprite, em pixels do sprite: [x, y, largura, altura] (esquerda, direita). */
export const LIGHTS: Record<string, [number, number, number, number][]> = {
  carro: [[4, 18, 8, 4], [44, 18, 8, 4]],
  taxi: [[4, 18, 8, 4], [44, 18, 8, 4]],
  suv: [[4, 18, 6, 8], [50, 18, 6, 8]],
  onibus: [[5, 40, 8, 11], [63, 40, 8, 11]],
  caminhao: [[5, 60, 8, 5], [63, 60, 8, 5]],
  ambulancia: [[5, 30, 6, 9], [53, 30, 6, 9]],
  moto: [[17, 36, 6, 1], [17, 36, 6, 1]],
};

/** Comprimento de cada veículo no sentido da pista (unidades do mundo). */
export const VEHICLE_LENGTH: Record<VehicleKind, number> = {
  carro: 600, taxi: 600, suv: 650, onibus: 1500, caminhao: 1600, ambulancia: 800, moto: 300, contramao: 300,
};

/** Faixa de velocidade (km/h) no nível 1, antes do multiplicador de nível. */
export const VEHICLE_SPEED: Record<VehicleKind, [number, number]> = {
  carro: [50, 80], taxi: [55, 85], suv: [50, 80], onibus: [35, 55], caminhao: [40, 60], ambulancia: [150, 160], moto: [75, 115], contramao: [40, 55],
};

/** O capacete tira estes da frente; os outros são grandes demais. */
export const REMOVABLE: Record<VehicleKind, boolean> = {
  carro: true, taxi: true, suv: true, moto: true, contramao: true, onibus: false, caminhao: false, ambulancia: false,
};
