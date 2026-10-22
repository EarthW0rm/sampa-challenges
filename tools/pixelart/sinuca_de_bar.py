"""Sinuca de Bar: fundo com a mesa vista de cima num boteco (320x200), bolas 0-15 e anel de mira
em HD nativo (16x16, 2x) e capa (320x200).

Uso:  python3 sinuca_de_bar.py <pasta de saída>   (grava cenario/mesa.png, bolas/*.png e capa.png)
O fundo e a capa são 1× (o jogo aplica o Scale2x em tempo de execução, game/hires.ts). As bolas
são desenhadas direto em 2× (como a biblioteca src/shared/sprites): com 8 pixels lógicos de
diâmetro, o número só fica legível em pixels de tela. O jogo as desenha sem Scale2x.

As posições da mesa precisam bater com `game/constants.ts`
(FELT_L, FELT_R, FELT_T, FELT_B, HEAD_X, FOOT_X, CY, JAW_*, POCKETS e caixas do placar).
"""
import math
import os
import random
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from biblioteca.prim import INK, Pen, new  # noqa: E402

# ---------------------------------------------------------------- layout (igual a game/constants.ts)
FELT_L, FELT_R, FELT_T, FELT_B = 16, 304, 40, 184
MID_X = (FELT_L + FELT_R) // 2
JAW_CORNER, JAW_MID, JAW_FACING = 11, 9, 5
CY = (FELT_T + FELT_B) // 2
HEAD_X = FELT_L + 72
FOOT_X = FELT_L + 216
BOX_L = (4, 2, 121, 25)
BOX_R = (198, 2, 315, 25)

# cores das bolas 1-8 (9-15 repetem 1-7 com faixa)
CORES_BOLA = {
    1: ('#f2c230', '#ffe27a', '#b98a14'),
    2: ('#2f56c8', '#6a8ef0', '#1d3584'),
    3: ('#d8343a', '#ff7a6e', '#8f1d24'),
    4: ('#6b3aa8', '#9b6ad8', '#43216e'),
    5: ('#f07a1e', '#ffb064', '#a84e0c'),
    6: ('#23935a', '#5fd17a', '#146038'),
    7: ('#8a2a2a', '#c05a4a', '#561616'),
    8: ('#2a2232', '#5a4e68', '#120e18'),
}
BRANCO = ('#f4efe2', '#ffffff', '#c9c0b0')

DIG = {
    '0': '###|#.#|#.#|#.#|###', '1': '.#.|##.|.#.|.#.|###', '2': '###|..#|###|#..|###', '3': '###|..#|.##|..#|###',
    '4': '#.#|#.#|###|..#|..#', '5': '###|#..|###|..#|###', '6': '###|#..|###|#.#|###', '7': '###|..#|..#|.#.|.#.',
    '8': '###|#.#|###|#.#|###', '9': '###|#.#|###|..#|###',
}


def _num(p, s, cx, cy):
    """Número 3x5 centrado em (cx, cy), 1 pixel por ponto; dois dígitos ficam colados (7 px)."""
    w = len(s) * 4 - 1 if len(s) == 1 else 7
    x = cx - w // 2
    for i, ch in enumerate(s):
        for gy, row in enumerate(DIG[ch].split('|')):
            for gx, v in enumerate(row):
                if v == '#':
                    p.put(x + gx, cy - 2 + gy, INK)
        x += 4 if len(s) == 1 else 4


def bola(n, d=16):
    """Bola de diâmetro `d` pixels: contorno, luz em cima à esquerda, sombra embaixo à direita,
    faixa (9-15) e círculo branco com o número (1-15)."""
    im = new(d, d)
    p = Pen(im)
    r = d / 2
    c = (r, r)
    base = CORES_BOLA.get(n if n <= 8 else n - 8) if n else None
    listrada = n >= 9
    disco = d * 0.30
    for y in range(d):
        for x in range(d):
            dx, dy = x + 0.5 - c[0], y + 0.5 - c[1]
            dist = math.hypot(dx, dy)
            if dist > r:
                continue
            if dist > r - 1.05:
                p.put(x, y, INK)
                continue
            luz = (-dx * 0.62 - dy * 0.78) / r
            if n == 0:
                cores = BRANCO
            elif listrada and abs(dy) > r * 0.42:
                cores = BRANCO
            else:
                cores = base
            if n and math.hypot(dx + r * 0.06, dy + r * 0.06) < disco:
                cores = BRANCO
            if luz > 0.5:
                cor = cores[1]
            elif luz < -0.42:
                cor = cores[2]
            else:
                cor = cores[0]
            p.put(x, y, cor)
    # brilho
    bx, by = int(r - r * 0.5), int(r - r * 0.55)
    p.put(bx, by, '#ffffff')
    if d >= 16:
        p.put(bx + 1, by, '#ffffff')
        p.put(bx, by + 1, '#ffffff')
    if n:
        _num(p, str(n), int(r - r * 0.06), int(r - r * 0.06))
    return im


