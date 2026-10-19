/** Estado dos controles, alimentado pelo teclado e pelos botões/zonas de toque. */
export class Input {
  private keys = new Set<string>();
  touchLeft = false;
  touchRight = false;
  touchPlunger = false;

  get left() {
    return this.touchLeft || this.keys.has('ArrowLeft') || this.keys.has('KeyZ') || this.keys.has('KeyA');
  }
  get right() {
    return this.touchRight || this.keys.has('ArrowRight') || this.keys.has('Slash') || this.keys.has('KeyD');
  }
  get plunger() {
    return this.touchPlunger || this.keys.has('Space') || this.keys.has('ArrowDown');
  }

  keyDown(code: string) {
    this.keys.add(code);
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }
  clear() {
    this.keys.clear();
    this.touchLeft = false;
    this.touchRight = false;
    this.touchPlunger = false;
  }
}
