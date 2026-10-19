import { useEffect } from 'react';
import { assetUrl } from '../game/assets';
import { loadRecord } from '../game/record';
import { sfx } from '../game/sound';

interface Props {
  onStart: () => void;
}

export function TitleScreen({ onStart }: Props) {
  const record = loadRecord();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        sfx.unlock();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <main className="title">
      <div className="title-hero">
        <img className="title-table" src={assetUrl('fundo')} alt="" aria-hidden="true" />
        <div className="title-text">
          <img className="title-dog" src={assetUrl('cachorro_grau')} alt="" aria-hidden="true" />
          <h1>PINBALL PAULISTA</h1>
          <p className="tagline">Motoboy na Avenida Paulista: bata nos semáforos, acenda MOTOBOY e não deixe a bola cair.</p>
          <button type="button" className="start" onClick={onStart} autoFocus>
            Jogar
          </button>
          {record > 0 && <p className="record">Recorde: {record}</p>}
        </div>
      </div>

      <section className="how">
        <h2>Como jogar</h2>
        <ul>
          <li>
            <strong>Espaço</strong> (segure e solte) lança a bola: quanto mais tempo, mais forte. No celular, segure o botão{' '}
            <strong>Lançar</strong>.
          </li>
          <li>
            <strong>← / Z</strong> flipper esquerdo, <strong>→ / /</strong> flipper direito. No celular, toque na metade esquerda ou direita
            da mesa. Apertar um flipper com a bola longe troca as luzes das raias do topo.
          </li>
          <li>
            <strong>N</strong> (ou o botão Sacudir) dá um tranco na mesa. Mais de {3} trancos seguidos e dá <span className="red">TILT</span>: os
            flippers desligam e a bola é perdida sem bônus.
          </li>
          <li>
            <strong>P</strong> ou <strong>Esc</strong> pausa. São 3 bolas.
          </li>
        </ul>
        <h2>A mesa</h2>
        <ul>
          <li>
            <strong className="green">Semáforos</strong> (bumpers): 3 batidas deixam amarelo e 6 deixam verde. Os 3 verdes ao mesmo tempo
            ligam a <strong>Onda Verde</strong> (bumpers em dobro por 15 s).
          </li>
          <li>
            <strong>Raias do topo</strong>: acenda as 3 para subir o multiplicador do bônus de fim de bola (até ×5).
          </li>
          <li>
            <strong>MOTOBOY</strong>: as placas nas guias dos corredores azuis. Acesas as 7 letras, começa o <strong>Multiball</strong>.
          </li>
          <li>
            <strong>Minhocão</strong>: o buraco no meio prende a bola e dá um prêmio surpresa (bônus, letra, multiplicador, segura-bola, bola
            extra…).
          </li>
          <li>
            <strong>Segura-bola</strong>: nos primeiros {12} s depois de lançar, se a bola cair ela volta de graça.
          </li>
        </ul>
      </section>
    </main>
  );
}
