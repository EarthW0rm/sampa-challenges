import type { GameManifest } from '../../hub/types';
import cover from './assets/capa.png';

const manifest: GameManifest = {
  id: 'xadrez-paulistano',
  title: 'Xadrez Paulistano',
  description:
    'Xadrez num tabuleiro de calçada paulistana em frente à Catedral da Sé. Jogue a dois ou contra o computador, do nível 1 ao 100 (mestre).',
  cover,
  tags: ['1–2 jogadores', 'Contra o computador', 'Tabuleiro'],
  accent: '#e4d9c0',
  order: 5,
  load: () => import('./Game'),
};

export default manifest;