def sombra(d=16):
    im = new(d, d)
    p = Pen(im)
    r = d / 2
    for y in range(d):
        for x in range(d):
            if math.hypot(x + 0.5 - r, y + 0.5 - r) <= r - 0.5:
                p.put(x, y, (8, 30, 16, 110))
    return im


def anel(d=16):
    """Bola-fantasma da mira: só o contorno claro."""
    im = new(d, d)
    p = Pen(im)
    r = d / 2
    for y in range(d):
        for x in range(d):
            dist = math.hypot(x + 0.5 - r, y + 0.5 - r)
            if r - 1.3 < dist <= r:
                p.put(x, y, (244, 239, 226, 220))
    return im


# ---------------------------------------------------------------- cenário

def _tijolos(p, x0, y0, x1, y1, rnd):
    p.rect(x0, y0, x1, y1, '#24151d')
    for row, y in enumerate(range(y0, y1 + 1, 5)):
        off = (row % 2) * 6
        for x in range(x0 - off, x1 + 1, 12):
            c = rnd.choice(('#3d2129', '#432430', '#38202a', '#4a2833'))
            p.rect(max(x0, x), y, min(x1, x + 10), min(y1, y + 3), c)


def _caixa(p, x0, y0, x1, y1):
    """Painel escuro com borda chanfrada (igual aos outros jogos)."""
    p.rect(x0, y0, x1, y1, '#3a3150')
    p.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, '#16121f')
    p.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, '#2e2540')


NEON = {
    'B': '##.|#.#|##.|#.#|##.', 'A': '.#.|#.#|###|#.#|#.#', 'R': '##.|#.#|##.|#.#|#.#',
    'S': '###|#..|###|..#|###', 'I': '###|.#.|.#.|.#.|###', 'N': '##.|#.#|#.#|#.#|#.#',
    'U': '#.#|#.#|#.#|#.#|###', 'C': '###|#..|#..|#..|###', 'D': '##.|#.#|#.#|#.#|##.',
    'E': '###|#..|##.|#..|###', 'O': '###|#.#|#.#|#.#|###', 'Z': '###|..#|.#.|#..|###',
    ' ': '...|...|...|...|...',
}


def _texto(p, s, x, y, c, k):
    for ch in s:
        for gy, row in enumerate(NEON[ch].split('|')):
            for gx, v in enumerate(row):
                if v == '#':
                    p.rect(x + gx * k, y + gy * k, x + gx * k + k - 1, y + gy * k + k - 1, c)
        x += 4 * k


def _largura(s, k):
    return (len(s) * 4 - 1) * k


def _neon(p, s, cx, y, k, cor, brilho):
    x = cx - _largura(s, k) // 2
    for ox, oy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        _texto(p, s, x + ox, y + oy, brilho, k)
    _texto(p, s, x, y, cor, k)


