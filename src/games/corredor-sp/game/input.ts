/** Controles: setas ou WASD, Espaço (grau), X/Enter (capacete) e botões de toque. */
export class Input {
  private keys = new Set<string>();
  touch = { left: false, right: false, brake: false, grau: false };
  /** No celular a moto acelera sozinha. */
  autoAccel = false;
  private throwQueued = false;

  get left() {
    return this.touch.left || this.keys.has('ArrowLeft') || this.keys.has('KeyA');
  }
  get right() {
    return this.touch.right || this.keys.has('ArrowRight') || this.keys.has('KeyD');
  }
  get up() {
    return this.autoAccel || this.keys.has('ArrowUp') || this.keys.has('KeyW');
  }
  get down() {
    return this.touch.brake || this.keys.has('ArrowDown') || this.keys.has('KeyS');
  }
  get grau() {
    return this.touch.grau || this.keys.has('Space');
  }

  keyDown(code: string) {
    if ((code === 'KeyX' || code === 'Enter' || code === 'NumpadEnter') && !this.keys.has(code)) this.throwQueued = true;
    this.keys.add(code);
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }
  queueThrow() {
    this.throwQueued = true;
  }
  /** Lê e consome o pedido de arremesso. */
  takeThrow() {
    const t = this.throwQueued;
    this.throwQueued = false;
    return t;
  }
  clear() {
    this.keys.clear();
    this.touch = { left: false, right: false, brake: false, grau: false };
    this.throwQueued = false;
  }
}
