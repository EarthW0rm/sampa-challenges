/** Estado dos controles, alimentado pelo teclado e pelos botões de toque. */
export class Input {
  private keys = new Set<string>();
  touchLeft = false;
  touchRight = false;

  get left() {
    return this.touchLeft || this.keys.has('ArrowLeft') || this.keys.has('KeyA');
  }
  get right() {
    return this.touchRight || this.keys.has('ArrowRight') || this.keys.has('KeyD');
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
  }
}
