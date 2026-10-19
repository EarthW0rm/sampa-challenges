import { useEffect } from 'react';
import { assetUrl, type AssetKey } from '../game/assets';
import { loadRecord } from '../game/record';

interface Props {
  onStart: () => void;
}

const BOXES: { key: AssetKey; name: string; desc: string }[] = [
  { key: 'caixa', name: 'Pedido', desc: '+1 ponto' },
  { key: 'turbo', name: 'Turbo', desc: 'moto mais rápida' },
  { key: 'grau', name: 'Grau', desc: 'pega mais alto' },
  { key: 'ima', name: 'Ímã', desc: 'puxa os pacotes' },
  { key: 'vida', name: 'Vida', desc: '+1 coração' },
  { key: 'dobro', name: 'Dobro', desc: 'pontos ×2' },
  { key: 'bomba_0', name: 'Bomba', desc: 'não pegue!' },
];

export function TitleScreen({ onStart }: Props) {
  const record = loadRecord();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        e.preventDefault();
        onStart();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <main className="title">
      <img className="title-dog" src={assetUrl('cachorro_grau_0')} alt="" aria-hidden="true" />
      <h1>CACHORRO LOKO</h1>
      <p className="tagline">Pegue os pedidos do LOKO DOG antes que caiam na rua.</p>

      <button type="button" className="start" onClick={onStart} autoFocus>
        Jogar
      </button>
      {record > 0 && <p className="record">Recorde: {record}</p>}

      <section className="how">
        <h2>Como jogar</h2>
        <ul>
          <li>
            <strong>← →</strong> ou <strong>A / D</strong> para andar. No celular, segure o lado esquerdo ou direito da tela.
          </li>
          <li>
            No fim de cada esteira o desvio <span className="green">verde</span> manda o pacote para a esteira de baixo e o{' '}
            <span className="red">vermelho</span> joga na rua. A cada pacote que passa o desvio troca: se o primeiro
            desceu, o segundo vai para a rua.
          </li>
          <li>Pacote que cai no chão tira uma vida. São 3 vidas.</li>
          <li>
            <strong>P</strong> ou <strong>Esc</strong> pausa.
          </li>
        </ul>
        <div className="legend">
          {BOXES.map((b) => (
            <div key={b.key} className="legend-item">
              <img src={assetUrl(b.key)} alt="" />
              <span className="legend-name">{b.name}</span>
              <span className="legend-desc">{b.desc}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
