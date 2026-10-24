"""Fuga da Rocam: sprites vistos de cima (1x, voltados para a direita; os outros lados saem girando),
itens, pinos de entrega e capa.

Uso:  python3 fuga_rocam.py <pasta de saída>   (grava sprites/*.png e capa.png)
O jogo aplica o Scale2x em tempo de execução (game/hires.ts).
"""
import math
import os
import random
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from biblioteca.prim import INK, Pen, new, outline  # noqa: E402

RED, BLUE, YEL = '#ff4d5e', '#4da3ff', '#ffd36b'


def rot4(im, name, out, frame):
    """Salva as 4 direções: r (original), d (horário), l, u."""
    out(im, name + '_r_' + str(frame))
    out(im.transpose(Image.ROTATE_270), name + '_d_' + str(frame))
    out(im.transpose(Image.ROTATE_180), name + '_l_' + str(frame))
    out(im.transpose(Image.ROTATE_90), name + '_u_' + str(frame))


def moto_cachorro(frame):
    im = new(22, 13)
    p = Pen(im)
    # roda traseira e mochila de entrega
    p.rect(1, 4, 4, 8, '#2a2438')
    p.rect(2, 5, 3, 7, '#4a4460' if frame == 0 else '#3a3450')
    p.rect(3, 2, 9, 10, '#c8323f')
    p.rect(3, 2, 9, 3, '#e85a66')
    p.rect(5, 2, 6, 10, YEL)
    # quadro e escapamento
    p.rect(8, 5, 17, 7, '#4a4460')
    p.rect(8, 5, 17, 5, '#8d83a6')
    p.rect(10, 9, 12, 10, '#c9c0d8')
    # braços e guidão
    p.rect(13, 3, 17, 4, '#a8683a')
    p.rect(13, 8, 17, 9, '#a8683a')
    p.rect(17, 2, 18, 10, '#8d83a6')
    # corpo do cachorro (caramelo) inclinado sobre a moto
    p.rect(8, 4, 13, 8, '#d9a066')
    p.rect(8, 4, 13, 5, '#e8b07a')
    # capacete vermelho e orelhas
    p.rect(12, 3, 11 + 5, 9, RED)
    p.rect(13, 4, 15, 5, '#ff9aa4')
    p.rect(11, 2, 12, 3, '#a8683a')
    p.rect(11, 9, 12, 10, '#a8683a')
    # focinho e roda da frente
    p.rect(17, 5, 18, 7, '#d9a066')
    p.rect(18, 5, 18, 6, INK)
    p.rect(18, 3, 21, 9, '#2a2438')
    p.rect(19, 4, 20, 8, '#4a4460' if frame == 0 else '#3a3450')
    # farol
    p.put(21, 4, YEL)
    p.put(21, 8, YEL)
    return outline(im)


def carro_rocam(frame):
    im = new(26, 14)
    p = Pen(im)
    navy, navy2 = '#1f2a5a', '#2f3f86'
    p.rrect(1, 1, 24, 12, 2, navy)
    p.rect(2, 2, 23, 3, navy2)
    # portas brancas
    p.rect(9, 1, 17, 2, '#f4efe2')
    p.rect(9, 11, 17, 12, '#f4efe2')
    # teto branco e vidros
    p.rect(9, 3, 16, 10, '#f4efe2')
    p.rect(17, 3, 19, 10, '#12151f')
    p.rect(5, 3, 8, 10, '#12151f')
    # barra de luz
    p.rect(11, 4, 14, 9, '#2a2438')
    p.rect(11, 4, 14, 6, RED if frame == 0 else '#7a2030')
    p.rect(11, 7, 14, 9, '#1a3a70' if frame == 0 else BLUE)
    # faróis e lanternas
    p.put(24, 2, YEL)
    p.put(24, 11, YEL)
    p.put(24, 3, YEL)
    p.put(24, 10, YEL)
    p.put(1, 2, '#ff2040')
    p.put(1, 11, '#ff2040')
    # rodas
    for x in (4, 18):
        p.rect(x, 0, x + 3, 0, INK)
        p.rect(x, 13, x + 3, 13, INK)
    return outline(im)


