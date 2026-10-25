/** Balões de desbloqueio do Preparo (RN-171): cada sistema novo é apresentado uma única vez. */

export interface Unlock {
  id: string;
  /** Primeiro dia em que o sistema fica disponível. */
  day: number;
  /** Liberado desde o dia 1 com a opção "liberar melhorias" da campanha (RN-55a); o tema segue o dia. */
  liberable: boolean;
  title: string;
  text: string;
}

export const UNLOCKS: readonly Unlock[] = [
  { id: 'equipe', day: 2, liberable: true, title: 'Equipe', text: 'Contrate funcionários na aba Equipe. Eles cansam: fique de olho na energia.' },
  { id: 'associacao', day: 3, liberable: true, title: 'Associação', text: 'A aba Associação oferece desafios com prêmio em dinheiro e reputação.' },
  { id: 'delivery', day: 5, liberable: true, title: 'Delivery', text: 'Ofertas do app aparecem na faixa de avisos durante o dia: toque para aceitar e embale antes do motoboy chegar.' },
  { id: 'tema', day: 5, liberable: false, title: 'Tema da barraca', text: 'Escolha um tema para a barraca: ele muda o público e os preços.' },
  { id: 'especial', day: 6, liberable: true, title: 'Especial da Casa', text: 'O Especial da Casa é um pastel grande e caro: ocupa dois cestos e rende mais.' },
  { id: 'escritorio', day: 10, liberable: true, title: 'Escritório', text: 'O escritório libera cargos que ajudam a barraca: o pasteleiro ganha bônus enquanto estiver nele.' },
];

const KEY = 'pastel-de-feira:visto';

export interface SeenStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Ids já vistos. Valor ausente, corrompido ou storage indisponível = lista vazia (os balões reaparecem). */
export function loadSeen(store: SeenStore | null): string[] {
  try {
    const raw = store?.getItem(KEY);
    if (!raw) return [];
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSeen(store: SeenStore | null, seen: readonly string[]): void {
  try {
    store?.setItem(KEY, JSON.stringify(seen));
  } catch {
    /* modo privado ou cota cheia: o balão pode voltar na próxima visita */
  }
}

/** Dia em que o sistema `id` fica disponível (RN-171). */
export const unlockDay = (id: string): number => UNLOCKS.find((u) => u.id === id)?.day ?? 1;

/**
 * Próximo balão a mostrar no dia `day` (o mais antigo ainda não visto), ou null. `unlockAll`: a opção
 * "liberar melhorias" da campanha (RN-55a) apresenta desde já o que ela libera.
 */
export function pendingUnlock(day: number, seen: readonly string[], unlockAll = false): Unlock | null {
  return UNLOCKS.find((u) => (u.day <= day || (unlockAll && u.liberable)) && !seen.includes(u.id)) ?? null;
}
