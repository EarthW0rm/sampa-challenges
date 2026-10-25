/** Fonte 3×5 para os textos do canvas. Sem acentos: use `plain()` antes de desenhar texto com acento. */
const G: Record<string, string> = {
  '0': '###|#.#|#.#|#.#|###', '1': '.#.|##.|.#.|.#.|###', '2': '###|..#|###|#..|###', '3': '###|..#|.##|..#|###',
  '4': '#.#|#.#|###|..#|..#', '5': '###|#..|###|..#|###', '6': '###|#..|###|#.#|###', '7': '###|..#|..#|.#.|.#.',
  '8': '###|#.#|###|#.#|###', '9': '###|#.#|###|..#|###', '+': '...|.#.|###|.#.|...', '-': '...|...|###|...|...',
  '!': '.#.|.#.|.#.|...|.#.', '.': '...|...|...|...|.#.', ' ': '...|...|...|...|...', ',': '...|...|...|.#.|#..',
  ':': '...|.#.|...|.#.|...', '/': '..#|..#|.#.|#..|#..', '%': '#.#|..#|.#.|#..|#.#', '$': '.##|##.|.#.|.##|##.',
  '?': '###|..#|.##|...|.#.', 'X': '#.#|#.#|.#.|#.#|#.#', '(': '.#.|#..|#..|#..|.#.', ')': '.#.|..#|..#|..#|.#.',
  A: '.#.|#.#|###|#.#|#.#', B: '##.|#.#|##.|#.#|##.', C: '###|#..|#..|#..|###', D: '##.|#.#|#.#|#.#|##.',
  E: '###|#..|##.|#..|###', F: '###|#..|##.|#..|#..', G: '###|#..|#.#|#.#|###', H: '#.#|#.#|###|#.#|#.#',
  I: '###|.#.|.#.|.#.|###', J: '..#|..#|..#|#.#|###', K: '#.#|#.#|##.|#.#|#.#', L: '#..|#..|#..|#..|###',
  M: '#.#|###|###|#.#|#.#', N: '##.|#.#|#.#|#.#|#.#', O: '###|#.#|#.#|#.#|###', P: '###|#.#|###|#..|#..',
  Q: '###|#.#|#.#|###|..#', R: '##.|#.#|##.|#.#|#.#', S: '###|#..|###|..#|###', T: '###|.#.|.#.|.#.|.#.',
  U: '#.#|#.#|#.#|#.#|###', V: '#.#|#.#|#.#|#.#|.#.', W: '#.#|#.#|###|###|#.#',
  Y: '#.#|#.#|.#.|.#.|.#.', Z: '###|..#|.#.|#..|###',
};

const rows = (ch: string): string[] => (G[ch] ?? G[' ']).split('|');

/** Tira os acentos (a fonte é só ASCII). */
export const plain = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '');

export function textWidth(text: string, k = 1): number {
  return (text.length * 4 - 1) * k;
}

/** Texto com sombra de 1 pixel (`shadow`) em coordenadas lógicas. `k` amplia cada pixel da fonte. */
export function drawPixelText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  k = 1,
  shadow: string | null = '#1b1220',
) {
  const pass = (ox: number, oy: number, c: string) => {
    ctx.fillStyle = c;
    let cx = Math.round(x) + ox;
    for (const ch of plain(text).toUpperCase()) {
      const g = rows(ch);
      for (let gy = 0; gy < 5; gy++)
        for (let gx = 0; gx < 3; gx++) if (g[gy][gx] === '#') ctx.fillRect(cx + gx * k, Math.round(y) + oy + gy * k, k, k);
      cx += 4 * k;
    }
  };
  if (shadow) pass(k, k, shadow);
  pass(0, 0, color);
}
