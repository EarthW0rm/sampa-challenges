"""Pinball Paulista: fundo da mesa (240x400, 1x), bumpers-semáforo (24x24, 4 estados) e capa (320x200).

Uso:  python3 pinball_paulista.py <pasta de saída>   (grava mesa/*.png e capa.png)
Os PNGs são 1×: o jogo aplica o Scale2x em tempo de execução (game/hires.ts).
"""
import os
import random
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from biblioteca.prim import INK, Pen, new, outline  # noqa: E402

GLYPHS = {
    'A': '.#.|#.#|###|#.#|#.#', 'C': '###|#..|#..|#..|###', 'I': '###|.#.|.#.|.#.|###', 'L': '#..|#..|#..|#..|###',
    'M': '#.#|###|###|#.#|#.#', 'N': '##.|#.#|#.#|#.#|#.#', 'O': '###|#.#|#.#|#.#|###', 'P': '###|#.#|###|#..|#..',
    'S': '###|#..|###|..#|###', 'T': '###|.#.|.#.|.#.|.#.', 'U': '#.#|#.#|#.#|#.#|###', 'V': '#.#|#.#|#.#|#.#|.#.',
    'H': '#.#|#.#|###|#.#|#.#', 'B': '##.|#.#|##.|#.#|##.', 'Y': '#.#|#.#|.#.|.#.|.#.', 'E': '###|#..|##.|#..|###',
    'R': '##.|#.#|##.|#.#|#.#', 'D': '##.|#.#|#.#|#.#|##.', 'G': '###|#..|#.#|#.#|###', 'K': '#.#|#.#|##.|#.#|#.#',
    'F': '###|#..|##.|#..|#..', 'J': '..#|..#|..#|#.#|###', 'X': '#.#|#.#|.#.|#.#|#.#', 'Z': '###|..#|.#.|#..|###',
    'Q': '###|#.#|#.#|###|..#', 'W': '#.#|#.#|###|###|#.#',
    '.': '...|...|...|...|.#.', '-': '...|...|###|...|...', ' ': '...|...|...|...|...',
}


def text(p, s, x, y, c, k=1):
    for ch in s.upper():
        g = GLYPHS.get(ch, GLYPHS[' ']).split('|')
        for gy, row in enumerate(g):
            for gx, v in enumerate(row):
                if v == '#':
                    p.rect(x + gx * k, y + gy * k, x + gx * k + k - 1, y + gy * k + k - 1, c)
        x += 4 * k


def twidth(s, k=1):
    return (len(s) * 4 - 1) * k


