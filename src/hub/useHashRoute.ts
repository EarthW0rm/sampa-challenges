import { useEffect, useState } from 'react';

export type Route = { page: 'home' } | { page: 'game'; id: string };

function parse(hash: string): Route {
  const m = hash.match(/^#\/jogos\/([a-z0-9-]+)\/?$/);
  return m ? { page: 'game', id: m[1] } : { page: 'home' };
}

/** Rotas por hash (`#/` e `#/jogos/<id>`): funcionam em qualquer hospedagem estática. */
export function useHashRoute(): Route {
  const [route, setRoute] = useState(() => parse(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parse(window.location.hash));
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const gameHref = (id: string) => `#/jogos/${id}`;
export const homeHref = '#/';
