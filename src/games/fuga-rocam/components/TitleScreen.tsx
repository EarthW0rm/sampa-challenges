import { useEffect, useRef } from 'react';
import { assetUrl } from '../game/assets';
import { drawThumb } from '../game/mapArt';
import { MAPS } from '../game/maps';
import { loadRecord } from '../game/record';
import { sfx } from '../game/sound';
import type { MapId } from '../game/types';
import { COLS, ROWS, TILE } from '../game/constants';
import { SCALE } from '../game/hires';

interface Props {
  onStart: (map: MapId) => void;
}

function Thumb({ index }: { index: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    drawThumb(ref.current!, MAPS[index]);
  }, [index]);
  return <canvas ref={ref} width={COLS * TILE * SCALE} height={ROWS * TILE * SCALE} aria-hidden="true" />;
}

export function TitleScreen({ onStart }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key);
      if (n >= 1 && n <= MAPS.length) {
        sfx.unlock();
        onStart(MAPS[n - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onStart]);

  return (
    <main className="title">
      <div className="title-hero">
        <img className="title-dog" src={assetUrl('cachorro_grau')} alt="" aria-hidden="true" />
        <div className="title-text">
          <h1>FUGA DA ROCAM</h1>
          <p className="tagline">Pegue o pedido, entregue no destino e despiste as viaturas pelas ruas de São Paulo. Quanto mais entregas, mais procurado você fica.</p>
        </div>
      </div>

      <section className="maps" aria-label="Escolha o mapa">
        {MAPS.map((m, i) => {
          const rec = loadRecord(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className="map-card"
              style={{ ['--map-accent' as string]: m.accent }}
              onClick={() => {
                sfx.unlock();
                onStart(m.id);
              }}
              autoFocus={i === 0}
            >
              <Thumb index={i} />
              <span className="map-name">
                {i + 1}. {m.name}
              </span>
              <span className="map-sub">{m.subtitle}</span>
              <span className="map-blurb">{m.blurb}</span>
              <span className="map-rec">{rec > 0 ? `Recorde: ${rec.toLocaleString('pt-BR')}` : 'Sem recorde ainda'}</span>
            </button>
          );
        })}
      </section>

      <section className="how">
        <h2>Como jogar</h2>
        <ul>
          <li>
            <strong>Setas</strong> ou <strong>WASD</strong> escolhem a direção: a moto segue em frente até a próxima esquina e faz a curva
            quando der. No celular, deslize o dedo no mapa ou use o direcional.
          </li>
          <li>
            Pegue o <strong className="yellow">pino amarelo</strong> e leve ao <strong className="green">pino verde</strong>. Entregou? Já
            vem outro pedido.
          </li>
          <li>
            <strong>Espaço</strong> / <strong>Shift</strong> liga o turbo (acaba rápido). <strong>X</strong> solta uma mancha de óleo que derruba
            a viatura que passar por cima.
          </li>
          <li>
            As <strong>garagens</strong> (portões nas pontas das ruas) escondem você por até 4 s e esfriam o procurado. Depois trancam por 6 s.
          </li>
          <li>
            Quanto mais tempo à vista, mais <strong className="red">estrelas</strong>: viaturas de carro e moto, cada uma com um jeito de caçar, e
            até helicóptero. Mais estrelas também valem mais pontos.
          </li>
          <li>
            Pedidos especiais: <strong>frágil</strong> (sem turbo, vale o dobro), <strong>urgente</strong> (tem tempo, dá bônus) e{' '}
            <strong>pesado</strong> (mais lento, paga bem). Itens: turbo, óleo, capacete (escudo), pizza e vida extra.
          </li>
          <li>
            São 3 vidas. <strong>P</strong> ou <strong>Esc</strong> pausa. As faixas azuis e os becos de paralelepípedo são atalhos.
          </li>
        </ul>
      </section>
    </main>
  );
}