def fundo():
    rnd = random.Random(7)
    im = Image.new('RGBA', (240, 400), (18, 13, 26, 255))
    p = Pen(im)
    # asfalto da mesa
    p.rect(8, 28, 232, 400, '#2a2438')
    # arco: céu noturno com skyline (a moldura do arco é desenhada pelo motor)
    for y in range(0, 130):
        t = y / 130
        c = (int(26 + 24 * t), int(18 + 22 * t), int(48 + 34 * t))
        p.rect(0, y, 239, y, '#%02x%02x%02x' % c)
    # prédios ao fundo
    x = 6
    while x < 234:
        w = rnd.choice([12, 16, 20, 14, 18])
        h = rnd.randint(28, 78)
        shade = rnd.choice(['#2e2a48', '#37315a', '#2a2540', '#3a3560'])
        top = 100 - h
        p.rect(x, top, x + w - 1, 109, shade)
        for wy in range(top + 3, 106, 5):
            for wx in range(x + 2, x + w - 2, 4):
                if rnd.random() < 0.55:
                    p.rect(wx, wy, wx + 1, wy + 2, rnd.choice(['#8a7650', '#6b5a45', '#a8905c']))
        if rnd.random() < 0.4:  # antena
            p.rect(x + w // 2, top - 5, x + w // 2, top - 1, '#4a4468')
        x += w + rnd.randint(0, 2)
    # MASP: viga vermelha sobre pilares (ícone da Paulista)
    p.rect(78, 82, 144, 94, '#c8323f')
    p.rect(78, 82, 144, 83, '#e85a66')
    p.rect(78, 94, 144, 95, '#8c2230')
    for wx in range(82, 142, 6):
        p.rect(wx, 85, wx + 3, 91, '#3a1e30')
    p.rect(82, 96, 85, 109, '#e8e2d4')
    p.rect(137, 96, 140, 109, '#e8e2d4')
    # calçada/avenida: a pista começa em y=110
    p.rect(8, 110, 232, 400, '#2a2438')
    p.rect(8, 110, 232, 111, '#4a4260')
    # faixas tracejadas
    for y in range(120, 330, 14):
        p.rect(60, y, 61, y + 6, '#3c3450')
        p.rect(161, y, 162, y + 6, '#3c3450')
    # corredores azuis (faixa de ônibus) nas laterais
    for (x0, x1) in ((9, 27), (195, 213)):
        for y in range(128, 195):
            p.rect(x0, y, x1, y, '#243b5c' if (y // 4) % 2 == 0 else '#2a4468')
    # texto pintado na pista
    s = 'AV PAULISTA'
    text(p, s, 111 - twidth(s, 2) // 2, 112, '#6d6486', 2)
    # Minhocão: laje de concreto com pilares
    p.rect(66, 224, 156, 242, '#4a4458')
    p.rect(66, 224, 156, 225, '#6a647a')
    p.rect(66, 241, 156, 242, '#2e2a3c')
    for wx in (72, 106, 140):
        p.rect(wx, 243, wx + 5, 256, '#3a3548')
    s = 'MINHOCAO'
    text(p, s, 111 - twidth(s) // 2, 216, '#a79fbd')
    # faixa de pedestres no fim da mesa
    for wx in range(34, 190, 10):
        p.rect(wx, 382, wx + 5, 396, '#36304a')
    # rampa de lançamento
    p.rect(215, 90, 231, 400, '#221b30')
    for y in range(110, 396, 12):
        p.rect(221, y, 224, y + 5, '#3c3450')
    return im


def bumper(estado):
    """24x24, visto de cima: tampa redonda + semáforo. estado: 0 vermelho, 1 amarelo, 2 verde, 3 brilho."""
    cores = [('#ff4d5e', '#a02a3c'), ('#ffd36b', '#b8892f'), ('#5fd17a', '#2f8a4a'), ('#ffffff', '#c9c0d8')]
    cap, sombra = cores[estado]
    im = new(24, 24)
    p = Pen(im)
    p.disc(12, 12, 11, INK)
    p.disc(12, 12, 10, '#f4efe2')
    p.disc(12, 12, 8, sombra)
    p.disc(12, 11, 8, cap)
    p.ell(7, 5, 12, 8, '#ffffff') if estado != 3 else None
    # semáforo no meio
    p.rect(9, 6, 14, 18, INK)
    for i, c in enumerate(('#ff4d5e', '#ffd36b', '#5fd17a')):
        on = (i == estado) or estado == 3
        p.rect(10, 7 + i * 4, 13, 9 + i * 4, c if on else '#4a4460')
    return im


def capa():
    im = Image.new('RGBA', (320, 200), (22, 18, 31, 255))
    p = Pen(im)
    rnd = random.Random(3)
    for y in range(200):
        t = y / 200
        p.rect(0, y, 319, y, '#%02x%02x%02x' % (int(24 + 34 * t), int(16 + 20 * t), int(54 + 28 * t)))
    for i in range(40):
        p.rect(rnd.randint(0, 319), rnd.randint(0, 90), rnd.randint(0, 319) % 1 + 0, 0, '#000000')
    for _ in range(50):
        sx, sy = rnd.randint(0, 319), rnd.randint(0, 80)
        p.rect(sx, sy, sx, sy, '#f4efe2')
    x = 0
    while x < 320:
        w = rnd.choice([18, 24, 30, 20])
        h = rnd.randint(50, 120)
        sh = rnd.choice(['#2e2a48', '#37315a', '#2a2540'])
        p.rect(x, 150 - h, x + w - 1, 160, sh)
        for wy in range(150 - h + 4, 156, 7):
            for wx in range(x + 3, x + w - 3, 6):
                if rnd.random() < 0.5:
                    p.rect(wx, wy, wx + 2, wy + 3, rnd.choice(['#8a7650', '#a8905c']))
        x += w + 2
    p.rect(0, 160, 319, 199, '#2a2438')
    for x in range(0, 320, 40):
        p.rect(x, 180, x + 20, 182, '#4a4260')
    # título (à direita; o cachorro fica à esquerda)
    cx = 238
    s = 'PINBALL'
    text(p, s, cx - twidth(s, 5) // 2 + 3, 20 + 3, INK, 5)
    text(p, s, cx - twidth(s, 5) // 2, 20, '#ffd36b', 5)
    s = 'PAULISTA'
    text(p, s, cx - twidth(s, 4) // 2 + 2, 54 + 2, INK, 4)
    text(p, s, cx - twidth(s, 4) // 2, 54, '#ff4d5e', 4)
    # bola de pinball com brilho e cachorro motoboy (biblioteca)
    p.disc(250, 132, 22, INK)
    p.disc(250, 132, 20, '#c9c0d8')
    p.disc(248, 130, 17, '#e9e4f2')
    p.disc(242, 123, 5, '#ffffff')
    lib = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'shared', 'sprites', 'assets', 'caes', 'p1_grau_0.png')
    if os.path.exists(lib):
        dog = Image.open(lib).convert('RGBA')
        dog = dog.resize((dog.width * 2, dog.height * 2), Image.NEAREST)  # 80x80 (2x) -> 160x160 = 80 logicos x2
        im.alpha_composite(dog, (6, 38))
    return im


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(os.path.join(out, 'mesa'), exist_ok=True)
    fundo().save(os.path.join(out, 'mesa', 'fundo.png'))
    for i in range(4):
        bumper(i).save(os.path.join(out, 'mesa', f'bumper_{i}.png'))
    capa().save(os.path.join(out, 'capa.png'))
    print('ok')
