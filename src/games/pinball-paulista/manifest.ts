import type { GameManifest } from '../../hub/types';
import cover from './assets/capa.png';
import { loadRecord } from './game/record';

const manifest: GameManifest = {
  id: 'pinball-paulista',
  title: 'Pinball Paulista',
  description:
    'Uma mesa de pinball na Avenida Paulista: bumpers-semáforo, o Minhocão que prende a bola, letras MOTOBOY e multiball.',
  cover,
  tags: ['1 jogador', 'Pinball', 'Celular'],
  accent: '#5fd17a',
  order: 4,
  getRecord: loadRecord,
  load: () => import('./Game'),
};

export default manifest;
