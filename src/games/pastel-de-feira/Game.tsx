import { useEffect, useRef } from 'react';
import type { GameProps } from '../../hub/types';
import { H, W } from './game/constants';
import { SCALE } from './game/hires';
import './styles.css';

/** Placeholder da TF-110-01: limpa o canvas 640×480 com a cor da feira. */
export default function PastelDeFeira({ onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#e8a13a';
    ctx.fillRect(0, 0, W, H);
  }, []);

  return (
    <div className="pastel-de-feira">
      <main className="screen">
        <h1>Pastel de Feira</h1>
        <canvas ref={canvasRef} width={W * SCALE} height={H * SCALE} aria-label="Área do jogo" />
        <p>Em obras.</p>
        <button type="button" onClick={onExit}>
          Voltar para os jogos
        </button>
      </main>
    </div>
  );
}
