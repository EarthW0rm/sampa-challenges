"""Xadrez Paulistano: fundo com tabuleiro de calçada paulistana (320x200), peças (20x20), peças
mini (10x11) e capa (320x200).

Uso:  python3 xadrez_paulistano.py <pasta de saída>   (grava cenario/*.png, pecas/*.png e capa.png)
Os PNGs são 1×: o jogo aplica o Scale2x em tempo de execução (game/hires.ts).

As posições do tabuleiro e dos painéis precisam bater com `game/constants.ts`
(BOARD_X, BOARD_Y, SQ, PANEL_X, PANEL_W, BOX_TOP_Y, BOX_BOTTOM_Y, BOX_H, STATUS_Y, STATUS_H).
"""
import os
import random
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from biblioteca.prim import INK, Pen, new, outline  # noqa: E402

# ---------------------------------------------------------------- layout (igual a game/constants.ts)
BOARD_X, BOARD_Y, SQ = 14, 12, 22
PANEL_X, PANEL_W = 204, 110
BOX_TOP_Y, BOX_BOTTOM_Y, BOX_H = 6, 156, 38
STATUS_Y, STATUS_H = 132, 20

# ---------------------------------------------------------------- peças (máscaras 16x18)
# x = corpo, d = linha escura (detalhe), g = enfeite (joia/cruz)
PECAS = {
    'p': [
        '................', '................', '................', '................',
        '......xxxx......', '.....xxxxxx.....', '.....xxxxxx.....', '......xxxx......',
        '.....xxxxxx.....', '......xxxx......', '......xxxx......', '.....xxxxxx.....',
        '....xxxxxxxx....', '...xxxxxxxxxx...', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..',
        '..dddddddddddd..', '..xxxxxxxxxxxx..',
    ],
    'n': [
        '................', '......x.x.......', '.....xxxxx......', '....xxxxxxx.....',
        '...xxxdxxxxx....', '..xxxxxxxxxxx...', '.xxxxxxxxxxxx...', '.xxxxx.xxxxxxx..',
        '..xxx..xxxxxxx..', '......xxxxxxxx..', '.....xxxxxxxx...', '.....xxxxxxxx...',
        '....xxxxxxxxx...', '....xxxxxxxxx...', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..',
        '..dddddddddddd..', '..xxxxxxxxxxxx..',
    ],
    'b': [
        '.......gg.......', '.......xx.......', '......xxxx......', '.....xxxxxx.....',
        '....xxxxdxxx....', '....xxxdxxxx....', '....xxdxxxxx....', '.....xxxxxx.....',
        '......xxxx......', '.....dddddd.....', '......xxxx......', '......xxxx......',
        '.....xxxxxx.....', '....xxxxxxxx....', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..',
        '..dddddddddddd..', '..xxxxxxxxxxxx..',
    ],
    'r': [
        '................', '...xx.xxxx.xx...', '...xxxxxxxxxx...', '...xxxxxxxxxx...',
        '....dddddddd....', '....xxxxxxxx....', '.....xxxxxx.....', '.....xxxxxx.....',
        '.....xxddxx.....', '.....xxddxx.....', '.....xxxxxx.....', '.....xxxxxx.....',
        '....xxxxxxxx....', '....dddddddd....', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..',
        '..dddddddddddd..', '..xxxxxxxxxxxx..',
    ],
    'q': [
        '.g..g..gg..g..g.', '.x..x..xx..x..x.', '.xx.xx.xx.xx.xx.', '..xxxxxxxxxxxx..',
        '..xxxxxxxxxxxx..', '...xxxxxxxxxx...', '....dddddddd....', '.....xxxxxx.....',
        '......xxxx......', '......xxxx......', '......xxxx......', '.....xxxxxx.....',
        '....xxxxxxxx....', '....dddddddd....', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..',
        '..dddddddddddd..', '..xxxxxxxxxxxx..',
    ],
    'k': [
        '.......gg.......', '......gggg......', '.......gg.......', '....xx.xx.xx....',
        '...xxxxxxxxxx...', '...xxxxxxxxxx...', '....xxxxxxxx....', '....dddddddd....',
        '.....xxxxxx.....', '......xxxx......', '......xxxx......', '......xxxx......',
        '.....xxxxxx.....', '....dddddddd....', '...xxxxxxxxxx...', '..xxxxxxxxxxxx..',
        '..dddddddddddd..', '..xxxxxxxxxxxx..',
    ],
}