def moto_rocam(frame):
    im = new(20, 12)
    p = Pen(im)
    p.rect(1, 4, 4, 7, '#2a2438')
    p.rect(3, 4, 16, 7, '#f4efe2')
    p.rect(3, 4, 16, 4, '#c9c0d8')
    p.rect(5, 5, 12, 6, '#1f2a5a')
    # caixa de luz traseira
    p.rect(3, 3, 5, 8, '#2a2438')
    p.rect(3, 3, 4, 5, RED if frame == 0 else '#7a2030')
    p.rect(3, 6, 4, 8, '#1a3a70' if frame == 0 else BLUE)
    # policial: corpo escuro e capacete branco
    p.rect(7, 3, 12, 8, '#1f2a5a')
    p.rect(8, 3, 11, 4, '#2f3f86')
    p.rect(11, 4, 14, 7, '#f4efe2')
    p.rect(12, 5, 13, 6, '#12151f')
    # braços e guidão
    p.rect(12, 2, 16, 3, '#1f2a5a')
    p.rect(12, 8, 16, 9, '#1f2a5a')
    p.rect(16, 2, 17, 9, '#8d83a6')
    p.rect(17, 3, 19, 8, '#2a2438')
    p.put(19, 4, YEL)
    p.put(19, 7, YEL)
    return outline(im)


def heli(frame):
    S = 46
    im = new(S, S)
    p = Pen(im)
    cx = cy = S // 2
    # cauda e corpo
    p.rect(2, cy - 1, 16, cy, '#3a3450')
    p.rect(1, cy - 4, 3, cy + 3, '#4a4460')
    p.ell(14, cy - 6, 32, cy + 6, '#1f2a5a')
    p.ell(16, cy - 5, 30, cy + 2, '#2f3f86')
    p.ell(28, cy - 4, 36, cy + 4, '#12151f')
    p.rect(20, cy - 1, 24, cy + 1, '#8d83a6')
    # patins
    p.rect(14, cy - 8, 32, cy - 8, '#8d83a6')
    p.rect(14, cy + 8, 32, cy + 8, '#8d83a6')
    out = outline(im)
    # rotor principal: pás girando (semi-transparentes)
    a = math.radians(frame * 60)
    o = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    from PIL import ImageDraw
    d = ImageDraw.Draw(o)
    for k in (0, 90):
        aa = a + math.radians(k)
        dx, dy = math.cos(aa) * 21, math.sin(aa) * 21
        d.line([(cx - dx + 3, cy - dy), (cx + dx + 3, cy + dy)], fill=(201, 192, 216, 170), width=2)
    out = Image.alpha_composite(out, o)
    Pen(out).disc(cx + 3, cy, 2, '#c9c0d8')
    return out


def item(kind):
    im = new(14, 14)
    p = Pen(im)
    p.disc(7, 7, 6, '#2e2540')
    if kind == 'turbo':
        p.disc(7, 7, 5, '#2f6fd0')
        p.poly([(8, 2), (4, 8), (7, 8), (6, 12), (11, 6), (8, 6)], YEL)
    elif kind == 'oleo':
        p.disc(7, 7, 5, '#3a3450')
        p.ell(4, 5, 10, 10, INK)
        p.poly([(7, 2), (4, 6), (10, 6)], INK)
        p.put(6, 6, '#8d83a6')
    elif kind == 'capacete':
        p.disc(7, 7, 5, '#a02a3c')
        p.ell(3, 4, 11, 11, RED)
        p.rect(7, 6, 11, 8, '#12151f')
        p.put(5, 6, '#ff9aa4')
    elif kind == 'pizza':
        p.disc(7, 7, 5, '#b8892f')
        p.poly([(2, 4), (12, 4), (7, 12)], YEL)
        p.put(5, 6, RED)
        p.put(8, 6, RED)
        p.put(7, 9, RED)
    elif kind == 'vida':
        p.disc(7, 7, 5, '#a02a3c')
        for (x, y) in [(4, 4), (5, 4), (8, 4), (9, 4), (3, 5), (4, 5), (5, 5), (6, 5), (7, 5), (8, 5), (9, 5), (10, 5),
                       (3, 6), (4, 6), (5, 6), (6, 6), (7, 6), (8, 6), (9, 6), (10, 6), (4, 7), (5, 7), (6, 7), (7, 7), (8, 7), (9, 7),
                       (5, 8), (6, 8), (7, 8), (8, 8), (6, 9), (7, 9)]:
            p.put(x, y, RED)
    return outline(im)


