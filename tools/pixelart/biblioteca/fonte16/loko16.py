"""Desenho 1× (16 bits) original, copiado de cachorro_loko.py sem alterações de arte. Usado pela biblioteca,
que amplia com Scale2x (ver prim.scale2x). Não edite o desenho aqui sem regerar a biblioteca."""

"""Cachorro Loko: cachorro na moto, caixas, efeitos, esteira, restaurante LOKO DOG, HUD e cenário.

Uso: python3 cachorro_loko.py <pasta-de-saida>
Saída já na estrutura de src/games/cachorro-loko/assets/ (mais spritesheet e uma cena de exemplo).
A cena de exemplo usa as esteiras antigas (mais compridas); as posições reais estão em game/constants.ts.
"""
import os, math, random, json, sys
from PIL import Image, ImageDraw

OUT = '.'
def P(*a):
    p = os.path.join(OUT, *a); os.makedirs(os.path.dirname(p), exist_ok=True); return p
def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), a)
def new(w, h): return Image.new('RGBA', (w, h), (0,0,0,0))
def rect(im, x0, y0, x1, y1, col):
    if x1 < x0 or y1 < y0: return
    ImageDraw.Draw(im).rectangle([x0, y0, x1, y1], fill=hexc(col))
def put(im, x, y, col):
    if 0 <= x < im.width and 0 <= y < im.height: im.putpixel((x, y), hexc(col))
def from_map(rows, pal):
    w = max(len(r) for r in rows); im = new(w, len(rows))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != '.': im.putpixel((x, y), hexc(pal[c]))
    return im
def disc(im, cx, cy, r, col):
    for y in range(int(cy-r-1), int(cy+r+2)):
        for x in range(int(cx-r-1), int(cx+r+2)):
            if (x-cx)**2 + (y-cy)**2 <= r*r: put(im, x, y, col)
def outline(im, col='#1b1220'):
    """Contorno de 1px em volta de tudo que é opaco."""
    src = im.copy(); px = src.load(); o = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3]: continue
            for dx, dy in ((1,0),(-1,0),(0,1),(0,-1)):
                xx, yy = x+dx, y+dy
                if 0 <= xx < im.width and 0 <= yy < im.height and px[xx, yy][3]:
                    o[x, y] = hexc(col); break
    return im

INK = '#1b1220'
# ------------------------------------------------------------------ CACHORRO NA MOTO
# Quadro 40×32, de frente para a direita. Roda traseira centrada em (12,26), dianteira em (31,26).
FUR, FUR_L, FUR_D = '#d9903f', '#f2c27a', '#9a5a22'
MOTO, MOTO_D, MOTO_L = '#3d7fb5', '#2c5f8c', '#7fb3dd'
BAU, BAU_D = '#d42a2a', '#9e1c1c'

def wheel(im, cx, cy, frame):
    disc(im, cx, cy, 4.6, INK); disc(im, cx, cy, 3.2, '#4a4552'); disc(im, cx, cy, 1.2, '#b9b6ad')
    spokes = [(0,-2),(0,2),(-2,0),(2,0)] if frame == 0 else [(-1,-1),(1,1),(-1,1),(1,-1)]
    for dx, dy in spokes: put(im, cx+dx, cy+dy, '#b9b6ad')

