import { useState } from 'react';
import { CAMPAIGN_DAYS, defaultStartCash, MAX_START_CASH } from '../game/campaign/campaign';
import { PASTRY_PROFILES, type NewCampaignOptions, type PastryProfile } from '../game/campaign/types';

interface Props {
  onStart: (opts: Omit<NewCampaignOptions, 'seed'>) => void;
  onBack: () => void;
}

const money = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const CASH_STEP = 100;

const PROFILE_INFO: Record<PastryProfile, { name: string; text: string }> = {
  tradicional: { name: 'Tradicional', text: 'Sem bônus. Começa com R$ 100 a mais no caixa.' },
  negociante: { name: 'Negociante', text: 'Insumos 10% mais baratos.' },
  chapeiro: { name: 'Chapeiro', text: 'Janela do ponto +1 s nas suas ações.' },
  'boa-praca': { name: 'Boa-praça', text: 'Clientes 15% mais pacientes.' },
  gestor: { name: 'Gestor', text: 'Salários 10% menores.' },
};

export function NewCampaign({ onStart, onBack }: Props) {
  const [profile, setProfile] = useState<PastryProfile>('tradicional');
  const [eventsOn, setEventsOn] = useState(true);
  const [tutorial, setTutorial] = useState(true);
  const [extraCash, setExtraCash] = useState(0);
  const [startDay, setStartDay] = useState(1);
  const [staffFatigue, setStaffFatigue] = useState(true);
  const [unlockAll, setUnlockAll] = useState(false);
  const [started, setStarted] = useState(false);
  const base = defaultStartCash(profile);
  const cash = Math.min(MAX_START_CASH, base + extraCash);
  return (
    <main className="screen new">
      <h1>Nova campanha</h1>
      <fieldset className="profiles">
        <legend>Perfil do pasteleiro</legend>
        {PASTRY_PROFILES.map((p) => (
          <label key={p} className={`choice${profile === p ? ' on' : ''}`}>
            <input type="radio" name="perfil" checked={profile === p} onChange={() => setProfile(p)} />
            <span className="choice-name">{PROFILE_INFO[p].name}</span>
            <span className="choice-text">{PROFILE_INFO[p].text}</span>
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={eventsOn} onChange={(e) => setEventsOn(e.target.checked)} />
        Eventos (chuva, fiscal, queda de energia…)
      </label>
      <label className="check">
        <input type="checkbox" checked={tutorial && startDay === 1} disabled={startDay > 1} onChange={(e) => setTutorial(e.target.checked)} />
        Tutorial no primeiro dia
      </label>
      <fieldset className="options">
        <legend>Opções da campanha</legend>
        <div className="option">
          <span id="pf-capital">Capital inicial</span>
          <div className="stepper" role="group" aria-labelledby="pf-capital">
            <button type="button" aria-label="Diminuir o capital" disabled={extraCash <= 0} onClick={() => setExtraCash(Math.max(0, extraCash - CASH_STEP))}>
              −
            </button>
            <span>{money(cash)}</span>
            <button type="button" aria-label="Aumentar o capital" disabled={cash >= MAX_START_CASH} onClick={() => setExtraCash(extraCash + CASH_STEP)}>
              +
            </button>
          </div>
        </div>
        <label className="option">
          Começar no dia
          <select value={startDay} onChange={(e) => setStartDay(Number(e.target.value))}>
            {Array.from({ length: CAMPAIGN_DAYS }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                Dia {d}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={staffFatigue} onChange={(e) => setStaffFatigue(e.target.checked)} />
          Funcionários cansam (energia e descanso)
        </label>
        <label className="check">
          <input type="checkbox" checked={unlockAll} onChange={(e) => setUnlockAll(e.target.checked)} />
          Liberar todas as melhorias desde o início
        </label>
      </fieldset>
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={started}
          onClick={() => {
            setStarted(true);
            onStart({ profile, eventsOn, tutorial: tutorial && startDay === 1, startCash: cash, startDay, staffFatigue, unlockAll });
          }}
        >
          Começar
        </button>
        <button type="button" onClick={onBack} disabled={started}>
          Voltar
        </button>
      </div>
    </main>
  );
}
