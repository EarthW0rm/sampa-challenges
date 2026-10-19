import { useEffect, useMemo, useState } from 'react';
import type { GameProps } from '../../hub/types';
import { loadAssets, type Assets } from './game/assets';
import { COLORS, MODELS } from './game/data';
import type { RaceConfig } from './game/engine';
import { RaceScreen } from './components/RaceScreen';
import { SetupScreen, type Choice } from './components/SetupScreen';
import './styles.css';

const CHOICE_KEY = 'corredor-sp:escolha';
const DEFAULT_CHOICE: Choice = { track: '23-de-maio', breed: 'caramelo', category: '150', modelId: 'entregadora', colorId: 'vermelho' };

function loadChoice(): Choice {
  try {
    const c = JSON.parse(localStorage.getItem(CHOICE_KEY) ?? 'null') as Choice | null;
    if (c && MODELS.some((m) => m.id === c.modelId && m.category === c.category)) return c;
  } catch {
    /* sem escolha salva */
  }
  return DEFAULT_CHOICE;
}

export default function CorredorSP(_props: GameProps) {
  const [assets, setAssets] = useState<Assets | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [choice, setChoice] = useState<Choice>(loadChoice);
  const [racing, setRacing] = useState(false);

  useEffect(() => {
    loadAssets().then(setAssets, (e: Error) => setError(e.message));
  }, []);

  const config: RaceConfig = useMemo(
    () => ({
      track: choice.track,
      breed: choice.breed,
      category: choice.category,
      model: MODELS.find((m) => m.id === choice.modelId) ?? MODELS[0],
      color: (COLORS.find((c) => c.id === choice.colorId) ?? COLORS[0]).hex,
    }),
    [choice],
  );

  let content;
  if (error) content = <div className="loading">Erro: {error}</div>;
  else if (!assets) content = <div className="loading">Esquentando o motor…</div>;
  else if (racing) content = <RaceScreen assets={assets} config={config} onBack={() => setRacing(false)} />;
  else
    content = (
      <SetupScreen
        assets={assets}
        initial={choice}
        onStart={(c) => {
          setChoice(c);
          try {
            localStorage.setItem(CHOICE_KEY, JSON.stringify(c));
          } catch {
            /* ok */
          }
          setRacing(true);
        }}
      />
    );

  return <div className="corredor-sp">{content}</div>;
}
