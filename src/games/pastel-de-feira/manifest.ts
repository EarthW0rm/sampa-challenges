import type { GameManifest } from '../../hub/types';
import cover from './assets/capa.png';
import { loadHubRecord } from './game/record';

const manifest: GameManifest = {
  id: 'pastel-de-feira',
  title: 'Pastel de Feira',
  description:
    'Gestão de uma barraca de pastel de feira em São Paulo. Atenda, frite no ponto, contrate equipe e bata a meta dos 20 dias.',
  cover,
  tags: ['1 jogador', 'Gestão'],
  accent: '#e8a13a',
  order: 90,
  getRecord: loadHubRecord,
  load: () => import('./Game'),
};

export default manifest;