def pino(kind):
    im = new(18, 18)
    p = Pen(im)
    if kind == 'coleta':
        p.rect(3, 5, 14, 15, '#b8782a')
        p.rect(3, 5, 14, 7, '#d9a066')
        p.rect(8, 5, 9, 15, YEL)
        p.rect(5, 2, 12, 4, RED)
        p.rect(7, 1, 10, 4, '#ff9aa4')
    else:
        p.rect(2, 8, 15, 15, '#e8e2d4')
        p.poly([(1, 8), (9, 1), (16, 8)], '#2f8a4a')
        p.rect(7, 10, 10, 15, '#5fd17a')
        p.rect(3, 10, 5, 12, '#9fe0ff')
        p.rect(12, 10, 14, 12, '#9fe0ff')
    return outline(im)


def capa():
    rnd = random.Random(5)
    im = Image.new('RGBA', (320, 200), (22, 18, 31, 255))
    p = Pen(im)
    # quarteirões vistos de cima
    for y in range(0, 200, 40):
        for x in range(0, 320, 48):
            p.rect(x + 14, y + 14, x + 45, y + 37, rnd.choice(['#6b5a52', '#5a4e5e', '#7a6558', '#4e4a5c']))
            p.rect(x + 14, y + 36, x + 45, y + 37, '#3a3150')
            for _ in range(3):
                ax, ay = x + 18 + rnd.randint(0, 24), y + 18 + rnd.randint(0, 14)
                p.rect(ax, ay, ax + 3, ay + 3, '#8d83a6')
    # ruas
    for y in range(0, 200, 40):
        p.rect(0, y, 319, y + 13, '#2b2538')
        for x in range(0, 320, 16):
            p.rect(x + 3, y + 6, x + 10, y + 7, '#ffd36b')
    for x in range(0, 320, 48):
        p.rect(x, 0, x + 13, 199, '#2b2538')
    # luzes de sirene no asfalto
    glow = Image.new('RGBA', (320, 200), (0, 0, 0, 0))
    from PIL import ImageDraw
    g = ImageDraw.Draw(glow)
    g.ellipse([120, 60, 250, 120], fill=(255, 77, 94, 60))
    g.ellipse([60, 96, 190, 150], fill=(77, 163, 255, 60))
    im.alpha_composite(glow)
    # cachorro fugindo e viaturas atrás (sprites ampliados 3x, sem suavizar)
    def put_big(sprite, x, y, k=3):
        s = sprite.resize((sprite.width * k, sprite.height * k), Image.NEAREST)
        im.alpha_composite(s, (x, y))
    put_big(moto_cachorro(0), 200, 74)
    put_big(carro_rocam(0), 96, 70)
    put_big(moto_rocam(1), 138, 112)
    put_big(carro_rocam(1), 20, 98)
    # título
    sys.path.insert(0, os.path.dirname(__file__))
    from pinball_paulista import text, twidth
    for i, (s, k, c, y) in enumerate((('FUGA DA', 4, YEL, 8), ('ROCAM', 6, RED, 28))):
        x = 160 - twidth(s, k) // 2
        text(p, s, x + 2, y + 2, INK, k)
        text(p, s, x, y, c, k)
    return im


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    sp = os.path.join(out, 'sprites')
    os.makedirs(sp, exist_ok=True)

    def save(im, name):
        im.save(os.path.join(sp, name + '.png'))

    for f in (0, 1):
        rot4(moto_cachorro(f), 'moto', save, f)
        rot4(carro_rocam(f), 'carro', save, f)
        rot4(moto_rocam(f), 'motopm', save, f)
    for f in range(3):
        save(heli(f), f'heli_{f}')
    for k in ('turbo', 'oleo', 'capacete', 'pizza', 'vida'):
        save(item(k), 'item_' + k)
    for k in ('coleta', 'entrega'):
        save(pino(k), 'pino_' + k)
    capa().save(os.path.join(out, 'capa.png'))
    print('ok')
