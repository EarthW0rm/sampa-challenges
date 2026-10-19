import type { GameManifest } from '../../hub/types';
import cover from './assets/cenario/cena_exemplo.png';
import { loadRecord } from './game/record';

const manifest: GameManifest = {
  id: 'cachorro-loko',
  title: 'Cachorro Loko',
  description:
    'Um vira-lata motoboy precisa pegar os pedidos do LOKO DOG antes que caiam das esteiras. Turbo, grau, ímã e bombas.',
  cover,
  tags: ['1 jogador', 'Arcade', 'Celular'],
  accent: '#ff4d5e',
  order: 2,
  getRecord: loadRecord,
  load: () => import('./Game'),
};

export default manifest;
