import { useState } from 'react';
import type { LoadWarning, SaveV2 } from '../game/campaign/save';

interface Props {
  save: SaveV2 | null;
  warning?: LoadWarning;
  record: number;
  onContinue: () => void;
  onNew: () => void;
  onExit: () => void;
}

const WARNING_TEXT: Record<LoadWarning, string> = {
  invalido: 'Progresso salvo inválido — nova campanha.',
  semPersistencia: 'O navegador bloqueou o armazenamento: o progresso não será salvo.',
};

export function TitleScreen({ save, warning, record, onContinue, onNew, onExit }: Props) {
  const [confirming, setConfirming] = useState(false);
  const day = save?.campaign.day;
  return (
    <main className="screen title">
      <h1>Pastel de Feira</h1>
      <p>Frite, atenda e faça a barraca crescer. Dia a dia, meta a meta.</p>
      {warning && <p className="warn" role="status">{WARNING_TEXT[warning]}</p>}
      {record > 0 && <p>Recorde: dia {record}</p>}
      <div className="menu moldura">
        {save && (
          <button type="button" className="primary" onClick={onContinue}>
            Continuar{day ? ` (dia ${day})` : ''}
          </button>
        )}
        {confirming ? (
          <>
            <p className="warn">Isso apaga a campanha salva. Tem certeza?</p>
            <button type="button" onClick={onNew}>Sim, apagar e começar outra</button>
            <button type="button" onClick={() => setConfirming(false)}>Cancelar</button>
          </>
        ) : (
          <button type="button" onClick={() => (save ? setConfirming(true) : onNew())}>
            Nova campanha
          </button>
        )}
        <button type="button" onClick={onExit}>Sair</button>
      </div>
    </main>
  );
}
