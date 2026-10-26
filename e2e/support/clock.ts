/**
 * Relógio controlado, sorteio previsível e preparo do storage: o init script único que toda página de
 * teste recebe antes de carregar o jogo (spec RN-10, RN-11, RN-19).
 *
 * - `requestAnimationFrame` vira uma fila manual: nada anda sozinho, `__e2eFrames(n)` roda `n` quadros
 *   de exatamente 1/60 s e `__e2eJump(ms)` salta o relógio sem quadros (aba em segundo plano).
 * - `Math.random` é um mulberry32 com a semente do teste.
 * - `virtualTime`: `performance.now()` e `Date.now()` só andam com os quadros e os saltos; o 1º quadro de
 *   um laço novo chega com `dt` exato. Desligado no Pastel (mantém o comportamento que ele sempre teve).
 * - O storage é preparado uma vez por teste (recarregar a página preserva o que o jogo gravou).
 *
 * `setTimeout`/`setInterval` NÃO são virtualizados: o cliente do Vite e o React dependem deles.
 */

export interface ClockOptions {
  /** Semente do `Math.random` da página. */
  seed: number;
  /** `performance.now()`/`Date.now()` medidos em quadros. */
  virtualTime: boolean;
  /** Chaves gravadas no `localStorage` limpo (valores já serializados). */
  storage: Record<string, string>;
  /** Chaves gravadas como estão, depois de `storage` (texto inválido para testes de dado corrompido). */
  rawStorage?: Record<string, string>;
  /** `localStorage` lança ao ser acessado (modo privado). */
  blockStorage: boolean;
  /** Som e música desligados por padrão (chave → valor que o jogo entende como desligado). */
  soundOff: Record<string, string>;
}

/** Corpo do init script. Roda no navegador: precisa ser autocontido (é serializado pelo Playwright). */
export function installClock(o: ClockOptions): void {
  const w = window as unknown as Record<string, unknown>;
  w.__E2E__ = true;
  w.__PF_E2E__ = true;

  // Math.random determinístico (mulberry32).
  let a = o.seed >>> 0;
  Math.random = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  // Tempo virtual: o relógio da página só anda com os quadros e os saltos.
  let virt = 0;
  if (o.virtualTime) {
    // bases fixas: o relógio é o mesmo em toda carga (com a hora real, os últimos bits do dt e as
    // sementes derivadas de Date.now variavam entre execuções)
    const perfBase = 1000;
    const dateBase = Date.UTC(2026, 0, 1, 12);
    performance.now = () => perfBase + virt;
    Date.now = () => dateBase + virt;
  }

  const queue = new Map<number, FrameRequestCallback>();
  let nextId = 1;
  let ts = -1;
  let inFrame = false;
  window.requestAnimationFrame = (cb) => {
    // Pedido fora de um quadro = laço novo (o jogo marca `last` com o relógio). Sem tempo virtual, o relógio
    // parte de agora + meio quadro: o 1º quadro roda 1 passo e o acumulador do jogo fica no meio do passo (a
    // demora do teste até o 1º `frames()`, sob carga, deixava o acumulador na fronteira de um passo). Com
    // tempo virtual o carimbo é o próprio relógio virtual, e o 1º quadro chega com `dt` = 1/60 s exato.
    if (!inFrame && !o.virtualTime) ts = performance.now() + 1000 / 120;
    queue.set(nextId, cb);
    return nextId++;
  };
  window.cancelAnimationFrame = (id) => {
    queue.delete(id);
  };
  const frames = (n: number): void => {
    if (ts < 0) ts = performance.now();
    for (let i = 0; i < n; i++) {
      if (o.virtualTime) {
        virt += 1000 / 60;
        ts = performance.now();
      } else {
        ts += 1000 / 60;
      }
      const cbs = [...queue.values()];
      queue.clear();
      inFrame = true;
      try {
        for (const cb of cbs) cb(ts);
      } finally {
        inFrame = false;
      }
    }
  };
  // Salto do relógio sem quadros (aba em segundo plano): o próximo quadro chega com dt enorme.
  const jump = (ms: number): void => {
    if (o.virtualTime) {
      virt += ms;
      return;
    }
    if (ts < 0) ts = performance.now();
    ts += ms;
  };
  w.__e2eFrames = frames;
  w.__e2eJump = jump;
  w.__pfFrames = frames;
  w.__pfJump = jump;
  /** Pedidos de quadro na fila (laços vivos), só leitura. */
  w.__e2eRafPending = () => queue.size;

  if (o.blockStorage) {
    Object.defineProperty(window, 'localStorage', {
      get: () => {
        throw new Error('bloqueado');
      },
    });
  } else {
    // `about:blank` e páginas opacas não têm storage: o acesso lança e o relógio não pode derrubar a página
    try {
      if (!sessionStorage.getItem('__e2e_booted') && !sessionStorage.getItem('__pf_booted')) {
        sessionStorage.setItem('__e2e_booted', '1');
        sessionStorage.setItem('__pf_booted', '1');
        localStorage.clear();
        for (const [k, v] of Object.entries(o.soundOff)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(o.storage)) localStorage.setItem(k, v);
        for (const [k, v] of Object.entries(o.rawStorage ?? {})) localStorage.setItem(k, v);
      }
    } catch {
      // sem storage nesta página
    }
  }
}

/** Globais publicados pelo relógio (para `page.evaluate` tipado). */
export type ClockWindow = Window & {
  __e2eFrames: (n: number) => void;
  __e2eJump: (ms: number) => void;
  __e2eRafPending: () => number;
};