# cores por lado: corpo, luz, sombra, detalhe, enfeite
CORES = {
    'w': dict(body='#f6efdc', light='#ffffff', shade='#c9b994', detail='#8f7f63', gem='#e8b83a'),
    'b': dict(body='#3b3050', light='#6e5f8c', shade='#251c33', detail='#140e1c', gem='#e0484f'),
}


def _filled(mask, x, y):
    return 0 <= y < len(mask) and 0 <= x < len(mask[0]) and mask[y][x] != '.'


def _pinta(mask, cores):
    """Máscara -> imagem do tamanho da máscara, com luz à esquerda/no topo e sombra à direita."""
    h, w = len(mask), len(mask[0])
    im = new(w, h)
    p = Pen(im)
    for y in range(h):
        row = mask[y]
        xs = [x for x in range(w) if row[x] != '.']
        right = sorted(xs)[-2:] if len(xs) > 3 else xs[-1:]
        for x in xs:
            ch = row[x]
            if ch == 'd':
                c = cores['detail']
            elif ch == 'g':
                c = cores['gem']
            elif x in right:
                c = cores['shade']
            elif not _filled(mask, x - 1, y) or not _filled(mask, x, y - 1):
                c = cores['light']
            else:
                c = cores['body']
            p.put(x, y, c)
    return im


def peca(tipo, lado):
    """20x20: máscara 16x18 em (2,1) com contorno de 1 px."""
    im = new(20, 20)
    im.alpha_composite(_pinta(PECAS[tipo], CORES[lado]), (2, 1))
    return outline(im)


def peca_mini(tipo, lado):
    """10x11: a máscara reduzida pela metade (bloco 2x2 conta se tiver 2+ pixels cheios)."""
    m = PECAS[tipo]
    small = []
    for y in range(0, 18, 2):
        row = ''
        for x in range(0, 16, 2):
            cells = [m[y + dy][x + dx] for dy in (0, 1) for dx in (0, 1)]
            cheios = [c for c in cells if c != '.']
            if len(cheios) < 2:
                row += '.'
            elif cheios.count('g') >= 2:
                row += 'g'
            else:
                row += 'x'
        small.append(row)
    im = new(10, 11)
    im.alpha_composite(_pinta(small, CORES[lado]), (1, 1))
    return outline(im)


# ---------------------------------------------------------------- calçada paulistana

def _calcada(p, x0, y0, base, rejunte, pedras, rnd, w=SQ, h=SQ):
    """Casa de mosaico português: pedrinhas irregulares separadas por rejunte."""
    p.rect(x0, y0, x0 + w - 1, y0 + h - 1, rejunte)
    y = y0
    linha = 0
    while y < y0 + h:
        ph = rnd.choice((3, 4, 4, 5))
        x = x0 - (linha % 2) * 2
        while x < x0 + w:
            pw = rnd.choice((3, 4, 4, 5))
            ax, ay = max(x, x0), y
            bx, by = min(x + pw - 2, x0 + w - 1), min(y + ph - 2, y0 + h - 1)
            c = rnd.choice(pedras) if rnd.random() < 0.35 else base
            p.rect(ax, ay, bx, by, c)
            x += pw
        y += ph
        linha += 1


# pedra portuguesa clara (calcário) e escura (basalto)
CLARO = dict(base='#e4d9c0', rejunte='#bfb194', pedras=('#ede4d0', '#d8ccb0', '#e9dfc8'))
ESCURO = dict(base='#695f7a', rejunte='#4a4260', pedras=('#736a84', '#5e556f', '#6e6580'))


def _caixa(p, x0, y0, x1, y1):
    """Painel escuro com borda chanfrada."""
    p.rect(x0, y0, x1, y1, '#3a3150')
    p.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, '#16121f')
    p.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, '#2e2540')


