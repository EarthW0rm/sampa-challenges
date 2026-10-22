import type { GameManifest } from '../../hub/types';
import cover from './assets/capa.png';

const manifest: GameManifest = {
  id: 'sinuca-de-bar',
  title: 'Sinuca de Bar',
  description:
    'A mesa do boteco com as regras da casa: lisas × listradas (mata a 8) ou ímpares × pares (mata a 15). Jogue a dois ou contra o computador.',
  cover,
  tags: ['1–2 jogadores', 'Contra o computador', 'Sinuca'],
  accent: '#5fd17a',
  order: 6,
  load: () => import('./Game'),
};

export default manifest;
