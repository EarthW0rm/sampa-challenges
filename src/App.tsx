import { GameHost } from './hub/GameHost';
import { HubHome } from './hub/HubHome';
import { useHashRoute } from './hub/useHashRoute';

export function App() {
  const route = useHashRoute();
  return route.page === 'game' ? <GameHost key={route.id} id={route.id} /> : <HubHome />;
}
