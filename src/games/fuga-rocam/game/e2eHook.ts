import { exposeE2E } from '../../../shared/e2e/hook';
import type { FugaEngine } from './engine';
import type { Dir, ItemKind, JobKind } from './types';

/** Retrato do motor lido pelos testes (`FugaEngine.e2eState()`: `snapshot()` + mapa, pedido, itens, viaturas…). */
export type FugaState = ReturnType<FugaEngine['e2eState']>;
/** Alvos em coordenadas lógicas 640×400 (`FugaEngine.e2eTargets()`). */
export type FugaTargets = ReturnType<FugaEngine['e2eTargets']>;

/**
 * Gancho dos testes de ponta a ponta (`e2e/fuga-rocam`). Só existe quando a página de teste liga a flag
 * (`src/shared/e2e/hook.ts`); para o jogador é inerte. Os testes jogam pela tela: `state()` e `targets()`
 * só leem. `prepare` (sobre o `cheat` do motor) é só para pré-condição rara, comentada em cada teste.
 */
export interface FugaE2E {
  state(): FugaState;
  targets(): FugaTargets;
  /** Linhas do mapa como texto (um caractere por tile). */
  tiles(): string[];
  prepare: {
    heat(v: number): void;
    item(kind: ItemKind, tx: number, ty: number): void;
    cop(cls: 'moto' | 'car', tx: number, ty: number, dir?: Dir): void;
    jobKind(kind: JobKind): void;
    lives(n: number): void;
  };
}

/** Publica o gancho do motor montado; devolve o `dispose` do cleanup do efeito. */
export function exposeFuga(engine: FugaEngine): () => void {
  return exposeE2E<FugaE2E>('fuga-rocam', {
    state: () => engine.e2eState(),
    targets: () => engine.e2eTargets(),
    tiles: () => engine.map.tiles.map((r) => r.join('')),
    prepare: {
      heat: (v) => engine.cheat.heat(v),
      item: (kind, tx, ty) => engine.cheat.item(kind, tx, ty),
      cop: (cls, tx, ty, dir) => engine.cheat.cop(cls, tx, ty, dir),
      jobKind: (kind) => engine.cheat.jobKind(kind),
      lives: (n) => engine.cheat.lives(n),
    },
  });
}