def rider(frame=0, tongue=True, flame=False, dizzy=False):
    im = new(40, 32)
    # baú
    rect(im, 2, 9, 12, 19, BAU); rect(im, 2, 18, 12, 19, BAU_D); rect(im, 2, 12, 12, 12, '#f4efe2')
    rect(im, 6, 14, 8, 16, '#f4efe2'); put(im, 7, 15, BAU)  # patinha
    # corpo da moto
    rect(im, 10, 20, 30, 23, MOTO); rect(im, 10, 23, 28, 23, MOTO_D); rect(im, 12, 20, 26, 20, MOTO_L)
    rect(im, 26, 16, 31, 21, MOTO); rect(im, 27, 16, 31, 16, MOTO_L)   # carenagem frontal
    put(im, 32, 18, '#ffd36b'); put(im, 32, 19, '#ffd36b')               # farol
    rect(im, 13, 18, 22, 19, INK)                                        # banco
    for i in range(6): put(im, 29 + i//3, 21 + i % 3 + 1, '#8a8a90')     # garfo
    rect(im, 26, 13, 27, 15, '#8a8a90'); rect(im, 24, 13, 28, 13, '#5b5666')  # guidão
    rect(im, 6, 23, 12, 24, '#5b5666')                                   # escapamento
    # cachorro
    rect(im, 14, 10, 22, 17, FUR); rect(im, 16, 12, 21, 17, FUR_L)        # tronco + peito
    rect(im, 15, 17, 18, 19, FUR_D)                                      # perna
    rect(im, 21, 12, 25, 13, FUR); put(im, 25, 13, FUR_L)                # braço no guidão
    rect(im, 19, 2, 27, 9, FUR); rect(im, 24, 6, 30, 9, FUR_L)           # cabeça + focinho
    rect(im, 30, 6, 30, 7, INK)                                          # nariz
    rect(im, 17, 2, 19, 7, FUR_D); put(im, 18, 8, FUR_D)                 # orelha caída
    rect(im, 20, 0, 26, 2, '#d42a2a'); rect(im, 19, 2, 27, 2, '#9e1c1c'); rect(im, 26, 2, 28, 2, '#9e1c1c')  # capacete/boné
    if dizzy:
        put(im, 23, 4, INK); put(im, 25, 4, INK); put(im, 24, 5, INK); put(im, 23, 6, INK); put(im, 25, 6, INK)
    else:
        put(im, 24, 4, INK); put(im, 24, 5, INK); put(im, 25, 4, '#f4efe2')
    if tongue: rect(im, 27, 10, 28, 11, '#ff7a9a'); put(im, 27, 9, '#ff7a9a')
    rect(im, 22, 10, 23, 10, '#d42a2a'); put(im, 21, 11, '#d42a2a')     # lencinho
    outline(im)
    wheel(im, 12, 26, frame); wheel(im, 31, 26, frame)
    if flame:
        cols = ['#fffbe6', '#ffd84a', '#f08a24', '#c0392b']
        L = 5 if frame == 0 else 7
        for i in range(L):
            c = cols[min(3, i * 4 // L)]
            put(im, 5 - i, 24, c);
            if i < L - 2: put(im, 5 - i, 23 + (i % 2), c)
    return im

def tall(base):
    # quadro final 40×40: sobra espaço em cima para o grau
    im = new(40, 40); im.alpha_composite(base, (0, 8)); return im
def wheelie(base):
    # gira ~20° em torno do ponto de apoio da roda traseira (vizinho mais próximo)
    big = tall(base).resize((160, 160), Image.NEAREST)
    rot = big.rotate(20, resample=Image.NEAREST, center=(12 * 4 + 2, 38 * 4))
    return rot.resize((40, 40), Image.NEAREST)

DOG = {}
DOG['cachorro_0'] = tall(rider(0)); DOG['cachorro_1'] = tall(rider(1))
DOG['cachorro_turbo_0'] = tall(rider(0, flame=True)); DOG['cachorro_turbo_1'] = tall(rider(1, flame=True))
DOG['cachorro_grau_0'] = wheelie(rider(0)); DOG['cachorro_grau_1'] = wheelie(rider(1))
DOG['cachorro_tonto'] = tall(rider(0, tongue=False, dizzy=True))

# ------------------------------------------------------------------ CAIXAS (12×12)
def box(body, dark, tape='#c9a46a', icon=None):
    im = new(12, 12)
    rect(im, 0, 1, 11, 11, INK); rect(im, 1, 2, 10, 10, body); rect(im, 1, 9, 10, 10, dark)
    rect(im, 5, 2, 6, 4, tape)
    if icon: icon(im)
    return im
def ic_bolt(im):
    for x, y in [(7,3),(6,4),(5,5),(4,6),(5,6),(6,6),(7,6),(6,7),(5,8),(4,9)]: put(im, x, y, '#ffd84a')
def ic_grau(im):
    for x, y in [(3,8),(4,7),(5,6),(6,5),(7,4),(8,4)]: put(im, x, y, '#f4efe2')
    for x, y in [(2,8),(3,9),(8,3),(9,4)]: put(im, x, y, '#f4efe2')
def ic_ima(im):
    rect(im, 3, 4, 4, 8, '#d42a2a'); rect(im, 7, 4, 8, 8, '#d42a2a'); rect(im, 4, 8, 7, 9, '#d42a2a')
    rect(im, 3, 4, 4, 4, '#f4efe2'); rect(im, 7, 4, 8, 4, '#f4efe2')
def ic_vida(im):
    for x, y in [(3,4),(4,4),(7,4),(8,4),(2,5),(3,5),(4,5),(5,5),(6,5),(7,5),(8,5),(9,5),(3,6),(4,6),(5,6),(6,6),(7,6),(8,6),(4,7),(5,7),(6,7),(7,7),(5,8),(6,8)]:
        put(im, x, y, '#ff4d5e')
    put(im, 3, 4, '#ffb3bb')
def ic_x2(im):
    for x, y in [(2,4),(4,4),(3,5),(2,6),(4,6)]: put(im, x, y, '#1b1220')
    for x, y in [(6,3),(7,3),(8,3),(8,4),(7,5),(6,6),(6,7),(7,7),(8,7)]: put(im, x, y, '#1b1220')
BOX = {
 'caixa': box('#c9945a', '#9a6a3a'),
 'pizza': None, 'sacola': None,
 'turbo': box('#3d7fb5', '#2c5f8c', '#7fb3dd', ic_bolt),
 'grau': box('#3fa65a', '#2a7a40', '#8fd6a0', ic_grau),
 'ima': box('#e8e2d0', '#b3ab95', '#d9d2bf', ic_ima),
 'vida': box('#f4efe2', '#c9c0d8', '#e0d9ea', ic_vida),
 'dobro': box('#ffd23f', '#d9901a', '#fff1a8', ic_x2),
}
pz = new(12, 12); rect(pz, 0, 6, 11, 11, INK); rect(pz, 1, 7, 10, 10, '#e8d6b0'); rect(pz, 1, 10, 10, 10, '#c4ad80')
rect(pz, 3, 8, 8, 8, '#d42a2a'); BOX['pizza'] = pz
sc = new(12, 12); rect(sc, 1, 3, 10, 11, INK); rect(sc, 2, 4, 9, 10, '#b98a52'); rect(sc, 2, 10, 9, 10, '#8f6538')
rect(sc, 4, 0, 4, 3, INK); rect(sc, 7, 0, 7, 3, INK); rect(sc, 5, 0, 6, 0, INK); rect(sc, 4, 6, 7, 7, '#d42a2a'); BOX['sacola'] = sc
def bomb(f):
    im = new(12, 12); disc(im, 5.5, 7, 4.4, INK); disc(im, 5.5, 7, 3.4, '#3b3a48'); put(im, 4, 5, '#8a8a90'); put(im, 3, 6, '#8a8a90')
    rect(im, 7, 2, 8, 3, '#8a8a90'); put(im, 9, 1, '#c9945a')
    if f == 0: put(im, 10, 0, '#ffd84a'); put(im, 11, 1, '#f08a24')
    else: put(im, 10, 0, '#f08a24'); put(im, 9, 0, '#ffd84a'); put(im, 11, 0, '#ffd84a')
    return im
BOX['bomba_0'] = bomb(0); BOX['bomba_1'] = bomb(1)

# ------------------------------------------------------------------ EFEITOS
def sparkle(f):
    im = new(12, 12); c = ['#fffbe6', '#ffd84a', '#f5b860'][f]; r = [2, 4, 5][f]
    for d in range(-r, r+1):
        if abs(d) != r or f < 2: put(im, 6+d, 6, c); put(im, 6, 6+d, c)
    if f >= 1: put(im, 6-r+1, 6-r+1, c); put(im, 6+r-1, 6-r+1, c); put(im, 6-r+1, 6+r-1, c); put(im, 6+r-1, 6+r-1, c)
    return im
def dust(f):
    im = new(12, 8); r = random.Random(f)
    for i in range(6 + f*3):
        x = r.randrange(0, 4 + f*3); y = r.randrange(3, 8)
        put(im, x, y, '#cfc8b6' if f < 2 else '#9a968c')
    return im
def boom(f):
    im = new(24, 24); R = [5, 9, 11][f]
    for y in range(24):
        for x in range(24):
            d = math.hypot(x-11.5, y-11.5) + (math.sin(x*12.9+y*78.2+f)*43758.5 % 1 - 0.5) * 2
            if d > R: continue
            t = d / R
            col = (['#fffbe6','#ffd84a','#f08a24','#c0392b'] if f < 2 else ['#3d3340','#6e5f66','#e26b2a','#a8281e'])[0 if t < .35 else 1 if t < .6 else 2 if t < .85 else 3]
            put(im, x, y, col)
    return im
def squash():
    im = new(14, 6); rect(im, 0, 3, 13, 5, INK); rect(im, 1, 3, 12, 4, '#c9945a'); rect(im, 1, 5, 12, 5, '#9a6a3a')
    rect(im, 5, 3, 7, 3, '#c9a46a'); put(im, 2, 2, '#c9945a'); put(im, 11, 1, '#c9945a'); put(im, 12, 2, '#9a6a3a')
    return im
FX = {f'brilho_{i}': sparkle(i) for i in range(3)}
FX.update({f'poeira_{i}': dust(i) for i in range(3)})
FX.update({f'explosao_{i}': boom(i) for i in range(3)})
FX['caixa_amassada'] = squash()
# ------------------------------------------------------------------ HUD
heart_rows = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."]
def heart(full):
    im = new(7, 6)
    for y, r in enumerate(heart_rows):
        for x, c in enumerate(r):
            if c == 'X': put(im, x, y, '#ff4d5e' if full else '#4a4552')
    if full: put(im, 1, 1, '#ffb3bb')
    return im
HUD = {'coracao_cheio': heart(True), 'coracao_vazio': heart(False)}