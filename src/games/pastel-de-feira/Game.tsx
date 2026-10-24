import { useState } from 'react';
import type { GameProps } from '../../hub/types';
import { DayScreen } from './components/DayScreen';
import { DaySummary } from './components/DaySummary';
import { devConfig } from './game/devConfig';
import type { DayResult } from './game/types';
import './styles.css';

/** US-110: um Dia de Feira solo com a config de desenvolvimento. A campanha entra na US-111. */
export default function PastelDeFeira({ onExit }: GameProps) {
  const [seed, setSeed] = useState(() => Date.now() % 2147483647);
  const [result, setResult] = useState<DayResult | null>(null);
  const [config] = useState(() => devConfig());

  return (
    <div className="pastel-de-feira">
      {result ? (
        <DaySummary
          result={result}
          onAgain={() => {
            setResult(null);
            setSeed(Math.floor(Math.random() * 2147483646) + 1);
          }}
          onExit={onExit}
        />
      ) : (
        <DayScreen key={seed} config={config} seed={seed} onDone={setResult} onExit={onExit} />
      )}
    </div>
  );
}
