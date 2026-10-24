import { useState } from 'react';
import { PASTRY_PROFILES, type NewCampaignOptions, type PastryProfile } from '../game/campaign/types';

interface Props {
  onStart: (opts: Omit<NewCampaignOptions, 'seed'>) => void;
  onBack: () => void;
}

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
  const [started, setStarted] = useState(false);
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
        <input type="checkbox" checked={tutorial} onChange={(e) => setTutorial(e.target.checked)} />
        Tutorial no primeiro dia
      </label>
      <div className="row">
        <button
          type="button"
          className="primary"
          disabled={started}
          onClick={() => {
            setStarted(true);
            onStart({ profile, eventsOn, tutorial });
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
