import { useMemo, useRef, useState } from 'react';
import type { GameProps } from '../../hub/types';
import { ClosingScreen } from './components/ClosingScreen';
import { DayScreen } from './components/DayScreen';
import { EndScreen } from './components/EndScreen';
import { NewCampaign } from './components/NewCampaign';
import { PrepScreen } from './components/prep/PrepScreen';
import { TitleScreen } from './components/TitleScreen';
import { closeDay } from './game/campaign/closing';
import { daySeed, newCampaign, toDayConfig } from './game/campaign/campaign';
import { browserStorage, clearSave, load, saveCampaign, type SavePhase } from './game/campaign/save';
import type { Balance, Campaign, NewCampaignOptions } from './game/campaign/types';
import { loadRecord, saveCashRecord, saveDayRecord } from './game/record';
import type { DayConfig, DayResult } from './game/types';
import './styles.css';

type Screen = 'title' | 'nova' | 'preparo' | 'dia' | 'fechamento' | 'fim';

interface Closing {
  balance: Balance;
  served: number;
  lost: number;
}

const randomSeed = (): number => Math.floor(Math.random() * 4294967294) + 1;

/** Máquina de telas do jogo (plan.md 2.5). Grava nas transições (RN-55). */
export default function PastelDeFeira({ onExit }: GameProps) {
  const storage = useMemo(() => browserStorage(), []);
  const [loaded] = useState(() => load(storage));
  const [screen, setScreen] = useState<Screen>('title');
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [dayConfig, setDayConfig] = useState<DayConfig | null>(null);
  const [closing, setClosing] = useState<Closing | null>(null);
  const [warnSave, setWarnSave] = useState(false);
  const warned = useRef(false);

  const persist = (c: Campaign, phase: SavePhase) => {
    if (saveCampaign(storage, c, phase) || warned.current) return;
    warned.current = true; // aviso único: o jogo segue em memória (plan 5.1)
    setWarnSave(true);
  };

  const onContinue = () => {
    const save = loaded.save;
    if (!save) return;
    if (save.phase === 'dia') {
      const c = { ...save.campaign, resumes: save.campaign.resumes + 1 }; // nova semente (PA-13)
      persist(c, 'dia');
      setCampaign(c);
      setDayConfig(toDayConfig(c));
      setScreen('dia');
    } else {
      setCampaign(save.campaign);
      setScreen(save.phase === 'fim' ? 'fim' : 'preparo');
    }
  };

  const onStartNew = (opts: Omit<NewCampaignOptions, 'seed'>) => {
    const c = newCampaign({ ...opts, seed: randomSeed() });
    clearSave(storage);
    persist(c, 'preparo');
    setCampaign(c);
    setScreen('preparo');
  };

  const onDayDone = (result: DayResult) => {
    if (!campaign) return;
    const out = closeDay(campaign, result);
    if (out.balance.met) saveDayRecord(campaign.day);
    if (out.campaign.freeMode) saveCashRecord(out.campaign.cash);
    persist(out.campaign, out.balance.bankrupt ? 'fim' : 'preparo');
    const o = result.orders;
    setClosing({ balance: out.balance, served: o.served, lost: o.lostPatience + o.queueFull + o.lostPrice + o.noStock });
    setCampaign(out.campaign);
    setScreen('fechamento');
  };


  return (
    <div className="pastel-de-feira">
      {warnSave && <p className="warn banner" role="status">Não foi possível salvar o progresso. O jogo continua, mas ele pode se perder.</p>}
      {screen === 'title' && (
        <TitleScreen
          save={loaded.save}
          warning={loaded.aviso}
          record={loadRecord()}
          onContinue={onContinue}
          onNew={() => setScreen('nova')}
          onExit={onExit}
        />
      )}
      {screen === 'nova' && <NewCampaign onStart={onStartNew} onBack={() => setScreen('title')} />}
      {screen === 'preparo' && campaign && (
        <PrepScreen
          campaign={campaign}
          onChange={(c) => {
            setCampaign(c);
            persist(c, 'preparo');
          }}
          onOpen={() => {
            persist(campaign, 'dia'); // checkpoint do início do dia (JA-06)
            setDayConfig(toDayConfig(campaign));
            setScreen('dia');
          }}
          onExit={onExit}
        />
      )}
      {screen === 'dia' && campaign && dayConfig && (
        <DayScreen
          key={`${campaign.calendar}:${campaign.resumes}`}
          config={dayConfig}
          seed={daySeed(campaign)}
          onDone={onDayDone}
          onExit={onExit}
        />
      )}
      {screen === 'fechamento' && campaign && closing && (
        <ClosingScreen
          balance={closing.balance}
          campaign={campaign}
          served={closing.served}
          lost={closing.lost}
          onNext={() => setScreen(closing.balance.bankrupt ? 'fim' : 'preparo')}
        />
      )}
      {screen === 'fim' && campaign && (
        <EndScreen campaign={campaign} onNew={() => setScreen('nova')} onExit={onExit} />
      )}
    </div>
  );
}