def _mesa(p, rnd):
    # madeira
    x0, y0, x1, y1 = FELT_L - 12, FELT_T - 12, FELT_R + 11, FELT_B + 11
    p.rrect(x0 - 1, y0 - 1, x1 + 1, y1 + 1, 5, INK)
    p.rrect(x0, y0, x1, y1, 4, '#6b3a1e')
    for _ in range(140):
        gx, gy = rnd.randint(x0 + 2, x1 - 6), rnd.randint(y0 + 1, y1 - 1)
        p.rect(gx, gy, gx + rnd.randint(2, 6), gy, '#5c3119')
    p.rect(x0 + 3, y0, x1 - 3, y0, '#8a5230')
    p.rect(x0, y0 + 3, x0, y1 - 3, '#8a5230')
    p.rect(x0 + 3, y1, x1 - 3, y1, '#4a2614')
    p.rect(x1, y0 + 3, x1, y1 - 3, '#4a2614')
    # marcadores (diamantes) de madrepérola
    for k in (1, 2, 3, 5, 6, 7):
        x = FELT_L + k * 36
        p.rect(x - 1, y0 + 3, x, y0 + 4, '#e8e0c8')
        p.rect(x - 1, y1 - 4, x, y1 - 3, '#e8e0c8')
    for k in (1, 2, 3):
        y = FELT_T + k * 36
        p.rect(x0 + 3, y - 1, x0 + 4, y, '#e8e0c8')
        p.rect(x1 - 4, y - 1, x1 - 3, y, '#e8e0c8')
    # tabelas (borracha) e pano
    p.rect(FELT_L - 4, FELT_T - 4, FELT_R + 3, FELT_B + 3, '#1c5e33')
    p.rect(FELT_L - 4, FELT_T - 4, FELT_R + 3, FELT_T - 4, '#14482a')
    p.rect(FELT_L - 4, FELT_T - 1, FELT_R + 3, FELT_T - 1, '#2a7a45')
    p.rect(FELT_L - 4, FELT_B, FELT_R + 3, FELT_B, '#14482a')
    p.rect(FELT_L - 1, FELT_T, FELT_L - 1, FELT_B - 1, '#2a7a45')
    p.rect(FELT_R, FELT_T, FELT_R, FELT_B - 1, '#14482a')
    p.rect(FELT_L, FELT_T, FELT_R - 1, FELT_B - 1, '#2e8a4a')
    for _ in range(900):
        fx, fy = rnd.randint(FELT_L, FELT_R - 1), rnd.randint(FELT_T, FELT_B - 1)
        p.put(fx, fy, rnd.choice(('#2a8045', '#329250', '#2b8547')))
    # luz da luminária no centro do pano
    for y in range(FELT_T, FELT_B):
        for x in range(FELT_L, FELT_R):
            ex, ey = (x - MID_X) / 120, (y - CY) / 60
            if ex * ex + ey * ey < 1 and (x + y) % 2 == 0 and rnd.random() < 0.18:
                p.put(x, y, '#36975a')
    # linha de cabeceira e marcas
    for y in range(FELT_T + 1, FELT_B - 1, 2):
        p.put(HEAD_X, y, '#3f9e5e')
    for sx in (HEAD_X, FOOT_X):
        p.put(sx, CY, '#cfe8d6')
    # caçapas: boca aberta na tabela (quina cortada em 45° nos cantos) e buraco
    fundo_c, borda = '#0c0a10', '#2a1a10'
    J, M, F = JAW_CORNER, JAW_MID, JAW_FACING
    for cx, cy, sx, sy in ((FELT_L, FELT_T, 1, 1), (FELT_R - 1, FELT_T, -1, 1), (FELT_L, FELT_B - 1, 1, -1), (FELT_R - 1, FELT_B - 1, -1, -1)):
        px, py = cx - sx * 1, cy - sy * 1
        # (ox, oy) = quina da tabela, logo fora do pano: o recorte não invade a área de jogo
        ox, oy = cx - sx, cy - sy
        p.poly([(cx + sx * J, oy), (cx + sx * (J - F), cy - sy * F), (px - sx * 6, py - sy * 6),
                (cx - sx * F, cy + sy * (J - F)), (ox, cy + sy * J), (ox, oy)], borda)
        p.disc(px, py, 9, borda)
        p.poly([(cx + sx * (J - 1), oy), (cx + sx * (J - F), cy - sy * (F - 1)), (px, py),
                (cx - sx * (F - 1), cy + sy * (J - F)), (ox, cy + sy * (J - 1)), (ox, oy)], fundo_c)
        p.disc(px, py, 8, fundo_c)
    for cy, sy in ((FELT_T - 4, -1), (FELT_B + 3, 1)):
        y_edge = FELT_T - 1 if sy < 0 else FELT_B
        p.poly([(MID_X - M, y_edge), (MID_X + M - 1, y_edge), (MID_X + M - 2, y_edge + sy * F), (MID_X - M + 1, y_edge + sy * F)], borda)
        p.ell(MID_X - 9, cy - 7, MID_X + 8, cy + 7, borda)
        p.poly([(MID_X - M + 1, y_edge), (MID_X + M - 2, y_edge), (MID_X + M - 3, y_edge + sy * F), (MID_X - M + 2, y_edge + sy * F)], fundo_c)
        p.ell(MID_X - 8, cy - 6, MID_X + 7, cy + 6, fundo_c)

