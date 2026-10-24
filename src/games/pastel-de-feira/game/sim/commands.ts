import type { Command } from '../types';
import { cancelCleaning, startCleaning } from './dirt';
import { tapStation } from './pasteleiro';
import { sendToRest } from './staff';
import { addIngredient, clearTray, closeAssembly, selectAssembled } from './stations/bench';
import { startMill, stopMill } from './stations/cane';
import { chargeNextGroup, collectCoins, deliver, takeOrder, takeTableOrder } from './stations/counter';
import { cancelOilChange, startOilChange, tapBasket } from './stations/fryer';
import { warm } from './stations/warmer';
import type { DayState } from './state';

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
      if (cmd.station === 'estufa' && slot.k === 'pronto') return warm(s, slot.id);
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
    case 'sendRest':
      return sendToRest(s, cmd.staffId);
    case 'deliver':
      return deliver(s, cmd.item, cmd.customerId);
    default:
      return false;
  }
}
