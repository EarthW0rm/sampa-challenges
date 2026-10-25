"""Pastel de Feira ("barraca aconchegante"): cenário, móveis, equipamentos, interface (molduras de
madeira 9-slice), ícones do painel, de evento e de perfil, ingredientes, pastéis, HUD e capa.

Uso:
  python3 pastel_de_feira.py <pasta-de-saida> [--previa <pasta-de-previa>] [--caes <pasta caes_pe>]

  <pasta-de-saida>  normalmente ../../src/games/pastel-de-feira/assets
  --previa          grava prévias em 2× (dia de feira montado e folha de sprites)
  --caes            pasta dos cachorros da biblioteca (src/shared/sprites/assets/caes_pe), só para a prévia

Todos os PNGs são 1× (o jogo aplica Scale2x), exceto os de `ui/hud_*`, que vão para o DOM e são
ampliados por CSS (`image-rendering: pixelated`). Peças "3-slice" (`_esq`, `_meio`, `_dir`) têm o
meio repetível a cada 16 px; peças "9-slice" têm cantos de tamanho fixo (ver o CLAUDE.md do jogo).
Não edite os PNGs à mão: mude este script e gere de novo.
"""
import os, sys, random
from PIL import Image
from biblioteca.prim import Pen, new, outline, hexc, scale2x

# ---------------------------------------------------------------- paleta
INK = '#2e1c12'                       # contorno (marrom quase preto, mais quente que o INK da biblioteca)
TOLDO, TOLDO_D, TOLDO_L = '#c8432b', '#9a2e1e', '#de5b40'
CREME, CREME_D, CREME_L = '#f3e3bf', '#d9c49a', '#fff4da'
MAD, MAD_D, MAD_L, MAD_K = '#9a6334', '#6e4320', '#b07540', '#7e4e26'
TABUA, TABUA_D, TABUA_L = '#b47038', '#7a4a22', '#d08a4a'
TAMPO, TAMPO_L, TAMPO_K = '#d8a15e', '#f0c27a', '#c98f4f'
MOLD, MOLD_L, MOLD_D, MOLD_O = '#c9803a', '#e9a85a', '#8e5222', '#4a2a12'
PERG, PERG_D, PERG_L = '#f6d9a0', '#d9b27a', '#fbebc4'
SLOT, SLOT_L, SLOT_D, POCO = '#ebc48a', '#f8dda8', '#b98345', '#d7a262'
TXT, TXT_2 = '#3b2412', '#6b4a2a'
CALC, CALC_D, CALC_S, CALC_L = '#e3dacb', '#625a53', '#cfc4b0', '#f1eadc'
ACO, ACO_L, ACO_D, ACO_O, ACO_P = '#b8c1c8', '#dde3e7', '#8a949b', '#4a5258', '#6b747b'
FERRO, FERRO_L, FERRO_D = '#3a3a40', '#5a5a62', '#1a1a1e'
BORDA, BORDA_L = '#8e949c', '#c9cec3'
OLEO, OLEO_L, OLEO_SUJO, OLEO_SUJO_L = '#d9961f', '#e8b04a', '#9a6418', '#b07a24'
FOGO, FOGO_L = '#f08a2a', '#ffd24a'
CANA, CANA_L, CANA_D, CANA_O = '#9bbf4a', '#b5cc5a', '#6e8f2e', '#3e5a1c'
MAQ, MAQ_L, MAQ_D, MAQ_O = '#4e8f3a', '#77b85a', '#3b6e2c', '#23401a'
AZUL, AZUL_L, AZUL_D = '#4f7bbf', '#8fb3e0', '#2f5590'
OURO, OURO_L, OURO_D, OURO_O = '#f2c14e', '#fbe08a', '#b8860b', '#5a3e0a'
VERDE, VERMELHO, LARANJA = '#7bc043', '#d9503f', '#e0a23a'
PAPEL = '#fbf6e8'
VIDRO, VIDRO_L = '#2f4a52', '#4f7a85'

OUT = '.'
SAIDA = {}


def save(im, name):
    p = os.path.join(OUT, name + '.png')
    os.makedirs(os.path.dirname(p) or '.', exist_ok=True)
    im.save(p)
    SAIDA[name] = im
    return p


def R(p, x, y, w, h, c):
    """Retângulo por largura/altura (o Pen usa cantos inclusivos)."""
    if w > 0 and h > 0:
        p.rect(x, y, x + w - 1, y + h - 1, c)


