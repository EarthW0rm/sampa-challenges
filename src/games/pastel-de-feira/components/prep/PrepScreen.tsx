import { useState } from 'react';
import { loadSeen, pendingUnlock, saveSeen } from '../../game/unlocks';
import { openWarning } from '../../game/campaign/warnings';
import { canOpen, minReputation, profitGoal } from '../../game/campaign/campaign';
import { respondClaim } from '../../game/campaign/events';
import { seasonOf } from '../../game/campaign/season';
import { FORECAST_NAME, SEASON_EFFECTS, SEASON_NAME } from '../../game/data/events';
import type { Campaign } from '../../game/campaign/types';
import { money, rep1, stars } from '../format';
import { InventoryTab } from './InventoryTab';
import { AssociationTab } from './AssociationTab';
import { MenuTab } from './MenuTab';
import { OfficeTab } from './OfficeTab';
import { StaffTab } from './StaffTab';
import { ThemeDialog } from './ThemeDialog';
import { UpgradesTab } from './UpgradesTab';

interface Props {
  campaign: Campaign;
  /** Passar o ponto depois de zerar (RN-57). */
  onHandover?: () => void;
  onChange: (c: Campaign) => void;
  onOpen: () => void;
  onExit: () => void;
}

type TabId = 'insumos' | 'cardapio' | 'melhorias' | 'equipe' | 'escritorio' | 'associacao';

/** Abas só aparecem quando desbloqueadas (RN-171). Melhorias, Equipe, Escritório e Associação entram nas US seguintes. */
function visibleTabs(c: Campaign): { id: TabId; label: string }[] {
  const tabs: { id: TabId; label: string }[] = [
    { id: 'insumos', label: 'Insumos' },
    { id: 'cardapio', label: 'Cardápio' },
    { id: 'melhorias', label: 'Melhorias' },
  ];
  if (c.day >= 2 || c.staff.length > 0) tabs.push({ id: 'equipe', label: 'Equipe' });
  if (c.owned.office) tabs.push({ id: 'escritorio', label: 'Escritório' });
  if (c.day >= 3 || c.challenges.length > 0) tabs.push({ id: 'associacao', label: 'Associação' });
  return tabs;
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function PrepScreen({ campaign: c, onChange, onOpen, onExit, onHandover }: Props) {
  const [tab, setTab] = useState<TabId>('insumos');
  const [themeDismissed, setThemeDismissed] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const tabs = visibleTabs(c);
  const [seen, setSeen] = useState<string[]>(() => loadSeen(safeStorage()));
  const unlock = pendingUnlock(c.day, seen);
  const dismissUnlock = () => {
    if (!unlock) return;
    const next = [...seen, unlock.id];
    setSeen(next);
    saveSeen(safeStorage(), next);
  };
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
      <section className="item forecast" aria-label="Previsão do dia">
        <strong>
          {SEASON_NAME[seasonOf(c.day)]}
          {c.forecast ? ` · previsão: ${FORECAST_NAME[c.forecast]}` : c.eventsOn && c.day >= 4 ? ' · sem evento previsto' : ''}
        </strong>
        <span className="muted">
          {SEASON_EFFECTS[seasonOf(c.day)].drink > 1 ? 'Mais caldo e mais cansaço. ' : SEASON_EFFECTS[seasonOf(c.day)].drink < 1 ? 'Menos caldo, mais pedidos de 2 pastéis. ' : ''}
          {c.forecast === 'chuva' && 'Menos gente no balcão, mais comandas do app, mesas com metade da procura.'}
          {c.forecast === 'calor' && 'Caldo +50% e a equipe cansa mais.'}
          {c.forecast === 'subprefeitura' && 'Mesas proibidas na calçada hoje.'}
        </span>
        {c.claim === 'pendente' && (
          <div className="claim" role="dialog" aria-label="Reivindicação da equipe">
            <p className="warn">A equipe chegou ao limite e quer uma resposta antes de abrir:</p>
            <div className="row">
              <button type="button" disabled={!respondClaim(c, 'pausa').ok} onClick={() => { const r = respondClaim(c, 'pausa'); if (r.ok) onChange(r.campaign); }}>
                Pausa (exige área de descanso)
              </button>
              <button type="button" onClick={() => { const r = respondClaim(c, 'aumento'); if (r.ok) onChange(r.campaign); }}>
                Aumento de 10% por 3 dias
              </button>
              <button type="button" onClick={() => { const r = respondClaim(c, 'recusada'); if (r.ok) onChange(r.campaign); }}>
                Recusar (−15% de velocidade hoje)
              </button>
            </div>
          </div>
        )}
      </section>
      {c.freeMode && onHandover && (
        <button type="button" onClick={onHandover}>
          Passar o ponto
        </button>
      )}
      {unlock && (
        <aside className="unlock" role="status" aria-label={`Novidade: ${unlock.title}`}>
          <p>
            <strong>{unlock.title}.</strong> {unlock.text}
          </p>
          <button type="button" onClick={dismissUnlock}>
            Entendi
          </button>
        </aside>
      )}
      <nav className="tabs" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </nav>
      {((c.theme === null && c.day >= 5 && !themeDismissed) || themeOpen) && (
        <ThemeDialog campaign={c} onChange={onChange} onClose={() => { setThemeDismissed(true); setThemeOpen(false); }} />
      )}
      {c.day >= 5 && c.theme !== null && !themeOpen && (
        <button type="button" onClick={() => setThemeOpen(true)}>
          Tema: {c.theme}
        </button>
      )}
      {tab === 'insumos' && <InventoryTab campaign={c} onChange={onChange} />}
      {tab === 'cardapio' && <MenuTab campaign={c} onChange={onChange} />}
      {tab === 'melhorias' && <UpgradesTab campaign={c} onChange={onChange} />}
      {tab === 'equipe' && <StaffTab campaign={c} onChange={onChange} />}
      {tab === 'escritorio' && c.owned.office && <OfficeTab campaign={c} onChange={onChange} />}
      {tab === 'associacao' && <AssociationTab campaign={c} onChange={onChange} />}
      {confirmOpen && (
        <div className="overlay" role="dialog" aria-label="Aviso antes de abrir a feira">
          <div className="menu">
            <h2>Antes de abrir</h2>
            {openWarning(c)?.lines.map((l) => (
              <p key={l} className="warn">
                {l}
              </p>
            ))}
            <button type="button" className="primary" onClick={() => setConfirmOpen(false)}>
              Voltar e comprar
            </button>
            <button type="button" onClick={onOpen}>
              Abrir mesmo assim
            </button>
          </div>
        </div>
      )}
      <footer className="prep-foot">
        <button type="button" onClick={onExit}>
          Sair
        </button>
        <button type="button" className="primary" onClick={() => (openWarning(c) ? setConfirmOpen(true) : onOpen())} disabled={!canOpen(c)}>
          Abrir a feira
        </button>
      </footer>
    </main>
  );
}
