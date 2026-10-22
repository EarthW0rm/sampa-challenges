import { useEffect, type CSSProperties } from 'react';
import { games } from './registry';
import { gameHref } from './useHashRoute';

export function HubHome() {
  useEffect(() => {
    document.title = 'Sampa Challenges';
  }, []);

  return (
    <main className="hub-home">
      <header className="hub-hero">
        <p className="hub-kicker">Jogos em pixel art feitos em São Paulo</p>
        <h1>SAMPA CHALLENGES</h1>
        <p className="hub-lead">Escolha um desafio.</p>
      </header>

      {games.length === 0 ? (
        <p className="hub-empty">Nenhum jogo encontrado em src/games/.</p>
      ) : (
        <ul className="hub-grid">
          {games.map((g) => {
            const record = g.getRecord?.() ?? null;
            return (
              <li key={g.id} className="hub-card" style={{ '--card-accent': g.accent } as CSSProperties}>
                <a href={gameHref(g.id)} className="hub-card-link">
                  <div className="hub-cover">
                    <img src={g.cover} alt="" />
                  </div>
                  <div className="hub-card-body">
                    <h2>{g.title}</h2>
                    <p>{g.description}</p>
                    <div className="hub-tags">
                      {g.tags.map((t) => (
                        <span key={t} className="hub-tag">
                          {t}
                        </span>
                      ))}
                    </div>
                    <div className="hub-card-foot">
                      <span className="hub-play">Jogar →</span>
                      {record !== null && record > 0 && <span className="hub-record">Recorde {record}</span>}
                    </div>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="hub-footer">
        {games.length} {games.length === 1 ? 'jogo' : 'jogos'}
      </footer>
    </main>
  );
}
