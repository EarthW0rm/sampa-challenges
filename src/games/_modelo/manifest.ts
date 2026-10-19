import type { GameManifest } from '../../hub/types';
import cover from './assets/capa.png';

const manifest: GameManifest = {
  id: '__ID__',
  title: '__TITULO__',
  description: 'Descreva o jogo em uma ou duas frases.',
  cover,
  tags: ['1 jogador'],
  accent: '#7fb3dd',
  load: () => import('./Game'),
};

export default manifest;