def fundo():
    rnd = random.Random(8)
    im = Image.new('RGBA', (320, 200), (22, 18, 31, 255))
    p = Pen(im)
    _tijolos(p, 0, 0, 319, 199, rnd)
    _caixa(p, *BOX_L)
    _caixa(p, *BOX_R)
    _neon(p, 'BAR', 160, 4, 2, '#ff8ad8', '#7a2a6a')
    _neon(p, 'SINUCA', 160, 17, 1, '#7fe0ff', '#24506a')
    _mesa(p, rnd)
    p.rect(0, 196, 319, 199, '#1a1016')
    return im


def capa():
    rnd = random.Random(3)
    im = Image.new('RGBA', (320, 200), (22, 18, 31, 255))
    p = Pen(im)
    _tijolos(p, 0, 0, 319, 199, rnd)
    # mesa em close: pano com a quina e uma caçapa
    p.rect(0, 92, 319, 199, '#6b3a1e')
    p.rect(0, 92, 319, 92, '#8a5230')
    for _ in range(80):
        gx, gy = rnd.randint(0, 314), rnd.randint(94, 104)
        p.rect(gx, gy, gx + rnd.randint(2, 6), gy, '#5c3119')
    p.rect(0, 105, 319, 109, '#1c5e33')
    p.rect(0, 109, 319, 109, '#2a7a45')
    p.rect(0, 110, 319, 199, '#2e8a4a')
    for _ in range(1400):
        p.put(rnd.randint(0, 319), rnd.randint(110, 199), rnd.choice(('#2a8045', '#329250')))
    p.ell(146, 96, 174, 116, '#2a1a10')
    p.ell(148, 98, 172, 114, '#0c0a10')
    # luminária
    p.rect(156, 0, 157, 6, '#120e18')
    p.poly([(132, 22), (182, 22), (170, 8), (144, 8)], '#2e6b3a')
    p.rect(132, 22, 182, 23, '#ffe8a0')
    # triângulo de bolas grandes e a branca
    bolas = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5]
    pos = []
    d = 22
    for row in range(4):
        for i in range(row + 1):
            pos.append((208 + row * 19, 152 + (i - row / 2) * d))
    for n, (x, y) in zip(bolas, pos):
        b = bola(n, d)
        im.alpha_composite(b, (int(x - d / 2), int(y - d / 2)))
    b = bola(0, d)
    im.alpha_composite(b, (60, 150))
    # taco
    for t in range(0, 110):
        x, y = 54 - t * 0.94, 162 + t * 0.34
        cor = '#4a7ad0' if t < 2 else '#e8e0c8' if t < 4 else '#d9b878' if t < 70 else '#5a2a14'
        w = 2 if t < 60 else 3
        p.rect(int(x), int(y), int(x) + w - 1, int(y) + w - 1, cor)
    for s, y, k, c, b in (('SINUCA', 26, 6, '#ffd36b', None), ('DE BAR', 64, 3, '#ff8ad8', '#7a2a6a')):
        x = 160 - _largura(s, k) // 2
        if b:
            _neon(p, s, 160, y, k, c, b)
        else:
            _texto(p, s, x + 2, y + 2, INK, k)
            _texto(p, s, x, y, c, k)
    # cachorro caramelo (biblioteca) de olho na partida
    lib = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'shared', 'sprites', 'assets', 'caes', 'p1_normal_0.png')
    if os.path.exists(lib):
        dog = Image.open(lib).convert('RGBA')
        im.alpha_composite(dog, (236, 14))
    return im


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(os.path.join(out, 'cenario'), exist_ok=True)
    os.makedirs(os.path.join(out, 'bolas'), exist_ok=True)
    fundo().save(os.path.join(out, 'cenario', 'mesa.png'))
    for n in range(16):
        bola(n).save(os.path.join(out, 'bolas', f'b{n}.png'))
    sombra().save(os.path.join(out, 'bolas', 'sombra.png'))
    anel().save(os.path.join(out, 'bolas', 'mira.png'))
    capa().save(os.path.join(out, 'capa.png'))
    print('ok')
