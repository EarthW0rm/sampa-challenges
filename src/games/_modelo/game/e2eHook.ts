import { exposeE2E } from '../../../shared/e2e/hook';
import { H, PLAYER_SIZE, W } from './constants';

/**
 * Gancho dos testes de ponta a ponta (`e2e/__ID__`). Só existe quando a página de teste liga a flag
 * (`src/shared/e2e/hook.ts`); para o jogador é inerte. Só leitura: os testes jogam pela tela.
 */
export interface __COMPONENTE__E2E {
  state(): { player: { x: number; y: number }; size: number; bounds: { w: number; h: number } };
  /** Alvos em coordenadas lógicas (onde o teste clicaria). */
  targets(): { player: { x: number; y: number; w: number; h: number } };
}

/** Publica o gancho com o estado vivo do jogo; devolve o `dispose` do cleanup do efeito. */
export function exposeGame(player: { x: number; y: number }): () => void {
  return exposeE2E<__COMPONENTE__E2E>('__ID__', {
    state: () => ({ player: { x: player.x, y: player.y }, size: PLAYER_SIZE, bounds: { w: W, h: H } }),
    targets: () => ({ player: { x: player.x, y: player.y, w: PLAYER_SIZE, h: PLAYER_SIZE } }),
  });
}
