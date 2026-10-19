import { useEffect, useState } from 'react';
import { loadAssets, type Assets } from './game/assets';
import { DEFAULT_GRAVITY } from './game/constants';
import type { Settings } from './game/types';
import { Menu } from './components/Menu';
import type { GameProps } from '../../hub/types';
import './styles.css';
import { GameScreen } from './components/GameScreen';

const DEFAULT_SETTINGS: Settings = {
  mode: 'pvc',
  difficulty: 'medio',
  names: ['Jogador 1', 'Jogador 2'],
  pointsToWin: 3,
  gravity: DEFAULT_GRAVITY,
  rain: false,
};

export default function CapaceteVoador(_props: GameProps) {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    loadAssets().then(setAssets, (e: Error) => setError(e.message));
  }, []);

  let content;
  if (error) content = <div className="loading">Erro: {error}</div>;
  else if (!assets) content = <div className="loading">Carregando São Paulo…</div>;
  else if (playing) content = <GameScreen assets={assets} settings={settings} onExit={() => setPlaying(false)} />;
  else
    content = (
      <Menu
        initial={settings}
        onStart={(s) => {
          setSettings(s);
          setPlaying(true);
        }}
      />
    );

  return <div className="capacete-voador">{content}</div>;
}