def _catedral(p, cx, base):
    """Silhueta da Catedral da Sé: corpo, cúpula central e duas torres com agulha."""
    sil, sil_l, vitral = '#1e1830', '#2a2240', '#8a7650'
    # corpo e cúpula
    p.rect(cx - 30, base - 26, cx + 30, base, sil)
    p.disc(cx, base - 36, 11, sil)
    p.rect(cx - 11, base - 36, cx + 11, base - 26, sil)
    p.rect(cx - 1, base - 54, cx + 1, base - 46, sil)
    p.rect(cx - 3, base - 50, cx + 3, base - 49, sil)
    # torres da fachada
    for tx in (cx - 22, cx + 22):
        p.rect(tx - 6, base - 46, tx + 6, base, sil)
        p.poly([(tx - 6, base - 46), (tx + 6, base - 46), (tx, base - 66)], sil)
        p.rect(tx, base - 72, tx, base - 66, sil)
        p.rect(tx - 2, base - 70, tx + 2, base - 70, sil)
        p.rect(tx - 6, base - 46, tx - 5, base, sil_l)
        for wy in range(base - 40, base - 8, 10):
            p.rect(tx - 1, wy, tx + 1, wy + 5, vitral)
    # rosácea e porta
    p.disc(cx, base - 17, 4, vitral)
    p.disc(cx, base - 17, 2, '#c8a85c')
    p.rect(cx - 4, base - 9, cx + 4, base, '#120e1c')
    p.rect(cx - 30, base - 26, cx + 30, base - 26, sil_l)


def _ceu(p, w, h, rnd, estrelas_ate):
    for y in range(h):
        t = y / h
        p.rect(0, y, w - 1, y, '#%02x%02x%02x' % (int(22 + 26 * t), int(16 + 18 * t), int(40 + 30 * t)))
    for _ in range(60):
        sx, sy = rnd.randint(0, w - 1), rnd.randint(0, estrelas_ate)
        p.put(sx, sy, rnd.choice(('#f4efe2', '#c9c0d8', '#8a8098')))


def _predios(p, x0, x1, chao, rnd, hmin, hmax):
    x = x0
    while x < x1:
        w = rnd.choice((10, 12, 14, 16, 18))
        h = rnd.randint(hmin, hmax)
        p.rect(x, chao - h, min(x + w - 1, x1), chao, rnd.choice(('#2a2540', '#2e2a48', '#332d50')))
        for wy in range(chao - h + 3, chao - 2, 5):
            for wx in range(x + 2, min(x + w - 2, x1 - 1), 4):
                if rnd.random() < 0.45:
                    p.rect(wx, wy, wx + 1, wy + 2, rnd.choice(('#8a7650', '#6b5a45', '#a8905c')))
        x += w + rnd.randint(0, 2)


