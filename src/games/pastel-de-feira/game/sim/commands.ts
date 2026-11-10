import type { Command } from '../types';
import { acceptOffer } from './delivery';
import { cancelCleaning, startCleaning } from './dirt';
import { isAt, tapStation } from './pasteleiro';
import { sendToRest } from './staff';
import { addIngredient, clearTray, closeAssembly, selectAssembled } from './stations/bench';
import { startMill, stopMill } from './stations/cane';
import { chargeNextGroup, collectCoins, takeOrder, takeTableOrder } from './stations/counter';
import { cancelOilChange, startOilChange, tapBasket } from './stations/fryer';
import type { DayState } from './state';
import { fill, freeItem } from './tickets';

/** Aplica um comando do jogador. Devolve false se ele não vale no estado atual (vira `rejected`). */
export function applyCommand(s: DayState, cmd: Command): boolean {
  switch (cmd.type) {
    case 'tapStation':
      return tapStation(s, cmd.station);
    case 'tapSlot': {
      const slot = cmd.slot;
      if (cmd.station === 'balcao') {
        if (slot.k === 'anotar') return takeOrder(s);
        if (slot.k === 'moedas') return collectCoins(s);
        if (slot.k === 'pagar') return chargeNextGroup(s);
        return false;
      }
      if (cmd.station === 'mesas') {
        if (slot.k === 'anotar') return takeTableOrder(s);
        return false;
      }
      if (cmd.station === 'bancada') {
        if (slot.k === 'ingrediente') return addIngredient(s, slot.id);
        if (slot.k === 'fechar') return closeAssembly(s);
        if (slot.k === 'limpar') return clearTray(s);
        if (slot.k === 'montado') return selectAssembled(s, slot.id);
      }
      if (cmd.station.startsWith('tacho') && slot.k === 'cesto') return tapBasket(s, cmd.station, slot.index);
      return false;
    }
    case 'holdStart':
      if (cmd.action === 'oleo' && cmd.station.startsWith('tacho')) return startOilChange(s, cmd.station);
      if (cmd.action === 'moenda' && cmd.station === 'moenda') return startMill(s, cmd.item);
      if (cmd.action === 'limpar') return startCleaning(s, cmd.station);
      return false;
    case 'holdEnd':
      if (s.pasteleiro.hold === null) return false;
      cancelOilChange(s);
      stopMill(s);
      cancelCleaning(s);
      s.pasteleiro.hold = null;
      return true;
    case 'acceptOffer':
      return acceptOffer(s, cmd.offerId);
    case 'sendRest':
      return sendToRest(s, cmd.staffId);
    case 'fill': {
      // pôr na comanda: só quem está na estação do trilho (RN-183)
      const t = s.tickets.find((x) => x.id === cmd.ticketId);
      if (!t) return false;
      const here = t.track === 'expedicao' ? isAt(s, 'expedicao') : isAt(s, 'balcao') || (t.kind === 'mesa' && isAt(s, 'mesas'));
      if (!here || !freeItem(s, cmd.item)) return false;
      fill(s, t, cmd.item);
      return true; // recusa por sabor vale como gesto feito, sem custo (RN-182)
    }
    default:
      return false;
  }
}
