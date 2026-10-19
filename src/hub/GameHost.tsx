import { Component, lazy, Suspense, useEffect, type ComponentType, type ReactNode } from 'react';
import { findGame } from './registry';
import type { GameManifest, GameProps } from './types';
import { homeHref } from './useHashRoute';

// Um lazy() por jogo, criado uma vez só (senão o React remonta o jogo a cada render).
const lazyCache = new Map<string, ComponentType<GameProps>>();
function lazyGame(m: GameManifest) {
  let c = lazyCache.get(m.id);
  if (!c) {
    c = lazy(m.load);
    lazyCache.set(m.id, c);
  }
  return c;
}

class GameErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="hub-message">
          <p>O jogo travou: {this.state.error.message}</p>
          <a href={homeHref}>Voltar para os jogos</a>
        </div>
      );
    }
    return this.props.children;
  }
}

export function GameHost({ id }: { id: string }) {
  const manifest = findGame(id);

  useEffect(() => {
    document.title = manifest ? `${manifest.title} · Sampa Challenges` : 'Sampa Challenges';
    window.scrollTo(0, 0);
  }, [manifest]);

  if (!manifest) {
    return (
      <div className="hub-message">
        <p>Jogo “{id}” não encontrado.</p>
        <a href={homeHref}>Voltar para os jogos</a>
      </div>
    );
  }

  const GameRoot = lazyGame(manifest);
  const exit = () => {
    window.location.hash = homeHref;
  };

  return (
    <div className="hub-game">
      <header className="hub-bar">
        <a href={homeHref} className="hub-back">
          ← Sampa Challenges
        </a>
        <span className="hub-bar-title">{manifest.title}</span>
      </header>
      <GameErrorBoundary key={manifest.id}>
        <Suspense fallback={<div className="hub-message">Carregando {manifest.title}…</div>}>
          <GameRoot onExit={exit} />
        </Suspense>
      </GameErrorBoundary>
    </div>
  );
}
