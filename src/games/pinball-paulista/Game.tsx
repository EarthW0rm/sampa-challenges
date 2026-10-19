import { useEffect, useState } from 'react';
import { loadAssets, type Assets } from './game/assets';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import type { GameProps } from '../../hub/types';
import './styles.css';

export default function PinballPaulista(_props: GameProps) {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    loadAssets().then(setAssets, (e: Error) => setError(e.message));
  }, []);

  let content;
  if (error) content = <div className="loading">Erro: {error}</div>;
  else if (!assets) content = <div className="loading">Ligando a mesa…</div>;
  else if (playing) content = <GameScreen assets={assets} onExit={() => setPlaying(false)} />;
  else content = <TitleScreen onStart={() => setPlaying(true)} />;

  return <div className="pinball-paulista">{content}</div>;
}
