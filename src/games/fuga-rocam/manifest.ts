import type { GameManifest } from '../../hub/types';
import cover from './assets/capa.png';
import { bestRecord } from './game/record';

const manifest: GameManifest = {
  id: 'fuga-rocam',
  title: 'Fuga da Rocam',
  description:
    'Labirinto visto de cima: pegue pedidos e entregue pelas ruas de São Paulo enquanto viaturas de carro, moto e helicóptero da Rocam fecham o cerco.',
  cover,
  tags: ['1 jogador', 'Ação', 'Celular'],
  accent: '#4da3ff',
  order: 5,
  getRecord: bestRecord,
  load: () => import('./Game'),
};

export default manifest;