def fundo():
    rnd = random.Random(11)
    im = Image.new('RGBA', (320, 200), (22, 18, 31, 255))
    p = Pen(im)
    _ceu(p, 320, 200, rnd, 120)
    _predios(p, PANEL_X - 4, 319, 130, rnd, 30, 70)
    _catedral(p, PANEL_X + PANEL_W // 2, 130)
    # chão da praça atrás do painel de status e das caixas de baixo
    p.rect(PANEL_X - 6, 130, 319, 199, '#241d33')
    for x in range(PANEL_X - 6, 320, 8):
        p.rect(x, 131, x + 3, 131, '#2e2540')

    # moldura do tabuleiro (granito escuro com chanfro)
    fx0, fy0 = BOARD_X - 8, BOARD_Y - 8
    fx1, fy1 = BOARD_X + 8 * SQ + 7, BOARD_Y + 8 * SQ + 7
    p.rect(fx0 - 1, fy0 - 1, fx1 + 1, fy1 + 1, INK)
    p.rect(fx0, fy0, fx1, fy1, '#2e2540')
    p.rect(fx0, fy0, fx1, fy0, '#4a4060')
    p.rect(fx0, fy0, fx0, fy1, '#4a4060')
    p.rect(fx0, fy1, fx1, fy1, '#1e1830')
    p.rect(fx1, fy0, fx1, fy1, '#1e1830')
    p.rect(BOARD_X - 2, BOARD_Y - 2, BOARD_X + 8 * SQ + 1, BOARD_Y + 8 * SQ + 1, '#1e1830')
    p.rect(BOARD_X - 1, BOARD_Y - 1, BOARD_X + 8 * SQ, BOARD_Y + 8 * SQ, INK)

    # casas
    for r in range(8):
        for f in range(8):
            c = CLARO if (r + f) % 2 == 0 else ESCURO
            _calcada(p, BOARD_X + f * SQ, BOARD_Y + r * SQ, c['base'], c['rejunte'], c['pedras'], rnd)

    # painéis
    _caixa(p, PANEL_X, BOX_TOP_Y, PANEL_X + PANEL_W - 1, BOX_TOP_Y + BOX_H - 1)
    _caixa(p, PANEL_X, BOX_BOTTOM_Y, PANEL_X + PANEL_W - 1, BOX_BOTTOM_Y + BOX_H - 1)
    _caixa(p, PANEL_X, STATUS_Y, PANEL_X + PANEL_W - 1, STATUS_Y + STATUS_H - 1)
    return im


GLYPHS = {
    'A': '.#.|#.#|###|#.#|#.#', 'D': '##.|#.#|#.#|#.#|##.', 'E': '###|#..|##.|#..|###', 'L': '#..|#..|#..|#..|###',
    'N': '##.|#.#|#.#|#.#|#.#', 'O': '###|#.#|#.#|#.#|###', 'P': '###|#.#|###|#..|#..', 'R': '##.|#.#|##.|#.#|#.#',
    'S': '###|#..|###|..#|###', 'T': '###|.#.|.#.|.#.|.#.', 'U': '#.#|#.#|#.#|#.#|###', 'X': '#.#|#.#|.#.|#.#|#.#',
    'Z': '###|..#|.#.|#..|###', 'I': '###|.#.|.#.|.#.|###', 'Q': '###|#.#|#.#|###|..#', 'C': '###|#..|#..|#..|###',
    ' ': '...|...|...|...|...',
}


def _texto(p, s, x, y, c, k):
    for ch in s:
        for gy, row in enumerate(GLYPHS[ch].split('|')):
            for gx, v in enumerate(row):
                if v == '#':
                    p.rect(x + gx * k, y + gy * k, x + gx * k + k - 1, y + gy * k + k - 1, c)
        x += 4 * k


def _largura(s, k):
    return (len(s) * 4 - 1) * k


def capa():
    rnd = random.Random(5)
    im = Image.new('RGBA', (320, 200), (22, 18, 31, 255))
    p = Pen(im)
    _ceu(p, 320, 200, rnd, 90)
    _predios(p, 0, 319, 120, rnd, 30, 80)
    _catedral(p, 64, 120)
    # tabuleiro em perspectiva simples: 8 colunas x 4 fileiras visíveis
    p.rect(0, 120, 319, 199, '#241d33')
    for r in range(4):
        for f in range(9):
            c = CLARO if (r + f) % 2 == 0 else ESCURO
            _calcada(p, f * 36 - 4, 128 + r * 18, c['base'], c['rejunte'], c['pedras'], rnd, 36, 18)
    # peças grandes (2x)
    for tipo, lado, x in (('k', 'w', 112), ('q', 'b', 160), ('n', 'w', 208), ('r', 'b', 252)):
        pc = peca(tipo, lado)
        pc = pc.resize((40, 40), Image.NEAREST)
        im.alpha_composite(pc, (x, 104))
    # título
    for s, y, k, c in (('XADREZ', 14, 6, '#ffd36b'), ('PAULISTANO', 54, 3, '#f4efe2')):
        x = 200 - _largura(s, k) // 2
        _texto(p, s, x + 2, y + 2, INK, k)
        _texto(p, s, x, y, c, k)
    # cachorro caramelo (biblioteca) assistindo à partida
    lib = os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'shared', 'sprites', 'assets', 'caes', 'p1_normal_0.png')
    if os.path.exists(lib):
        dog = Image.open(lib).convert('RGBA')
        im.alpha_composite(dog, (0, 76))
    return im


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(os.path.join(out, 'cenario'), exist_ok=True)
    os.makedirs(os.path.join(out, 'pecas'), exist_ok=True)
    fundo().save(os.path.join(out, 'cenario', 'tabuleiro.png'))
    for lado in 'wb':
        for tipo in 'pnbrqk':
            peca(tipo, lado).save(os.path.join(out, 'pecas', f'{lado}{tipo}.png'))
            peca_mini(tipo, lado).save(os.path.join(out, 'pecas', f'mini_{lado}{tipo}.png'))
    capa().save(os.path.join(out, 'capa.png'))
    print('ok')
