import { useState } from 'react';
import { canOpen, minReputation, profitGoal } from '../../game/campaign/campaign';
import type { Campaign } from '../../game/campaign/types';
import { money, rep1, stars } from '../format';
import { InventoryTab } from './InventoryTab';
import { MenuTab } from './MenuTab';

interface Props {
  campaign: Campaign;
  onChange: (c: Campaign) => void;
  onOpen: () => void;
  onExit: () => void;
}

type TabId = 'insumos' | 'cardapio';

/** Abas só aparecem quando desbloqueadas (RN-171). Melhorias, Equipe, Escritório e Associação entram nas US seguintes. */
function visibleTabs(_c: Campaign): { id: TabId; label: string }[] {
  return [
    { id: 'insumos', label: 'Insumos' },
    { id: 'cardapio', label: 'Cardápio' },
  ];
}

export function PrepScreen({ campaign: c, onChange, onOpen, onExit }: Props) {
  const [tab, setTab] = useState<TabId>('insumos');
  const tabs = visibleTabs(c);
  return (
    <main className="prep">
      <header className="prep-head">
        <div>
          <strong>Dia {c.day}</strong>
          {c.freeMode && ' · modo livre'}
        </div>
        <div>Caixa {money(c.cash)}</div>
        <div title={rep1(c.reputation)}>
          {stars(c.reputation)} {rep1(c.reputation)}
        </div>
        <div className="goal">
          {c.freeMode ? 'Sem meta' : `Meta: lucro ${money(profitGoal(c.day))} · reputação ${rep1(minReputation(c.day))}+`}
        </div>
      </header>
      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {tab === 'insumos' && <InventoryTab campaign={c} onChange={onChange} />}
      {tab === 'cardapio' && <MenuTab campaign={c} onChange={onChange} />}
      <footer className="prep-foot">
        <button type="button" onClick={onExit}>
          Sair
        </button>
        <button type="button" className="primary" onClick={onOpen} disabled={!canOpen(c)}>
          Abrir a feira
        </button>
      </footer>
    </main>
  );
}
