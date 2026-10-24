import type { GameManifest } from '../../hub/types';
import cover from './assets/capa.png';
import { loadRecord } from './game/record';

const manifest: GameManifest = {
  id: 'pastel-de-feira',
  title: 'Pastel de Feira',
  description:
    'Em obras: gestão de uma barraca de pastel de feira. Atenda, frite no ponto e faça a barraca crescer.',
  cover,
  tags: ['1 jogador', 'Gestão', 'Em obras'],
  accent: '#e8a13a',
  order: 90,
  getRecord: loadRecord,
  load: () => import('./Game'),
};

export default manifest;
