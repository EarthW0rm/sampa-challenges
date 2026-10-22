import type { Dir } from './types';

/** Controles: direção desejada (estilo Pac-Man: fica valendo até a próxima esquina), turbo e óleo. */
export class Input {
  /** Última direção pedida (null = nenhuma). */
  want: Dir | null = null;
  private keys = new Set<string>();
  touchTurbo = false;
  private oil = false;

  get turbo() {
    return this.touchTurbo || this.keys.has('Space') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  /** Devolve true uma vez por toque na tecla/botão de óleo. */
  takeOil(): boolean {
    const v = this.oil;
    this.oil = false;
    return v;
  }
  pressOil() {
    this.oil = true;
  }

  keyDown(code: string) {
    switch (code) {
      case 'ArrowRight':
      case 'KeyD':
        this.want = 0;
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.want = 1;
        break;
      case 'ArrowLeft':
      case 'KeyA':
        this.want = 2;
        break;
      case 'ArrowUp':
      case 'KeyW':
        this.want = 3;
        break;
      case 'KeyX':
      case 'KeyZ':
      case 'KeyE':
        this.oil = true;
        break;
      default:
        this.keys.add(code);
    }
  }
  keyUp(code: string) {
    this.keys.delete(code);
  }
  clear() {
    this.keys.clear();
    this.want = null;
    this.touchTurbo = false;
    this.oil = false;
  }
}
