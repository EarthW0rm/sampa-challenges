import { useEffect, useRef } from 'react';
import type { GameProps } from '../../hub/types';
import capaUrl from './assets/capa.png';
import { H, PLAYER_SIZE, PLAYER_SPEED, W } from './game/constants';
import { exposeGame } from './game/e2eHook';
import { blit, SCALE, scale2x } from './game/hires';
import './styles.css';

/**
 * Ponto de partida de um jogo novo: um quadrado que anda com as setas sobre a capa.
 *
 * Padrão de resolução do hub: canvas de 640×400 (W·SCALE × H·SCALE), lógica em 320×200.
 * O `render` começa com `ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)`, então tudo é desenhado em
 * coordenadas lógicas; sprites passam pelo `scale2x` uma vez e são desenhados com `blit`.
 *
 * Troque tudo à vontade — o hub só precisa deste componente (export default) e do manifest.ts.
 */
export default function __COMPONENTE__({ onExit }: GameProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const ctx = canvasRef.current!.getContext('2d')!;
    let bg: HTMLCanvasElement | null = null;
    const img = new Image();
    img.onload = () => (bg = scale2x(img)); // sprite em alta, calculado uma vez
    img.src = capaUrl;
    const keys = new Set<string>();
    const player = { x: 150, y: 140 };
    const down = (e: KeyboardEvent) => keys.add(e.code);
    const up = (e: KeyboardEvent) => keys.delete(e.code);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    // gancho dos testes de ponta a ponta (inerte para o jogador)
    const disposeE2E = exposeGame(player);

    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.max(0, Math.min((now - last) / 1000, 0.05));
      last = now;
      const speed = PLAYER_SPEED * dt;
      if (keys.has('ArrowLeft')) player.x -= speed;
      if (keys.has('ArrowRight')) player.x += speed;
      if (keys.has('ArrowUp')) player.y -= speed;
      if (keys.has('ArrowDown')) player.y += speed;
      player.x = Math.max(0, Math.min(W - PLAYER_SIZE, player.x));
      player.y = Math.max(0, Math.min(H - PLAYER_SIZE, player.y));

      ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0);
      ctx.imageSmoothingEnabled = false;
      if (bg) blit(ctx, bg, 0, 0);
      ctx.fillStyle = '#ffd36b';
      // meio pixel lógico = 1 pixel de tela: movimento mais suave
      const px = Math.round(player.x * SCALE) / SCALE;
      const py = Math.round(player.y * SCALE) / SCALE;
      ctx.fillRect(px, py, PLAYER_SIZE, PLAYER_SIZE);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      disposeE2E();
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  return (
    <div className="__ID__">
      <main className="screen">
        <h1>__TITULO__</h1>
        <canvas ref={canvasRef} width={W * SCALE} height={H * SCALE} aria-label="Área do jogo" />
        <p>Use as setas para mover o quadrado. Edite src/games/__ID__/Game.tsx para começar.</p>
        <button type="button" onClick={onExit}>
          Voltar para os jogos
        </button>
      </main>
    </div>
  );
}
