import { useEffect, useState } from 'react';
import { loadAssets, type Assets } from './game/assets';
import { TitleScreen } from './components/TitleScreen';
import { GameScreen } from './components/GameScreen';
import type { MapId } from './game/types';
import type { GameProps } from '../../hub/types';
import './styles.css';

export default function FugaRocam(_props: GameProps) {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [map, setMap] = useState<MapId | null>(null);

  useEffect(() => {
    loadAssets().then(setAssets, (e: Error) => setError(e.message));
  }, []);

  let content;
  if (error) content = <div className="loading">Erro: {error}</div>;
  else if (!assets) content = <div className="loading">Ligando a moto…</div>;
  else if (map) content = <GameScreen assets={assets} mapId={map} onExit={() => setMap(null)} />;
  else content = <TitleScreen onStart={setMap} />;

  return <div className="fuga-rocam">{content}</div>;
}