def tile_fill(im, tile, x0, y0, x1, y1):
    """Preenche [x0,x1)×[y0,y1) repetindo `tile` alinhado à origem da imagem."""
    tw, th = tile.size
    for ty in range((y0 // th) * th, y1, th):
        for tx in range((x0 // tw) * tw, x1, tw):
            cx0, cy0 = max(x0, tx), max(y0, ty)
            cx1, cy1 = min(x1, tx + tw), min(y1, ty + th)
            if cx1 > cx0 and cy1 > cy0:
                im.paste(tile.crop((cx0 - tx, cy0 - ty, cx1 - tx, cy1 - ty)), (cx0, cy0))


def shade(im, x0, y0, x1, y1, k):
    px = im.load()
    for y in range(max(0, y0), min(im.height, y1)):
        for x in range(max(0, x0), min(im.width, x1)):
            r, g, b, a = px[x, y]
            if a:
                px[x, y] = (int(r * k), int(g * k), int(b * k), a)


def slice3(full, name, l=8, r=8):
    """Corta uma peça desenhada com 32 px (8 + 16 + 8) em _esq, _meio e _dir."""
    w, h = full.size
    save(full.crop((0, 0, l, h)), f'{name}_esq')
    save(full.crop((l, 0, w - r, h)), f'{name}_meio')
    save(full.crop((w - r, 0, w, h)), f'{name}_dir')


def nine(img, c, w, h):
    """Monta um 9-slice (cantos `c`) em w×h — usado nas prévias e documentado para o jogo."""
    iw, ih = img.size
    out = new(w, h)
    mw, mh = iw - 2 * c, ih - 2 * c
    def part(sx, sy, sw, sh, dx, dy, dw, dh):
        if dw <= 0 or dh <= 0: return
        src = img.crop((sx, sy, sx + sw, sy + sh))
        for yy in range(dy, dy + dh, sh):
            for xx in range(dx, dx + dw, sw):
                cw, ch = min(sw, dx + dw - xx), min(sh, dy + dh - yy)
                out.alpha_composite(src.crop((0, 0, cw, ch)), (xx, yy))
    part(0, 0, c, c, 0, 0, c, c); part(iw - c, 0, c, c, w - c, 0, c, c)
    part(0, ih - c, c, c, 0, h - c, c, c); part(iw - c, ih - c, c, c, w - c, h - c, c, c)
    part(c, 0, mw, c, c, 0, w - 2 * c, c); part(c, ih - c, mw, c, c, h - c, w - 2 * c, c)
    part(0, c, c, mh, 0, c, c, h - 2 * c); part(iw - c, c, c, mh, w - c, c, c, h - 2 * c)
    part(c, c, mw, mh, c, c, w - 2 * c, h - 2 * c)
    return out


# ---------------------------------------------------------------- texturas
def tile_mosaico():
    """Calçada paulistana de pedra portuguesa, 32×32: pedrinhas claras com rejunte e uma faixa
    escura em ondas escalonadas a cada 32 linhas (contraste baixo para não brigar com os clientes)."""
    im = new(32, 32); p = Pen(im); rnd = random.Random(11)
    R(p, 0, 0, 32, 32, CALC)
    for y in range(0, 32, 4):                         # rejunte das pedrinhas (4×4, fileiras desencontradas)
        R(p, 0, y, 32, 1, CALC_S)
        off = 2 if (y // 4) % 2 else 0
        for x in range(off, 32, 4): p.put(x, y + 1, CALC_S); p.put(x, y + 2, CALC_S)
    for _ in range(14): p.put(rnd.randrange(32), rnd.randrange(32), CALC_L)
    onda = (0, 0, 2, 2, 4, 4, 6, 6, 8, 8, 6, 6, 4, 4, 2, 2)
    for x in range(32):
        y0 = 10 + onda[(x // 2) % 16]
        R(p, x, y0, 1, 4, '#8f857b')
        p.put(x, y0, '#a39a90')
    return im


def tile_madeira():
    """Assoalho da barraca, 64×16 (tábuas de 8 px com emendas desencontradas)."""
    im = new(64, 16); p = Pen(im)
    R(p, 0, 0, 64, 16, MAD)
    for y in (0, 8): R(p, 0, y, 64, 1, MAD_L)
    for y in (7, 15): R(p, 0, y, 64, 1, MAD_D)
    R(p, 20, 0, 1, 7, MAD_D); R(p, 52, 8, 1, 7, MAD_D)
    for x, y in ((40, 3), (8, 11), (30, 12), (58, 4)): R(p, x, y, 2, 1, MAD_K)
    return im


def piso_16(kind):
    """Ladrilhos 16×16 de compatibilidade (o `tile()` antigo); a arte nova pinta tudo no `fundo`."""
    if kind == 'fila': return tile_mosaico().crop((0, 0, 16, 16))
    if kind == 'madeira': return tile_madeira().crop((0, 0, 16, 16))
    im = new(16, 16); p = Pen(im)
    if kind == 'mesas':
        R(p, 0, 0, 16, 16, CALC_L); R(p, 0, 15, 16, 1, CALC_S); R(p, 15, 0, 1, 16, CALC_S)
    else:  # metal
        R(p, 0, 0, 16, 16, ACO_D); R(p, 0, 0, 16, 1, ACO); [p.put(x, y, ACO_P) for x, y in ((3, 4), (11, 4), (3, 12), (11, 12))]
    return im


# ---------------------------------------------------------------- cenário 640×480
def fundo():
    """Calçada, assoalho em L, toldo com festão, bandeirinhas sobre a fila, postes e meio-fio.
    Zonas (layout.ts): fila 8,30 292×118 · balcão 306,30 · fileira do meio y158 h134 · baixo y306."""
    im = new(640, 480); p = Pen(im)
    tile_fill(im, tile_mosaico(), 0, 0, 640, 480)
    mad = tile_madeira()
    tile_fill(im, mad, 304, 24, 640, 152)
    tile_fill(im, mad, 0, 152, 640, 300)
    # borda do assoalho sobre a calçada (frente da barraca) e sombra
    R(p, 0, 150, 304, 2, TABUA_D); R(p, 0, 300, 640, 2, TABUA_D); R(p, 302, 24, 2, 128, TABUA_D)
    shade(im, 0, 152, 304, 155, 0.8); shade(im, 0, 302, 640, 306, 0.85)
    shade(im, 0, 24, 304, 34, 0.86); shade(im, 304, 24, 640, 30, 0.8)   # sombra do toldo
    # toldo listrado
    for x in range(0, 640, 32):
        R(p, x, 0, 16, 24, TOLDO); R(p, x + 16, 0, 16, 24, CREME)
        R(p, x, 2, 16, 2, TOLDO_L); R(p, x + 16, 2, 16, 2, CREME_L)
    R(p, 0, 0, 640, 2, '#5a2418')
    shade(im, 0, 18, 640, 24, 0.88)
    # festão (borda recortada), alternando as cores das listras
    for x in range(0, 640, 32):
        for dx, c in ((0, '#b53a24'), (16, '#e6d2a6')):
            R(p, x + dx + 2, 24, 12, 4, c); R(p, x + dx + 4, 28, 8, 2, c)
            R(p, x + dx + 2, 28, 2, 1, INK); R(p, x + dx + 12, 28, 2, 1, INK); R(p, x + dx + 4, 30, 8, 1, INK)
    # bandeirinhas sobre a fila
    cores = ('#e0a23a', AZUL, TOLDO, '#6fa24a')
    R(p, 0, 33, 302, 1, '#5a3a22')
    for i, x in enumerate(range(3, 296, 18)):
        c = cores[i % 4]
        for dy, (dx, w) in enumerate(((0, 10), (0, 10), (0, 10), (1, 8), (1, 8), (2, 6), (2, 6), (3, 4), (3, 4), (4, 2))):
            R(p, x + dx, 34 + dy, w, 1, c)
        R(p, x, 34, 10, 1, '#ffffff'); shade(im, x, 34, x + 10, 35, 0.95)
    # postes de ferro da barraca
    for x in (302, 636):
        R(p, x, 24, 4, 128, '#4e555c'); R(p, x + 1, 24, 1, 128, '#a9b1b8')
    # meio-fio no rodapé
    R(p, 0, 472, 640, 8, '#b9b2a6'); R(p, 0, 472, 640, 1, '#ddd7cc'); R(p, 0, 479, 640, 1, '#8a8378')
    for x in range(0, 640, 40): R(p, x, 473, 1, 6, '#8a8378')
    return im


# ---------------------------------------------------------------- móveis (3-slice: 8 + 16 + 8)
def balcao():
    """Balcão de madeira, 72 de altura: tampo 3..46 (prontos, copos, moedas), frente 49..69."""
    w, h = 32, 72
    im = new(w, h); p = Pen(im)
    R(p, 0, 0, w, h, MOLD_O)
    R(p, 1, 1, w - 2, 46, TAMPO); R(p, 1, 1, w - 2, 2, TAMPO_L)
    for x in range(1, w - 1):
        k = (x - 8) % 16
        if k in (3, 4, 5, 6, 7): p.put(x, 14, TAMPO_K)
        if k in (11, 12, 13, 14): p.put(x, 30, TAMPO_K)
        if k == 9: p.put(x, 40, TAMPO_K)
    R(p, 1, 47, w - 2, 2, TABUA_D)
    for x in range(1, w - 1):
        k = (x - 8) % 8
        R(p, x, 49, 1, 21, TABUA_L if k == 0 else TABUA_D if k == 7 else TABUA)
        if k == 4: p.put(x, 53, TABUA_D); p.put(x, 65, TABUA_D)
    R(p, 1, 49, w - 2, 1, '#5a3418')
    # cabeceiras mais escuras (postes do balcão)
    for x in (1, 2, w - 3, w - 2): R(p, x, 3, 1, 67, MOLD_D)
    return im


def bancada():
    """Bancada de inox com pés e prateleira, 84 de altura: tampo 1..55."""
    w, h = 32, 84
    im = new(w, h); p = Pen(im)
    R(p, 0, 0, w, 62, ACO_O)
    R(p, 1, 1, w - 2, 55, ACO); R(p, 1, 1, w - 2, 2, ACO_L)
    for x in range(1, w - 1):
        k = (x - 8) % 16
        if k in (2, 3, 4, 5, 6, 7, 8): p.put(x, 18, '#c6ced4')
        if k in (10, 11, 12, 13): p.put(x, 37, '#c6ced4')
    R(p, 1, 56, w - 2, 5, ACO_D); R(p, 1, 56, w - 2, 1, '#a3adb4')
    for x in (2, w - 6):                                    # pés
        R(p, x, 62, 4, 22, ACO_O); R(p, x + 1, 62, 2, 21, ACO_P)
    R(p, 0, 72, w, 4, ACO_O); R(p, 1, 73, w - 2, 2, ACO_P)  # prateleira
    return im


def fogao():
    """Fogão de ferro sob o tacho, 96 de altura; boca acesa na faixa 64..67."""
    w, h = 32, 96
    im = new(w, h); p = Pen(im)
    R(p, 0, 0, w, h, FERRO_D)
    R(p, 1, 1, w - 2, h - 2, FERRO); R(p, 1, 1, w - 2, 3, FERRO_L)
    R(p, 1, 62, w - 2, 6, '#2a1a10')
    R(p, 2, 64, w - 4, 3, FOGO)
    for x in range(2, w - 2):
        if (x - 8) % 16 in (3, 4, 11): R(p, x, 63, 1, 4, FOGO_L)
    R(p, 1, 80, w - 2, 15, '#2a2a30'); R(p, 1, 80, w - 2, 1, FERRO_L)
    for x in range(1, w - 1):
        if (x - 8) % 16 in (6, 7, 8): R(p, x, 85, 1, 4, BORDA_L)
        if (x - 8) % 16 == 7: p.put(x, 84, '#ffffff')
    return im


def tacho(sujo=False):
    """Panela larga com óleo, 58 de altura, 3-slice 10+16+10 (cantos arredondados nas pontas)."""
    w, h = 36, 58
    im = new(w, h); p = Pen(im)
    oil, oil_l = (OLEO_SUJO, OLEO_SUJO_L) if sujo else (OLEO, OLEO_L)
    p.rrect(0, 0, w - 1, h - 1, 9, '#17171c')
    p.rrect(1, 1, w - 2, h - 2, 8, BORDA)
    R(p, 8, 1, w - 16, 2, BORDA_L)
    p.rrect(4, 4, w - 5, h - 5, 6, '#2a2a30')
    p.rrect(5, 5, w - 6, h - 6, 5, oil)
    R(p, 8, 6, w - 16, 3, oil_l); R(p, 6, 9, 2, 2, oil_l)
    for x in range(5, w - 5):
        k = (x - 10) % 16
        if k == 3: R(p, x, 24, 2, 2, oil_l)
        if k == 11: R(p, x, 40, 2, 1, oil_l)
        if sujo and k == 7: R(p, x, 31, 2, 2, '#6e4410')
    return im


def estufa():
    """Estufa de vidro, 80 de altura: luz quente no alto, prateleira no meio (slots no código)."""
    w, h = 32, 80
    im = new(w, h); p = Pen(im)
    R(p, 0, 0, w, h, ACO_O)
    R(p, 1, 1, w - 2, 6, BORDA); R(p, 1, 1, w - 2, 1, BORDA_L)
    R(p, 1, 7, w - 2, 2, '#ff9a3a')
    R(p, 1, 9, w - 2, 54, VIDRO)
    for x in range(1, w - 1):
        k = (x - 8) % 16
        for y in range(10, 62):
            if (k - (y % 16)) % 16 in (0, 1) and y % 32 < 14: p.put(x, y, VIDRO_L)
    R(p, 1, 35, w - 2, 2, BORDA)
    R(p, 1, 63, w - 2, 16, ACO_D); R(p, 1, 63, w - 2, 1, ACO)
    for x in range(1, w - 1):
        if (x - 8) % 16 in (4, 5, 6, 7, 8, 9): R(p, x, 70, 1, 2, ACO_O)
    return im


def escrivaninha():
    w, h = 32, 22
    im = new(w, h); p = Pen(im)
    R(p, 0, 0, w, h, MOLD_O)
    R(p, 1, 1, w - 2, 14, '#a06a3a'); R(p, 1, 1, w - 2, 1, '#c08a52')
    R(p, 1, 15, w - 2, 6, MAD_D)
    for x in range(1, w - 1):
        if (x - 8) % 16 in (6, 7, 8, 9): R(p, x, 17, 1, 2, OURO_D)
    return im


def banco():
    w, h = 32, 18
    im = new(w, h); p = Pen(im)
    R(p, 0, 0, w, 8, MOLD_O); R(p, 1, 1, w - 2, 5, TABUA); R(p, 1, 1, w - 2, 1, TABUA_L)
    for x in (3, w - 6): R(p, x, 8, 3, 10, MOLD_O); R(p, x + 1, 8, 1, 9, TABUA_D)
    return im


# ---------------------------------------------------------------- equipamentos (sprites inteiros)
def moenda(tipo):
    """Moenda de cana 72×72: corpo verde, rolos, roda (manual) ou motor, bica e canas no chão."""
    im = new(72, 72); p = Pen(im)
    R(p, 8, 10, 46, 46, MAQ_O); R(p, 9, 11, 44, 44, MAQ); R(p, 9, 11, 44, 3, MAQ_L); R(p, 9, 47, 44, 8, MAQ_D)
    R(p, 12, 2, 40, 10, '#2a1a10'); R(p, 13, 3, 38, 8, '#9aa3aa'); R(p, 13, 3, 38, 2, BORDA_L)
    for x in range(18, 50, 8): R(p, x, 3, 1, 8, ACO_P)
    R(p, 26, 0, 4, 4, CANA_O); R(p, 27, 0, 2, 3, CANA)     # cana entrando
    R(p, 14, 18, 18, 12, CREME); R(p, 16, 20, 14, 2, TOLDO); R(p, 16, 24, 10, 1, MAQ_D); R(p, 16, 27, 12, 1, MAQ_D)
    R(p, 20, 55, 10, 6, ACO_P); R(p, 22, 61, 6, 2, ACO_D)  # bica
    if tipo == 'manual':
        p.disc(60, 30, 11, '#2a1a10'); p.disc(60, 30, 10, MAD); p.disc(60, 30, 7, '#3a2414')
        R(p, 58, 20, 4, 21, MAD); R(p, 50, 28, 21, 4, MAD); R(p, 57, 27, 6, 6, BORDA_L)
        R(p, 66, 16, 4, 8, TOLDO); R(p, 66, 16, 4, 2, TOLDO_L)
    else:
        cor, cor_l = (AZUL, AZUL_L) if tipo == 'motor' else ('#3fa65a', '#8fdc9a')
        R(p, 54, 18, 16, 26, '#2a1a10'); R(p, 55, 19, 14, 24, cor); R(p, 55, 19, 14, 3, cor_l)
        for y in range(25, 40, 4): R(p, 57, y, 10, 1, '#2a1a10')
        R(p, 52, 28, 3, 6, ACO_P)
        if tipo == 'auto': R(p, 59, 22, 6, 2, '#ffffff'); R(p, 61, 21, 2, 4, '#ffffff')
    for y, c, d in ((64, CANA, CANA_D), (68, CANA_L, '#7e9e36')):   # canas deitadas
        R(p, 2, y, 68, 4, CANA_O); R(p, 3, y + 1, 66, 2, c)
        for x in range(10, 66, 13): R(p, x, y + 1, 2, 2, d)
    return outline(im, INK)


def caixa_termica():
    im = new(42, 38); p = Pen(im)
    R(p, 0, 6, 42, 32, AZUL); R(p, 0, 0, 42, 8, AZUL_L); R(p, 0, 6, 42, 2, '#ffffff')
    R(p, 0, 34, 42, 4, AZUL_D); R(p, 16, 12, 10, 4, '#ffffff'); R(p, 3, 10, 2, 22, AZUL_D); R(p, 37, 10, 2, 22, AZUL_D)
    return outline(im, INK)


def mesa():
    """Mesa de feira vista de cima (90×22), toalha xadrez nas pontas."""
    im = new(90, 22); p = Pen(im)
    R(p, 0, 0, 90, 18, TABUA); R(p, 0, 0, 90, 2, TABUA_L); R(p, 0, 16, 90, 2, TABUA_D)
    for x in range(0, 90, 12): R(p, x, 2, 1, 14, TABUA_D)
    for x in range(30, 60, 4):
        for y in range(3, 15, 4): R(p, x + (2 if (y // 4) % 2 else 0), y, 2, 2, TOLDO)
    R(p, 8, 5, 8, 6, PAPEL); R(p, 72, 4, 4, 8, TOLDO); R(p, 77, 5, 4, 7, OURO)  # guardanapo, ketchup, mostarda
    R(p, 4, 18, 3, 4, TABUA_D); R(p, 83, 18, 3, 4, TABUA_D)
    return outline(im, INK)


def maquininha():
    im = new(12, 16); p = Pen(im)
    R(p, 0, 0, 12, 16, '#3e4554'); R(p, 2, 2, 8, 5, '#8fc3e0'); R(p, 2, 2, 8, 1, '#c6e2f2')
    for y in (9, 12):
        for x in (2, 5, 8): R(p, x, y, 2, 1, BORDA_L)
    return outline(im, INK)


def caixa_encomenda(pronta):
    im = new(26, 20); p = Pen(im)
    base, top = ('#c9a46a', '#e3c48a') if not pronta else ('#9bbf4a', '#c6e07a')
    R(p, 0, 4, 26, 16, base); R(p, 0, 4, 26, 2, top); R(p, 11, 4, 4, 16, TOLDO if not pronta else CANA_O)
    if pronta: R(p, 0, 0, 26, 5, top); R(p, 11, 0, 4, 5, CANA_O)
    else: R(p, 0, 0, 10, 4, top); R(p, 16, 0, 10, 4, top)
    R(p, 3, 12, 6, 4, PAPEL)
    return outline(im, INK)


def sacola_app(motoboy):
    im = new(20, 28); p = Pen(im)
    c, cl = ('#e0a23a', '#f6c766') if not motoboy else ('#6fa24a', '#9fd07a')
    R(p, 1, 8, 18, 20, c); R(p, 1, 8, 18, 2, cl); R(p, 5, 2, 2, 7, TXT); R(p, 13, 2, 2, 7, TXT); R(p, 5, 2, 10, 2, TXT)
    R(p, 6, 14, 8, 8, PAPEL); R(p, 8, 16, 4, 1, TXT); R(p, 8, 18, 4, 1, TXT)
    return outline(im, INK)


# ---------------------------------------------------------------- decoração
def decor(kind):
    if kind == 'rolo':
        im = new(32, 6); p = Pen(im)
        R(p, 0, 1, 4, 4, MAD); R(p, 28, 1, 4, 4, MAD); R(p, 4, 0, 24, 6, '#c98a4b'); R(p, 4, 0, 24, 1, '#e3ac6b'); R(p, 4, 5, 24, 1, MAD_K)
    elif kind == 'massa':
        im = new(36, 22); p = Pen(im)
        R(p, 0, 0, 36, 22, '#f3dda2'); R(p, 0, 0, 36, 2, '#fbebc4'); R(p, 0, 20, 36, 2, '#d9bd7c')
        for x in (4, 20): R(p, x + 2, 6, 10, 2, '#e2c482'); R(p, x, 8, 14, 6, '#e2c482')
    elif kind == 'potes':
        im = new(26, 34); p = Pen(im)
        for y, fill, dot in ((0, '#8b3a26', '#b4553a'), (18, '#f2d14c', '#f8e58a')):
            R(p, 0, y, 26, 14, '#e7e1d6'); R(p, 3, y + 2, 20, 9, fill); R(p, 5, y + 3, 3, 2, dot); R(p, 14, y + 6, 3, 2, dot)
    elif kind == 'saco_farinha':
        im = new(18, 16); p = Pen(im)
        R(p, 1, 2, 16, 14, '#ede3cc'); R(p, 3, 0, 12, 3, '#ede3cc'); R(p, 5, 6, 8, 5, TOLDO); R(p, 1, 14, 16, 2, '#d8cbb0')
    elif kind == 'caixote_cana':
        im = new(36, 36); p = Pen(im)
        for i, x in enumerate(range(5, 32, 6)): R(p, x, 0 + (i % 2) * 3, 3, 14, CANA if i % 2 else CANA_L)
        R(p, 0, 10, 36, 26, TABUA); R(p, 0, 18, 36, 2, TABUA_D); R(p, 0, 28, 36, 2, TABUA_D); R(p, 0, 10, 36, 1, TABUA_L)
    elif kind == 'caixote_limao':
        im = new(36, 30); p = Pen(im)
        for x in range(3, 32, 7): p.disc(x + 3, 6, 3, '#9bc53d'); p.put(x + 2, 4, '#d4ee8a')
        R(p, 0, 8, 36, 22, TABUA); R(p, 0, 17, 36, 2, TABUA_D); R(p, 0, 8, 36, 1, TABUA_L)
    elif kind == 'garrafa_cafe':
        im = new(10, 18); p = Pen(im)
        R(p, 1, 4, 8, 14, TOLDO); R(p, 2, 0, 6, 5, BORDA); R(p, 1, 4, 8, 2, TOLDO_L); R(p, 3, 10, 4, 3, CREME)
    elif kind == 'migalhas':
        im = new(16, 6); p = Pen(im)
        for x, y, c in ((1, 2, '#c27a22'), (5, 4, PAPEL), (8, 1, '#c27a22'), (12, 3, TOLDO), (14, 1, '#a8661c')): R(p, x, y, 2, 2, c)
        return im
    elif kind == 'assento':
        im = new(12, 6); p = Pen(im)
        R(p, 0, 0, 12, 4, TABUA); R(p, 0, 0, 12, 1, TABUA_L); R(p, 2, 4, 2, 2, TABUA_D); R(p, 8, 4, 2, 2, TABUA_D)
    else:
        raise ValueError(kind)
    return outline(im, INK)


# ---------------------------------------------------------------- itens
ESTADOS = {
    'cru': ('#f3dda2', '#e2c482', '#c9a765', '#fbebc4'),
    'ponto': ('#e8a33a', '#c27a22', '#a8661c', '#f6c766'),
    'passado': ('#b86a1e', '#8e4e16', '#6e3a10', '#cc8430'),
    'queimado': ('#4a2e1c', '#2a1a10', '#1a100a', '#5a3a24'),
}


def pastel(cat, estado):
    """Meia-lua com fecho de garfo; mesmos tamanhos de antes (salgado/doce 16×11, especial 20×13)."""
    big = cat == 'especial'
    w, h = (20, 13) if big else (16, 11)
    im = new(w, h); p = Pen(im); f, d, k, l = ESTADOS[estado]
    p.ell(0, 0, w - 1, h * 2 - 3, f)
    p.clear_rect(0, h - 1, w - 1, h * 2)
    R(p, 0, h - 4, w, 3, d)
    for x in range(1, w - 1, 3): R(p, x, h - 3, 1, 1, k)
    R(p, 4, 2, w - 9, 1, l); R(p, 3, 3, 3, 1, l)
    if cat == 'doce' and estado != 'queimado':
        for x, y in ((5, 4), (9, 3), (12, 5)): p.put(x, y, '#ffffff'); p.put(x, y + 1, '#ff9cb0')
    if big and estado != 'queimado':
        p.put(8, 4, '#2d6a2d'); p.put(9, 4, '#2d6a2d'); R(p, 12, 4, 3, 2, OURO)
    if estado == 'queimado':
        for x, y in ((4, 3), (10, 5), (13, 3)): p.put(x, y, '#6b6b73')
    return outline(im, INK)


def copo():
    im = new(10, 14); p = Pen(im)
    p.poly([(1, 1), (8, 1), (7, 13), (2, 13)], '#e6f2ee'); p.poly([(2, 4), (7, 4), (7, 12), (3, 12)], '#c9d86a')
    R(p, 2, 4, 6, 1, '#f2f0c8'); R(p, 6, 0, 1, 4, TOLDO)
    return outline(im, INK)


def moeda():
    im = new(9, 9); p = Pen(im)
    p.disc(4, 4, 4, OURO_D); p.disc(4, 4, 3, OURO); R(p, 2, 2, 3, 1, OURO_L); R(p, 4, 3, 1, 3, OURO_D)
    return outline(im, INK)


# ingredientes 12×12: forma + cores (preenchimento, detalhe)
INGREDIENTES = {
    'massa': ('disco', '#f3dda2', '#d9bd7c'), 'carne': ('tigela', '#8b3a26', '#b4553a'),
    'mucarela': ('bloco', '#f2d14c', '#f8e58a'), 'queijo-minas': ('bloco', '#f4f0e2', '#d9d2c0'),
    'queijo-coalho': ('espeto', '#e8b85a', '#c98a3c'), 'frango': ('tigela', '#e8d8a8', '#c9b07a'),
    'calabresa': ('rodelas', '#c0502f', '#e88a6a'), 'cebola': ('anel', '#c89ad0', '#f4e6f6'),
    'presunto': ('fatia', '#e89a9a', '#f6c6c6'), 'tomate': ('bola', '#d9402f', '#3e8e3a'),
    'oregano': ('pote', '#5f8f3a', '#9bbf4a'), 'ovo': ('ovo', '#fbf6e8', '#f2c14e'),
    'azeitona': ('bolinhas', '#5a7a2a', '#8aa84a'), 'catupiry': ('pote', '#f4f0e2', '#8fb3e0'),
    'cream-cheese': ('pote', '#fbf6e8', '#d9d2c0'), 'palmito': ('rodelas', '#f3e9c8', '#d9c99a'),
    'carne-seca': ('tigela', '#5a2a1a', '#8a4a2a'), 'camarao': ('camarao', '#f08a6a', '#f6b89a'),
    'bacalhau': ('tigela', '#efe6d2', '#c9bfa6'), 'banana': ('banana', '#f2d14c', '#a8861c'),
    'acucar-canela': ('pote', '#f4f0e2', '#a0612e'), 'doce-de-leite': ('pote', '#c27a22', '#e8a33a'),
    'pacoca': ('bloco', '#c99a5a', '#e3c08a'), 'goiabada': ('bloco', '#a8321e', '#d9503f'),
    'chocolate-leite': ('barra', '#6b3a1e', '#8e5228'), 'chocolate-branco': ('barra', '#f3e9c8', '#d9c99a'),
    'creme-avela': ('pote', '#6b3a1e', '#a0612e'), 'cana': ('vareta', CANA, CANA_D),
    'limao': ('bola', '#9bc53d', '#d4ee8a'), 'abacaxi': ('abacaxi', '#f2c14e', '#3e8e3a'),
}


def ingrediente(kind, c, d):
    im = new(12, 12); p = Pen(im)
    if kind == 'tigela':
        R(p, 0, 4, 12, 7, '#e7e1d6'); R(p, 1, 3, 10, 4, c); p.put(3, 4, d); p.put(7, 5, d); p.put(9, 3, d)
    elif kind == 'bloco':
        R(p, 1, 3, 10, 7, c); R(p, 1, 3, 10, 2, d); p.put(4, 7, d); p.put(7, 6, d)
    elif kind == 'espeto':
        R(p, 5, 0, 1, 12, MAD); R(p, 2, 2, 7, 7, c); R(p, 2, 2, 7, 1, d)
    elif kind == 'rodelas':
        p.disc(3, 7, 3, c); p.disc(8, 5, 3, c); p.put(3, 7, d); p.put(8, 5, d)
    elif kind == 'anel':
        p.disc(6, 6, 5, c); p.disc(6, 6, 3, d); p.disc(6, 6, 1, c)
    elif kind == 'fatia':
        p.disc(6, 6, 5, c); p.disc(5, 5, 2, d)
    elif kind == 'bola':
        p.disc(6, 7, 4, c); R(p, 5, 1, 2, 3, d); R(p, 4, 5, 2, 1, '#ffffff')
    elif kind == 'pote':
        R(p, 2, 3, 8, 9, c); R(p, 2, 1, 8, 3, BORDA); R(p, 3, 6, 6, 3, d)
    elif kind == 'ovo':
        p.ell(1, 2, 10, 11, c); p.disc(6, 7, 2, d)
    elif kind == 'bolinhas':
        for x, y in ((3, 4), (8, 4), (5, 8)): p.disc(x, y, 2, c); p.put(x - 1, y - 1, d)
    elif kind == 'camarao':
        p.disc(6, 6, 5, c); p.disc(7, 5, 3, (0, 0, 0, 0)); R(p, 7, 2, 5, 7, (0, 0, 0, 0)); R(p, 7, 9, 4, 2, c)
        R(p, 9, 9, 3, 3, d); p.put(3, 4, INK); R(p, 2, 6, 1, 3, d)
    elif kind == 'banana':
        p.poly([(1, 3), (4, 9), (10, 10), (11, 8), (6, 7), (3, 2)], c); p.put(11, 9, d); p.put(1, 2, d)
    elif kind == 'barra':
        R(p, 1, 3, 10, 7, c); [R(p, x, 4, 1, 5, d) for x in (4, 7)]; R(p, 1, 6, 10, 1, d)
    elif kind == 'vareta':
        R(p, 4, 0, 4, 12, c); R(p, 4, 4, 4, 1, d); R(p, 4, 9, 4, 1, d); R(p, 5, 0, 1, 12, CANA_L)
    elif kind == 'disco':
        p.ell(0, 3, 11, 10, c); R(p, 3, 4, 5, 1, '#fbebc4'); R(p, 1, 8, 10, 1, d)
    elif kind == 'abacaxi':
        p.ell(2, 4, 9, 11, c); p.poly([(3, 0), (6, 4), (9, 0), (8, 4), (4, 4)], d); p.put(4, 7, OURO_D); p.put(7, 9, OURO_D)
    return outline(im, INK)


# ---------------------------------------------------------------- ícones dos controles (24×24)
def icone_ctrl(kind):
    im = new(24, 24); p = Pen(im)
    if kind == 'anotar':
        R(p, 3, 2, 14, 20, PAPEL); R(p, 5, 0, 2, 4, ACO_P); R(p, 9, 0, 2, 4, ACO_P); R(p, 13, 0, 2, 4, ACO_P)
        for y in (8, 12, 16): R(p, 5, y, 9, 1, ACO_D)
        for i in range(4): R(p, 19 - i * 2, 9 + i * 3, 3, 3, LARANJA)
        R(p, 19, 7, 3, 3, '#e78a8a'); R(p, 12, 20, 2, 2, INK)
    elif kind in ('cobrar', 'pagar'):
        for y in (16, 11, 6): R(p, 1, y, 14, 4, OURO); R(p, 1, y + 4, 14, 1, OURO_D); R(p, 2, y, 6, 1, OURO_L)
        p.disc(18, 12, 5, OURO_D); p.disc(18, 12, 4, OURO); R(p, 18, 9, 1, 7, OURO_D)
        if kind == 'pagar': R(p, 14, 18, 9, 5, PAPEL); R(p, 15, 20, 7, 1, TXT)
    elif kind == 'vassoura':
        for i in range(6): R(p, 19 - i * 3, 1 + i * 3, 3, 3, MAD)
        R(p, 2, 13, 11, 3, TOLDO); R(p, 0, 16, 14, 7, '#e3b04b')
        for x in range(1, 14, 3): R(p, x, 17, 1, 6, '#b8862e')
    elif kind == 'fechar':
        R(p, 2, 8, 20, 12, '#f3dda2'); p.ell(2, 2, 21, 20, '#f3dda2'); p.clear_rect(0, 14, 23, 23)
        R(p, 2, 11, 20, 4, '#e2c482'); [p.put(x, 12, '#c9a765') for x in range(3, 22, 3)]
        R(p, 8, 16, 8, 2, VERDE); R(p, 6, 14, 2, 2, VERDE); R(p, 16, 18, 2, 2, VERDE); R(p, 18, 16, 2, 2, VERDE)
    elif kind == 'limpar':
        R(p, 4, 6, 16, 14, '#8fc3e0'); R(p, 4, 6, 16, 3, '#c6e2f2'); R(p, 6, 12, 3, 3, '#ffffff'); R(p, 14, 10, 3, 3, '#ffffff')
        R(p, 9, 1, 2, 2, '#ffffff'); R(p, 17, 2, 2, 2, '#ffffff')
    elif kind == 'mais':
        R(p, 4, 4, 16, 16, OURO); R(p, 11, 7, 2, 10, TXT); R(p, 7, 11, 10, 2, TXT)
    elif kind == 'cesto':
        R(p, 3, 8, 18, 14, ACO_O); R(p, 4, 9, 16, 12, ACO_D)
        for x in range(4, 20, 4): R(p, x, 9, 1, 12, ACO_L)
        for y in range(9, 21, 4): R(p, 4, y, 16, 1, ACO_L)
        R(p, 10, 0, 3, 9, ACO_P)
    elif kind == 'oleo':
        p.poly([(12, 1), (5, 13), (12, 22), (19, 13)], OLEO); p.disc(12, 15, 7, OLEO); R(p, 9, 12, 2, 4, OLEO_L)
    elif kind in ('caixa', 'encomenda'):
        R(p, 1, 7, 22, 15, '#c9a46a'); R(p, 1, 7, 22, 3, '#e3c48a'); R(p, 10, 7, 4, 15, TOLDO); R(p, 1, 3, 9, 5, '#e3c48a'); R(p, 14, 3, 9, 5, '#e3c48a')
    elif kind == 'gestao':
        R(p, 2, 2, 20, 20, PAPEL); R(p, 5, 15, 3, 5, AZUL); R(p, 10, 11, 3, 9, VERDE); R(p, 15, 6, 3, 14, LARANJA)
    elif kind == 'cargos':
        p.disc(8, 7, 4, '#d9973f'); R(p, 3, 12, 11, 9, AZUL); p.disc(16, 9, 4, '#8a5a33'); R(p, 11, 14, 11, 8, TOLDO)
    elif kind == 'comandas':
        R(p, 4, 1, 16, 22, PAPEL); [R(p, 7, y, 10, 1, TXT_2) for y in (5, 9, 13)]; R(p, 7, 17, 6, 2, TOLDO)
    elif kind == 'embalagem':
        R(p, 3, 8, 18, 15, '#e0a23a'); R(p, 3, 8, 18, 3, '#f6c766'); R(p, 7, 2, 2, 7, TXT); R(p, 15, 2, 2, 7, TXT); R(p, 7, 2, 10, 2, TXT)
    elif kind == 'estufa':
        R(p, 1, 3, 22, 18, ACO_O); R(p, 2, 4, 20, 2, '#ff9a3a'); R(p, 2, 6, 20, 14, VIDRO); R(p, 4, 10, 7, 4, '#e8a33a'); R(p, 13, 10, 7, 4, '#e8a33a'); R(p, 2, 14, 20, 1, BORDA)
    elif kind == 'copos':
        for x in (2, 13):
            p.poly([(x, 4), (x + 8, 4), (x + 7, 21), (x + 1, 21)], '#e6f2ee'); R(p, x + 2, 6, 5, 1, '#c6d8d2')
    elif kind.startswith('caldo'):
        extra = kind.split('_')[1]
        p.poly([(5, 3), (18, 3), (16, 22), (7, 22)], '#e6f2ee'); p.poly([(6, 8), (17, 8), (16, 21), (7, 21)], '#c9d86a')
        R(p, 6, 8, 11, 2, '#f2f0c8'); R(p, 14, 0, 2, 8, TOLDO)
        if extra == 'limao': p.disc(19, 5, 4, '#9bc53d'); p.disc(19, 5, 2, '#d4ee8a')
        if extra == 'abacaxi': R(p, 16, 2, 7, 6, OURO); R(p, 18, 0, 3, 3, '#3e8e3a')
    else:
        raise ValueError(kind)
    return outline(im, INK)


CTRL = ['anotar', 'cobrar', 'pagar', 'caixa', 'vassoura', 'fechar', 'limpar', 'mais', 'cesto', 'oleo', 'gestao', 'cargos',
        'encomenda', 'comandas', 'embalagem', 'estufa', 'copos', 'caldo_puro', 'caldo_limao', 'caldo_abacaxi']


# ---------------------------------------------------------------- interface (9-slice e faixas)
def moldura():
    """Moldura do painel e das telas: 24×24, cantos de 8 (madeira 6 px + pergaminho)."""
    im = new(24, 24); p = Pen(im)
    R(p, 0, 0, 24, 24, MOLD_O); R(p, 1, 1, 22, 22, MOLD); R(p, 1, 1, 22, 1, MOLD_L); R(p, 1, 1, 1, 22, MOLD_L)
    R(p, 1, 22, 22, 1, MOLD_D); R(p, 22, 1, 1, 22, MOLD_D)
    R(p, 6, 6, 12, 12, MOLD_O); R(p, 7, 7, 10, 10, PERG); R(p, 7, 7, 10, 1, PERG_D)
    for x, y in ((3, 3), (20, 3), (3, 20), (20, 20)): p.put(x, y, MOLD_D)        # pregos
    return im


def aba():
    """Aba do título do painel / placa: 12×12, cantos de 4."""
    im = new(12, 12); p = Pen(im)
    R(p, 0, 0, 12, 12, MOLD_O); R(p, 1, 1, 10, 10, MOLD_L); R(p, 1, 1, 10, 1, '#f8d08a'); R(p, 1, 10, 10, 1, '#b8742e')
    return im


def slot(kind):
    """Célula do painel 12×12, cantos de 4: normal, selecionado (aro vermelho) e desligado."""
    im = new(12, 12); p = Pen(im)
    if kind == 'normal':
        R(p, 0, 0, 12, 12, MOLD_O); R(p, 1, 1, 10, 10, SLOT); R(p, 1, 1, 10, 1, SLOT_L); R(p, 1, 10, 10, 1, SLOT_D)
    elif kind == 'selecionado':
        R(p, 0, 0, 12, 12, TOLDO); R(p, 1, 1, 10, 10, MOLD_O); R(p, 2, 2, 8, 8, '#ffe3a8'); R(p, 2, 2, 8, 1, '#fff2cf')
    else:
        R(p, 0, 0, 12, 12, '#8a6a4a'); R(p, 1, 1, 10, 10, '#e3cda6'); R(p, 1, 10, 10, 1, '#cbb38a')
    return im


def balao():
    im = new(9, 9); p = Pen(im)
    R(p, 1, 0, 7, 9, INK); R(p, 0, 1, 9, 7, INK); R(p, 1, 1, 7, 7, PAPEL)
    return im


def balao_rabo():
    im = new(6, 4); p = Pen(im)
    R(p, 0, 0, 6, 1, PAPEL); R(p, 0, 0, 1, 1, INK); R(p, 5, 0, 1, 1, INK)
    R(p, 1, 1, 4, 1, INK); R(p, 2, 1, 2, 1, PAPEL); R(p, 2, 2, 2, 2, INK)
    return im


def faixa(kind):
    """Faixa de avisos (ALERT_BAND, 640×22): placa de madeira pintada pendurada no toldo."""
    base, hi, lo = {'alerta': (TOLDO, TOLDO_L, TOLDO_D), 'evento': ('#9a6a10', '#c08a20', '#6e4a08'), 'oferta': ('#2f7a46', '#4a9a60', '#1f5a32')}[kind]
    im = new(640, 22); p = Pen(im)
    R(p, 0, 0, 640, 22, INK); R(p, 1, 1, 638, 20, base); R(p, 1, 1, 638, 2, hi); R(p, 1, 19, 638, 2, lo)
    for x in range(0, 640, 64): R(p, x + 30, 3, 1, 16, lo)
    for x in (4, 631): R(p, x, 8, 5, 5, MOLD_O); R(p, x + 1, 9, 3, 3, BORDA_L)
    return im


def placa(part):
    """Placa de nome da zona: 3-slice 3 + 8 + 3, 15 de altura (texto k=2 em y+3)."""
    w = {'esq': 3, 'meio': 8, 'dir': 3}[part]
    im = new(w, 15); p = Pen(im)
    R(p, 0, 0, w, 15, MOLD_O)
    x0 = 1 if part == 'esq' else 0
    x1 = w - 1 if part == 'dir' else w
    R(p, x0, 1, x1 - x0, 13, MOLD_L); R(p, x0, 1, x1 - x0, 1, '#f8d08a'); R(p, x0, 13, x1 - x0, 1, '#b8742e')
    return im


def placa_xepa():
    im = new(120, 24); p = Pen(im)
    R(p, 0, 0, 120, 24, INK); R(p, 1, 1, 118, 22, PAPEL); R(p, 3, 3, 114, 18, TOLDO); R(p, 3, 3, 114, 2, TOLDO_L)
    return im


# ---------------------------------------------------------------- HUD (DOM, 16×16; ampliado por CSS)
def hud(kind):
    im = new(16, 16); p = Pen(im)
    if kind == 'verao':
        p.disc(8, 8, 4, OURO); R(p, 6, 6, 2, 2, OURO_L)
        for x, y in ((7, 0), (7, 14), (0, 7), (14, 7), (2, 2), (12, 2), (2, 12), (12, 12)): R(p, x, y, 2, 2, OURO)
    elif kind == 'outono':
        p.poly([(8, 1), (14, 7), (8, 14), (2, 7)], '#d9733a'); R(p, 7, 4, 1, 11, '#8e4e16'); R(p, 7, 13, 1, 3, MAD)
    elif kind == 'inverno':
        p.ell(1, 5, 9, 12, '#c9d6e0'); p.ell(5, 3, 14, 11, '#dfe8ee'); R(p, 2, 9, 12, 3, '#dfe8ee')
        for x in (4, 8, 12): R(p, x, 13, 1, 2, '#8fb3e0')
    elif kind == 'primavera':
        for dx, dy in ((0, -3), (3, 0), (0, 3), (-3, 0)): p.disc(8 + dx, 7 + dy, 2, '#e58bb7')
        p.disc(8, 7, 1, OURO); R(p, 7, 11, 2, 5, '#3e8e3a')
    elif kind == 'moeda':
        p.disc(8, 8, 6, OURO_D); p.disc(8, 8, 5, OURO); R(p, 5, 4, 4, 1, OURO_L); R(p, 8, 5, 1, 7, OURO_D)
    elif kind == 'fila':
        R(p, 1, 2, 3, 7, '#6e3f1c'); R(p, 12, 2, 3, 7, '#6e3f1c'); R(p, 3, 1, 10, 12, '#a0612e')
        R(p, 5, 9, 6, 4, '#f4e6cc'); R(p, 7, 9, 2, 2, INK); R(p, 5, 5, 2, 2, INK); R(p, 9, 5, 2, 2, INK)
    elif kind in ('estrela', 'estrela_vazia'):
        c = OURO if kind == 'estrela' else '#d9c49a'
        p.poly([(8, 0), (10, 6), (16, 6), (11, 10), (13, 16), (8, 12), (3, 16), (5, 10), (0, 6), (6, 6)], c)
        if kind == 'estrela': R(p, 7, 4, 2, 3, OURO_L)
    elif kind in ('som', 'som_off'):
        R(p, 1, 6, 3, 4, TXT); p.poly([(4, 6), (8, 2), (8, 13), (4, 9)], TXT)
        if kind == 'som': R(p, 10, 5, 1, 6, TXT); R(p, 12, 3, 1, 10, TXT)
        else:
            for i in range(5): p.put(10 + i, 5 + i, TOLDO); p.put(14 - i, 5 + i, TOLDO); p.put(11 + i, 5 + i, TOLDO); p.put(15 - i, 5 + i, TOLDO)
    elif kind in ('musica', 'musica_off'):
        R(p, 5, 2, 9, 2, TXT); R(p, 5, 2, 2, 10, TXT); R(p, 12, 2, 2, 9, TXT); p.disc(4, 12, 2, TXT); p.disc(11, 11, 2, TXT)
        if kind == 'musica_off':
            for i in range(14): p.put(1 + i, 1 + i, TOLDO); p.put(2 + i, 1 + i, TOLDO)
    elif kind == 'rapido':
        p.poly([(1, 3), (7, 8), (1, 13)], TXT); p.poly([(8, 3), (14, 8), (8, 13)], TXT)
    elif kind == 'pausa':
        R(p, 3, 2, 4, 12, TXT); R(p, 9, 2, 4, 12, TXT)
    elif kind == 'play':
        p.poly([(4, 2), (13, 8), (4, 14)], TXT)
    return outline(im, INK) if kind not in ('som', 'som_off', 'musica', 'musica_off', 'rapido', 'pausa', 'play') else im


HUD = ['verao', 'outono', 'inverno', 'primavera', 'moeda', 'fila', 'estrela', 'estrela_vazia', 'som', 'som_off',
       'musica', 'musica_off', 'rapido', 'pausa', 'play']


# ---------------------------------------------------------------- ícones de evento e de perfil (14×14 / 12×6)
def icone(kind):
    im = new(14, 14); p = Pen(im)
    if kind == 'fiscal': p.rect(2, 1, 11, 12, PAPEL); p.rect(4, 3, 9, 3, AZUL); p.rect(4, 6, 9, 6, ACO_D); p.rect(4, 9, 7, 9, ACO_D); p.disc(10, 10, 2, VERMELHO)
    elif kind == 'energia': p.poly([(8, 0), (2, 8), (6, 8), (4, 13), (11, 5), (7, 5)], OURO)
    elif kind == 'excursao': p.rect(1, 3, 12, 9, OURO); p.rect(2, 4, 11, 5, AZUL); p.disc(4, 10, 2, INK); p.disc(10, 10, 2, INK)
    elif kind == 'fogo': p.poly([(7, 0), (3, 6), (4, 12), (10, 12), (11, 6), (8, 4)], FOGO); p.poly([(7, 5), (5, 10), (6, 12), (9, 12), (9, 9)], FOGO_L)
    elif kind == 'queimado': p.disc(7, 5, 3, TAMPO_K); p.rect(3, 9, 11, 12, VERMELHO); p.put(6, 4, INK); p.put(9, 4, INK)
    elif kind == 'chuva': p.rect(2, 2, 11, 6, ACO_D); [p.rect(3 + i * 3, 8, 3 + i * 3, 11, AZUL_L) for i in range(4)]
    elif kind == 'calor': p.disc(7, 7, 4, OURO); [p.put(7 + dx, 7 + dy, FOGO) for dx, dy in ((0, -6), (0, 6), (-6, 0), (6, 0))]
    return outline(im, INK)


def perfil(kind):
    c = {'economico': VERDE, 'padrao': AZUL, 'exigente': VERMELHO}[kind]
    im = new(12, 6); p = Pen(im); p.rect(0, 0, 11, 5, c); p.rect(0, 4, 11, 5, INK)
    return im


# ---------------------------------------------------------------- capa 320×200
def capa():
    im = new(320, 200)
    tile_fill(im, tile_mosaico(), 0, 0, 320, 200)
    p = Pen(im)
    tile_fill(im, tile_madeira(), 0, 120, 320, 200)
    R(p, 0, 118, 320, 2, TABUA_D)
    for x in range(0, 320, 32):
        R(p, x, 0, 16, 40, TOLDO); R(p, x + 16, 0, 16, 40, CREME); R(p, x, 3, 16, 3, TOLDO_L); R(p, x + 16, 3, 16, 3, CREME_L)
    shade(im, 0, 32, 320, 40, 0.86)
    for x in range(0, 320, 32):
        for dx, c in ((0, '#b53a24'), (16, '#e6d2a6')):
            R(p, x + dx + 2, 40, 12, 5, c); R(p, x + dx + 4, 45, 8, 3, c); R(p, x + dx + 4, 48, 8, 1, INK)
    cores = ('#e0a23a', AZUL, TOLDO, '#6fa24a')
    R(p, 0, 52, 320, 1, '#5a3a22')
    for i, x in enumerate(range(4, 316, 20)):
        for dy, (dx, w) in enumerate(((0, 12), (0, 12), (1, 10), (1, 10), (2, 8), (3, 6), (4, 4), (5, 2))):
            R(p, x + dx, 53 + dy, w, 1, cores[i % 4])
    # balcão
    b = balcao()
    for x in range(0, 320, 16):
        im.alpha_composite(b.crop((8, 0, 24, 72)), (x, 128))
    im.alpha_composite(fogao().resize((64, 96), Image.NEAREST).crop((0, 0, 64, 70)), (120, 84))
    t = tacho()
    tw = new(80, 58); tw.alpha_composite(t.crop((0, 0, 10, 58)), (0, 0))
    for x in range(10, 70, 16): tw.alpha_composite(t.crop((10, 0, 26, 58)).crop((0, 0, min(16, 70 - x), 58)), (x, 0))
    tw.alpha_composite(t.crop((26, 0, 36, 58)), (70, 0))
    im.alpha_composite(tw, (112, 76))
    im.alpha_composite(pastel('especial', 'ponto').resize((60, 39), Image.NEAREST), (36, 104))
    im.alpha_composite(pastel('salgado', 'ponto').resize((48, 33), Image.NEAREST), (226, 112))
    im.alpha_composite(copo().resize((30, 42), Image.NEAREST), (276, 96))
    im.alpha_composite(pastel('salgado', 'cru').resize((32, 22), Image.NEAREST), (138, 94))
    return im


# ---------------------------------------------------------------- prévias
GL = {
    '0': '###|#.#|#.#|#.#|###', '1': '.#.|##.|.#.|.#.|###', '2': '###|..#|###|#..|###', '3': '###|..#|.##|..#|###',
    '4': '#.#|#.#|###|..#|..#', '5': '###|#..|###|..#|###', '6': '###|#..|###|#.#|###', '7': '###|..#|..#|.#.|.#.',
    '8': '###|#.#|###|#.#|###', '9': '###|#.#|###|..#|###', '-': '...|...|###|...|...', '%': '#.#|..#|.#.|#..|#.#',
    ' ': '...|...|...|...|...', '?': '###|..#|.##|...|.#.', '$': '.##|##.|.#.|.##|##.', ':': '...|.#.|...|.#.|...',
    'A': '.#.|#.#|###|#.#|#.#', 'B': '##.|#.#|##.|#.#|##.', 'C': '###|#..|#..|#..|###', 'D': '##.|#.#|#.#|#.#|##.',
    'E': '###|#..|##.|#..|###', 'F': '###|#..|##.|#..|#..', 'G': '###|#..|#.#|#.#|###', 'H': '#.#|#.#|###|#.#|#.#',
    'I': '###|.#.|.#.|.#.|###', 'L': '#..|#..|#..|#..|###', 'M': '#.#|###|###|#.#|#.#', 'N': '##.|#.#|#.#|#.#|#.#',
    'O': '###|#.#|#.#|#.#|###', 'P': '###|#.#|###|#..|#..', 'R': '##.|#.#|##.|#.#|#.#', 'S': '###|#..|###|..#|###',
    'T': '###|.#.|.#.|.#.|.#.', 'Q': '###|#.#|#.#|###|..#', 'Z': '###|..#|.#.|#..|###', 'K': '#.#|#.#|##.|#.#|#.#',
    'W': '#.#|#.#|###|###|#.#', 'X': '#.#|#.#|.#.|#.#|#.#', 'Y': '#.#|#.#|.#.|.#.|.#.', '!': '.#.|.#.|.#.|...|.#.', '/': '..#|..#|.#.|#..|#..', 'U': '#.#|#.#|#.#|#.#|###', 'V': '#.#|#.#|#.#|#.#|.#.', 'J': '..#|..#|..#|#.#|###',
}


def texto(im, s, x, y, c, k=1):
    p = Pen(im)
    for i, ch in enumerate(s):
        for r, row in enumerate(GL.get(ch, GL[' ']).split('|')):
            for cc, v in enumerate(row):
                if v == '#': R(p, x + (i * 4 + cc) * k, y + r * k, k, k, c)


def tw(s, k=1): return (len(s) * 4 - 1) * k


def tres(name, w):
    """Monta uma peça 3-slice salva em SAIDA na largura `w`."""
    l, m, r = SAIDA[f'{name}_esq'], SAIDA[f'{name}_meio'], SAIDA[f'{name}_dir']
    h = m.height; out = new(w, h)
    out.alpha_composite(l, (0, 0))
    x = l.width
    while x < w - r.width:
        cw = min(m.width, w - r.width - x); out.alpha_composite(m.crop((0, 0, cw, h)), (x, 0)); x += cw
    out.alpha_composite(r, (w - r.width, 0))
    return out


def recolor(img, hexcor):
    base = hexc(hexcor)[:3]
    dark = tuple(round(v * 0.7) for v in base); light = tuple(min(255, round(v * 1.25) + 30) for v in base)
    im = img.convert('RGBA'); px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if not a: continue
            if (r, g, b) == (255, 0, 255): px[x, y] = base + (a,)
            elif (r, g, b) == (176, 0, 176): px[x, y] = dark + (a,)
            elif (r, g, b) == (255, 156, 255): px[x, y] = light + (a,)
    return im


def placa_em(im, label, x, y):
    w = tw(label, 2) + 8
    im.alpha_composite(tres_placa(w), (x, y))
    texto(im, label, x + 4, y + 3, TXT, 2)


def tres_placa(w):
    l, m, r = SAIDA['ui/placa_esq'], SAIDA['ui/placa_meio'], SAIDA['ui/placa_dir']
    out = new(w, 15); out.alpha_composite(l, (0, 0)); x = 3
    while x < w - 3: cw = min(8, w - 3 - x); out.alpha_composite(m.crop((0, 0, cw, 15)), (x, 0)); x += cw
    out.alpha_composite(r, (w - 3, 0)); return out


def barra(im, x, y, w, h, frac, c):
    p = Pen(im); R(p, x, y, w, h, INK); R(p, x + 1, y + 1, w - 2, h - 2, '#5a4430'); R(p, x + 1, y + 1, max(0, round((w - 2) * frac)), h - 2, c)


def previa_dia(caes_dir):
    """Dia de feira com a barraca inicial (balcão, bancada, tacho 1, moenda) e o painel do balcão aberto."""
    im = SAIDA['cenario/fundo'].copy(); p = Pen(im)
    # balcão (306,30 326×118)
    bx, by, bw = 306, 30, 326
    im.alpha_composite(tres('moveis/balcao', bw - 8), (bx + 4, by + 20))
    for i, (cat, est) in enumerate((('salgado', 'ponto'), ('salgado', 'ponto'), ('doce', 'ponto'))):
        x = bx + 8 + i * 28; im.alpha_composite(SAIDA[f'itens/pastel_{cat}_{est}'].resize((22, 14), Image.NEAREST), (x, by + 26))
        barra(im, x, by + 43, 22, 4, [0.8, 0.5, 0.9][i], VERDE)
    for i in range(2): im.alpha_composite(SAIDA['itens/copo'], (bx + 150 + i * 12, by + 28))
    for i in range(3): im.alpha_composite(SAIDA['itens/moeda'], (bx + bw - 22 - i * 12, by + 52))
    im.alpha_composite(SAIDA['equip/maquininha'], (bx + bw - 34, by + 26))
    placa_em(im, 'BALCAO', bx + 4, by + 4)
    # fileira do meio: 3 estações de 132
    zs = {'bancada': 8, 'tacho1': 146, 'moenda': 284}
    zy, zh, zw = 158, 134, 132
    x = zs['bancada']
    im.alpha_composite(tres('moveis/bancada', zw - 8), (x + 4, zy + 20))
    im.alpha_composite(SAIDA['decor/massa'], (x + 10, zy + 30)); im.alpha_composite(SAIDA['decor/potes'], (x + zw - 34, zy + 26))
    im.alpha_composite(SAIDA['decor/rolo'], (x + 10, zy + 58))
    im.alpha_composite(SAIDA['decor/saco_farinha'], (x + 30, zy + 86)); im.alpha_composite(SAIDA['decor/saco_farinha'], (x + 52, zy + 88))
    for i, ing in enumerate(('carne', 'mucarela')): im.alpha_composite(SAIDA[f'itens/ing_{ing}'], (x + 54 + i * 14, zy + 30))
    placa_em(im, 'BANCADA', x + 4, zy + 4)
    x = zs['tacho1']
    im.alpha_composite(tres('moveis/fogao', zw - 8), (x + 4, zy + 18))
    im.alpha_composite(tres3('equip/tacho', zw - 8), (x + 4, zy + 22))
    for i in range(2):
        bxx = x + 14 + i * 56; byy = zy + 30
        R(p, bxx, byy, 44, 40, ACO_O); grade(im, bxx + 1, byy + 1, 42, 38)
        im.alpha_composite(SAIDA['equip/cesto_alca'], (bxx + 19, byy - 8))
        if i == 0:
            im.alpha_composite(SAIDA['itens/pastel_salgado_cru'].resize((32, 22), Image.NEAREST), (bxx + 6, byy + 9))
            barra(im, bxx, byy + 44, 44, 6, 0.55, AZUL)
    barra(im, x + 8, zy + zh - 22, zw - 16, 6, 0.4, OLEO)
    placa_em(im, 'TACHO 1', x + 4, zy + 4)
    x = zs['moenda']
    im.alpha_composite(SAIDA['equip/moenda_manual'], (x + (zw - 72) // 2, zy + 22))
    barra(im, x + 8, zy + zh - 22, zw - 16, 6, 0.1, CANA)
    placa_em(im, 'MOENDA', x + 4, zy + 4)
    # espaço livre: caixotes
    im.alpha_composite(SAIDA['decor/caixote_cana'], (594, 250)); im.alpha_composite(SAIDA['decor/caixote_limao'], (552, 262))
    # fila: sujeira e plaquinha
    placa_em(im, 'FILA', 12, 34)
    barra(im, 14, 140, 90, 5, 0.12, '#a88a4a'); texto(im, 'SUJEIRA', 108, 140, TXT_2)
    im.alpha_composite(SAIDA['decor/migalhas'], (150, 132))
    # balões (antes dos cães, desenhados na mesma passada 1×)
    spots = [(270 - i * 46, 134) for i in range(5)]
    for i, (sx, sy) in enumerate(spots):
        anot = i == 0
        w = 36 if anot else 20
        bx0 = sx - w // 2; byy = sy - 38 - 22
        im.alpha_composite(nine(SAIDA['ui/balao'], 3, w, 20), (bx0, byy))
        im.alpha_composite(SAIDA['ui/balao_rabo'], (sx - 3, byy + 19))
        if anot:
            im.alpha_composite(SAIDA['itens/ing_carne'].crop((0, 0, 12, 12)), (bx0 + 4, byy + 4))
            im.alpha_composite(SAIDA['itens/copo'].resize((8, 11), Image.NEAREST), (bx0 + 22, byy + 4))
        else:
            texto(im, '?', sx - 3, byy + 5, TXT, 2)
        barra(im, bx0, byy - 6, w, 4, [0.25, 0.5, 0.7, 0.9, 0.95][i], VERMELHO if i == 0 else VERDE)
    # painel do balcão
    P = (0, 300, 640, 180)
    im.alpha_composite(nine(SAIDA['ui/moldura'], 8, 640, 180), (0, 300))
    ab = nine(SAIDA['ui/aba'], 4, tw('BALCAO', 2) + 16, 18); im.alpha_composite(ab, (10, 292)); texto(im, 'BALCAO', 18, 296, TXT, 2)
    barra(im, 640 - 74, 308, 64, 8, 0.7, PERG_D)
    ctrls = [('ANOTAR', '5', AZUL, 'icones/ctrl_anotar', None, 'normal'), ('COBRAR', 'R$12', OURO, 'icones/ctrl_cobrar', None, 'normal'),
             ('VASSOURA', '11%', ACO_P, 'icones/ctrl_vassoura', 0.0, 'normal'), ('CARNE', '65', '#b4412b', 'itens/pastel_salgado_ponto', None, 'selecionado'),
             ('QUEIJO', '82', OURO, 'itens/pastel_salgado_ponto', None, 'normal'), ('CALDO', 'PURO', CANA, 'icones/ctrl_caldo_puro', None, 'normal')]
    for i, (lab, sub, fill, icon, bar_, kind) in enumerate(ctrls):
        cx, cy = 8 + i * 78, 326
        im.alpha_composite(nine(SAIDA[f'ui/slot_{kind}'], 4, 72, 72), (cx, cy))
        R(p, cx + 4, cy + 4, 64, 3, fill)
        ic = SAIDA[icon]
        if ic.width < 20: ic = ic.resize((ic.width * 2, ic.height * 2), Image.NEAREST)
        im.alpha_composite(ic, (cx + 36 - ic.width // 2, cy + 22 - ic.height // 2))
        texto(im, lab, cx + 36 - tw(lab, 2) // 2, cy + 38, TXT, 2)
        texto(im, sub, cx + 36 - tw(sub, 2) // 2, cy + 51, TXT_2, 2)
        if bar_ is not None: barra(im, cx + 6, cy + 63, 60, 6, bar_, AZUL)
    texto(im, 'TOQUE FORA PARA RECOLHER', 640 - 16 - tw('TOQUE FORA PARA RECOLHER'), 462, TXT_2)
    # aviso
    im.alpha_composite(SAIDA['ui/faixa_alerta'], (0, 0))
    texto(im, 'OLEO SUJO NO TACHO 1', 320 - tw('OLEO SUJO NO TACHO 1', 2) // 2, 6, PAPEL, 2)
    hi = scale2x(im)
    # cachorros da biblioteca (2× nativos) por cima, como no jogo
    if caes_dir and os.path.isdir(caes_dir):
        lista = [('caramelo_m_parado', '#d9903f'), ('collie_m_parado', '#e8e2d0'), ('dalmata_p_parado', '#e8e2d0'),
                 ('pitbull_g_parado', '#8b8fa3'), ('salsicha_p_parado', '#8a5a33')]
        for (nome, cor), (sx, sy) in zip(lista, spots):
            d = recolor(Image.open(os.path.join(caes_dir, nome + '.png')), cor).transpose(Image.FLIP_LEFT_RIGHT)
            hi.alpha_composite(d, (sx * 2 - d.width // 2, sy * 2 - d.height))
        d = recolor(Image.open(os.path.join(caes_dir, 'pasteleiro_parado.png')), '#d9903f')
        hi.alpha_composite(d, (469 * 2 - d.width // 2, 140 * 2 - d.height))
    return hi


def tres3(name, w):
    """3-slice com pontas de 10 (tacho)."""
    l, m, r = SAIDA[f'{name}_esq'], SAIDA[f'{name}_meio'], SAIDA[f'{name}_dir']
    h = m.height; out = new(w, h); out.alpha_composite(l, (0, 0)); x = l.width
    while x < w - r.width: cw = min(m.width, w - r.width - x); out.alpha_composite(m.crop((0, 0, cw, h)), (x, 0)); x += cw
    out.alpha_composite(r, (w - r.width, 0)); return out


def grade(im, x, y, w, h):
    t = SAIDA['equip/cesto_grade']
    for yy in range(y, y + h, 8):
        for xx in range(x, x + w, 8):
            im.alpha_composite(t.crop((0, 0, min(8, x + w - xx), min(8, y + h - yy))), (xx, yy))


def cesto_grade():
    im = new(8, 8); p = Pen(im)
    R(p, 0, 0, 8, 8, (154, 163, 170, 90))
    R(p, 0, 0, 8, 1, ACO_L); R(p, 0, 4, 8, 1, ACO_L); R(p, 0, 0, 1, 8, ACO_L); R(p, 4, 0, 1, 8, ACO_L)
    return im


def cesto_alca():
    im = new(6, 10); p = Pen(im)
    R(p, 1, 0, 4, 10, ACO_O); R(p, 2, 0, 2, 9, ACO_P); R(p, 0, 0, 6, 2, INK)
    return im


def folha():
    """Folha de contato com tudo que foi gerado (exceto fundo e capa), 2× + nearest."""
    itens = [(k, v) for k, v in SAIDA.items() if k not in ('cenario/fundo', 'capa')]
    cols, cell = 10, 96
    rows = (len(itens) + cols - 1) // cols
    im = Image.new('RGBA', (cols * cell, rows * (cell + 12)), hexc('#1b1426'))
    for i, (k, v) in enumerate(itens):
        x, y = (i % cols) * cell, (i // cols) * (cell + 12)
        Pen(im).rect(x + 2, y + 2, x + cell - 3, y + cell - 3, '#2a2236')
        s = max(1, min(4, (cell - 8) // max(v.width, v.height)))
        t = v.resize((v.width * s, v.height * s), Image.NEAREST)
        if t.width > cell - 6 or t.height > cell - 6: t.thumbnail((cell - 6, cell - 6), Image.NEAREST)
        im.alpha_composite(t, (x + (cell - t.width) // 2, y + (cell - t.height) // 2))
        texto(im, k.split('/')[-1].upper()[:23].replace('_', ' '), x + 3, y + cell + 3, '#bfb3cf')
    return im


# ---------------------------------------------------------------- main
def main():
    global OUT
    args = sys.argv[1:]
    previa = caes = None
    if '--previa' in args: i = args.index('--previa'); previa = args[i + 1]; del args[i:i + 2]
    if '--caes' in args: i = args.index('--caes'); caes = args[i + 1]; del args[i:i + 2]
    OUT = args[0] if args else '.'

    save(fundo(), 'cenario/fundo')
    for k in ('fila', 'madeira', 'mesas', 'metal'): save(piso_16(k), f'cenario/piso_{k}')
    save(tile_mosaico(), 'cenario/mosaico'); save(tile_madeira(), 'cenario/assoalho')

    slice3(balcao(), 'moveis/balcao'); slice3(bancada(), 'moveis/bancada'); slice3(fogao(), 'moveis/fogao')
    slice3(estufa(), 'moveis/estufa'); slice3(escrivaninha(), 'moveis/escrivaninha'); slice3(banco(), 'moveis/banco')
    slice3(tacho(False), 'equip/tacho', 10, 10); slice3(tacho(True), 'equip/tacho_sujo', 10, 10)
    save(cesto_grade(), 'equip/cesto_grade'); save(cesto_alca(), 'equip/cesto_alca')
    for t in ('manual', 'motor', 'auto'): save(moenda(t), f'equip/moenda_{t}')
    save(caixa_termica(), 'equip/caixa_termica'); save(mesa(), 'equip/mesa'); save(maquininha(), 'equip/maquininha')
    save(caixa_encomenda(False), 'equip/caixa_encomenda'); save(caixa_encomenda(True), 'equip/caixa_encomenda_pronta')
    save(sacola_app(False), 'equip/sacola_app'); save(sacola_app(True), 'equip/sacola_app_motoboy')
    for k in ('rolo', 'massa', 'potes', 'saco_farinha', 'caixote_cana', 'caixote_limao', 'garrafa_cafe', 'migalhas', 'assento'):
        save(decor(k), f'decor/{k}')

    for c in ('salgado', 'doce', 'especial'):
        for e in ESTADOS: save(pastel(c, e), f'itens/pastel_{c}_{e}')
    save(copo(), 'itens/copo'); save(moeda(), 'itens/moeda')
    for k, (forma, c, d) in INGREDIENTES.items(): save(ingrediente(forma, c, d), f'itens/ing_{k}')

    for k in CTRL: save(icone_ctrl(k), f'icones/ctrl_{k}')
    save(moldura(), 'ui/moldura'); save(aba(), 'ui/aba')
    for k in ('normal', 'selecionado', 'desligado'): save(slot(k), f'ui/slot_{k}')
    save(balao(), 'ui/balao'); save(balao_rabo(), 'ui/balao_rabo')
    for k in ('alerta', 'evento', 'oferta'): save(faixa(k), f'ui/faixa_{k}')
    for k in ('esq', 'meio', 'dir'): save(placa(k), f'ui/placa_{k}')
    save(placa_xepa(), 'ui/placa_xepa')
    for k in HUD: save(hud(k), f'ui/hud_{k}')
    for k in ('fiscal', 'energia', 'excursao', 'fogo', 'queimado', 'chuva', 'calor'): save(icone(k), f'icones/{k}')
    for k in ('economico', 'padrao', 'exigente'): save(perfil(k), f'icones/perfil_{k}')
    save(capa(), 'capa')

    if previa:
        os.makedirs(previa, exist_ok=True)
        previa_dia(caes).save(os.path.join(previa, 'dia-de-feira.png'))
        folha().save(os.path.join(previa, 'folha-de-sprites.png'))
        scale2x(SAIDA['capa']).save(os.path.join(previa, 'capa.png'))
    print(f'{len(SAIDA)} PNGs em {OUT}' + (f'; prévias em {previa}' if previa else ''))


if __name__ == '__main__':
    main()
