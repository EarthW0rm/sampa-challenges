import { useEffect, useState } from 'react';
import type { GameProps } from '../../hub/types';
import { GameScreen } from './components/GameScreen';
import { Menu } from './components/Menu';
import { loadAssets, type Assets } from './game/assets';
import { loadSettings, saveSettings } from './game/config';
import type { Settings } from './game/types';
import './styles.css';

export default function XadrezPaulistano(_props: GameProps) {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    loadAssets().then(setAssets, (e: Error) => setError(e.message));
  }, []);

  let content;
  if (error) content = <div className="loading">Erro: {error}</div>;
  else if (!assets) content = <div className="loading">Arrumando as peças…</div>;
  else if (playing) content = <GameScreen assets={assets} settings={settings} onExit={() => setPlaying(false)} />;
  else
    content = (
      <Menu
        initial={settings}
        onStart={(s) => {
          saveSettings(s);
          setSettings(s);
          setPlaying(true);
        }}
      />
    );

  return <div className="xadrez-paulistano">{content}</div>;
}
