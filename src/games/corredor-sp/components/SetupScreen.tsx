import { useEffect, useRef, useState } from 'react';
import { assetUrl, recolored, type Assets } from '../game/assets';
import { BREEDS, CATEGORIES, COLORS, MODELS, TRACKS, type BreedId, type CategoryId, type TrackId } from '../game/data';
import { loadRecord } from '../game/record';

export interface Choice {
  track: TrackId;
  breed: BreedId;
  category: CategoryId;
  modelId: string;
  colorId: string;
}

interface Props {
  assets: Assets;
  initial: Choice;
  onStart: (c: Choice) => void;
}

const dots = (n: number) => '●'.repeat(n) + '○'.repeat(5 - n);

export function SetupScreen({ assets, initial, onStart }: Props) {
  const [c, setC] = useState<Choice>(initial);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const color = COLORS.find((k) => k.id === c.colorId) ?? COLORS[0];
  const models = MODELS.filter((m) => m.category === c.category);

  // prévia da moto escolhida
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 80, 88);
    ctx.drawImage(recolored(assets, `motos/${c.breed}_${c.category}_reto`, color.hex), 0, 0);
  }, [assets, c.breed, c.category, color.hex]);

  const setCategory = (category: CategoryId) =>
    setC((prev) => ({ ...prev, category, modelId: MODELS.find((m) => m.category === category)!.id }));

  return (
    <main className="setup">
      <header className="setup-header">
        <h1>CORREDOR SP</h1>
        <p>Enduro de motoboy pelas avenidas de São Paulo. Pontos = (segundos + metros ÷ 10) × (1 + pacotes): quanto mais rápido, mais pontos.</p>
      </header>

      <section className="block">
        <h2>Pista</h2>
        <div className="cards three">
          {TRACKS.map((t) => {
            const rec = loadRecord(t.id);
            return (
              <button
                type="button"
                key={t.id}
                className={`card track ${c.track === t.id ? 'selected' : ''}`}
                aria-pressed={c.track === t.id}
                onClick={() => setC({ ...c, track: t.id })}
              >
                <img src={assetUrl(`horizonte/${t.id}_dia`)} alt="" />
                <span className="card-title">{t.name}</span>
                <span className="card-desc">{t.description}</span>
                {rec > 0 && <span className="card-record">Recorde {rec}</span>}
              </button>
            );
          })}
        </div>
      </section>

      <div className="split">
        <div className="split-main">
          <section className="block">
            <h2>Cachorro</h2>
            <div className="chips">
              {BREEDS.map((b) => (
                <button type="button" key={b.id} className={`chip ${c.breed === b.id ? 'selected' : ''}`} aria-pressed={c.breed === b.id} onClick={() => setC({ ...c, breed: b.id })}>
                  {b.name}
                </button>
              ))}
            </div>
          </section>

          <section className="block">
            <h2>Categoria</h2>
            <div className="cards three">
              {CATEGORIES.map((k) => (
                <button type="button" key={k.id} className={`card ${c.category === k.id ? 'selected' : ''}`} aria-pressed={c.category === k.id} onClick={() => setCategory(k.id)}>
                  <span className="card-title">
                    {k.name} <small>{k.id}cc</small>
                  </span>
                  <span className="card-desc">{k.desc}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="block">
            <h2>Modelo</h2>
            <div className="models">
              {models.map((m) => (
                <button type="button" key={m.id} className={`model ${c.modelId === m.id ? 'selected' : ''}`} aria-pressed={c.modelId === m.id} onClick={() => setC({ ...c, modelId: m.id })}>
                  <span className="card-title">{m.name}</span>
                  <span className="stat">
                    <span>Vel. máx.</span>
                    <b>{m.vmax} km/h</b>
                  </span>
                  <span className="stat">
                    <span>Aceleração</span>
                    <b className="dots">{dots(m.dots.acc)}</b>
                  </span>
                  <span className="stat">
                    <span>Freio</span>
                    <b className="dots">{dots(m.dots.brk)}</b>
                  </span>
                  <span className="stat">
                    <span>Controle</span>
                    <b className="dots">{dots(m.dots.ctl)}</b>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="block">
            <h2>Cor</h2>
            <div className="swatches">
              {COLORS.map((k) => (
                <button
                  type="button"
                  key={k.id}
                  className={`swatch ${c.colorId === k.id ? 'selected' : ''}`}
                  aria-pressed={c.colorId === k.id}
                  aria-label={k.name}
                  title={k.name}
                  style={{ background: k.hex }}
                  onClick={() => setC({ ...c, colorId: k.id })}
                />
              ))}
            </div>
          </section>
        </div>

        <aside className="preview">
          <canvas ref={canvasRef} width={80} height={88} aria-label="Prévia da moto escolhida" />
          <p>
            {BREEDS.find((b) => b.id === c.breed)?.name}
            <br />
            {MODELS.find((m) => m.id === c.modelId)?.name} · {color.name.toLowerCase()}
          </p>
          <button type="button" className="start" onClick={() => onStart(c)}>
            Correr!
          </button>
        </aside>
      </div>

      <section className="block help">
        <h2>Controles</h2>
        <ul>
          <li>
            <b>↑ / W</b> acelera · <b>↓ / S</b> freia · <b>← → / A D</b> muda de faixa
          </li>
          <li>
            <b>Espaço</b> segura o grau (mais rápido, direção pela metade) · <b>X / Enter</b> arremessa capacete · <b>P / Esc</b> pausa
          </li>
          <li>Celular: a moto acelera sozinha; use os botões na tela.</li>
          <li>Ultrapassar pelo corredor recarrega o grau; na faixa azul recarrega mais. Bateu: perde uma vida e volta do zero.</li>
        </ul>
      </section>
    </main>
  );
}
