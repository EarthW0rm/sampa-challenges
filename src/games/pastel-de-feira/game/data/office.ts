/** Escritório, cargos de gestão e encomendas (RN-100–104). Valores (P). */

export type OfficeRole = 'contador' | 'comprador' | 'gerente' | 'despachante';

export interface RoleDef {
  id: OfficeRole;
  name: string;
  desc: string;
  salary: number;
}

// RN-103
export const ROLES: Readonly<Record<OfficeRole, RoleDef>> = Object.freeze({
  contador: { id: 'contador', name: 'Contador', desc: 'Libera os relatórios e mostra custo e margem por item no Preparo.', salary: 90 },
  comprador: { id: 'comprador', name: 'Comprador', desc: 'Compra sugerida em qualquer dia e insumos 8% mais baratos.', salary: 80 },
  gerente: { id: 'gerente', name: 'Gerente', desc: 'Funcionários +10% de velocidade (acumula com o escritório) e reivindicações 50% menos frequentes.', salary: 110 },
  despachante: { id: 'despachante', name: 'Despachante', desc: 'Anula 1 multa de fiscalização a cada 5 dias e amplia as ofertas de encomenda e desafio.', salary: 100 },
});
export const ROLE_IDS = Object.keys(ROLES) as OfficeRole[];

export const OFFICE = { price: 1500, space: 4, minDay: 10, roleSlots: 3 } as const;

/** Bônus de velocidade da equipe (RN-101, RN-103). */
export const MANAGEMENT_SPEED = 1.15;
export const MANAGER_SPEED = 1.1;
/** Insumos mais baratos com o Comprador (RN-103). */
export const BUYER_DISCOUNT = 0.92;

// RN-102, RN-104
export const ORDERS = {
  minQty: 10,
  maxQty: 40,
  firstHour: 9,
  lastHour: 13.5,
  payFactor: 1.3,
  fineFactor: 0.5,
  maxOffers: 2,
  maxOffersWithDispatcher: 3,
  waitSeconds: 30,
} as const;
