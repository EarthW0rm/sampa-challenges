import type { GameManifest } from '../../hub/types';
import cover from './assets/capa.png';
import { bestRecord } from './game/record';

const manifest: GameManifest = {
  id: 'corredor-sp',
  title: 'Corredor SP',
  description:
    'Enduro de motoboy na 23 de Maio, na Radial Leste e na Nações Unidas. Costure o trânsito, dê grau, arremesse capacetes e pegue pacotes.',
  cover,
  tags: ['1 jogador', 'Corrida', 'Celular'],
  accent: '#2f6fd0',
  order: 3,
  getRecord: bestRecord,
  load: () => import('./Game'),
};

export default manifest;
