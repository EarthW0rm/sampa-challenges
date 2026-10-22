import type { GameManifest } from '../../hub/types';
import cover from './assets/cenario/cena_exemplo.png';

const manifest: GameManifest = {
  id: 'capacete-voador',
  title: 'Capacete Voador',
  description:
    'Duelo de artilharia com motoboys: arremesse capacetes por cima do Copan, do Itália e do MASP. Três acertos destroem a moto; na cabeça, vitória na hora.',
  cover,
  tags: ['1–2 jogadores', 'Contra o computador', 'Estratégia'],
  accent: '#f5b860',
  order: 1,
  load: () => import('./Game'),
};

export default manifest;
