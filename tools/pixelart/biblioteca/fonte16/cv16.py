"""Desenho 1× (16 bits) original, copiado de motoboys.py sem alterações de arte. Usado pela biblioteca,
que amplia com Scale2x (ver prim.scale2x). Não edite o desenho aqui sem regerar a biblioteca."""

"""Capacete Voador: os dois cachorros motoboys (dano 0–2, destruída, poses) e os capacetes.

Uso: python3 motoboys.py <pasta-de-saida>
Saída: motoboys/*.png e sprites/capacete_*.png -> copie para src/games/capacete-voador/assets/.
As áreas de acerto (PILOT_BOX, MOTO_BOX em game/constants.ts) dependem das coordenadas desenhadas aqui.
"""
import os, math, sys
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
def clear(im, x, y):
    if 0 <= x < im.width and 0 <= y < im.height: im.putpixel((x, y), (0,0,0,0))
def disc(im, cx, cy, r, col):
    for y in range(int(cy-r-1), int(cy+r+2)):
        for x in range(int(cx-r-1), int(cx+r+2)):
            if (x-cx)**2 + (y-cy)**2 <= r*r: put(im, x, y, col)
def outline(im, col='#1b1220'):
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
PLAYERS = {
    # caramelo, moto azul, baú vermelho, boné vermelho
    'p1': dict(fur='#d9903f', furL='#f2c27a', furD='#9a5a22', moto='#3d7fb5', motoD='#2c5f8c', motoL='#7fb3dd',
               bau='#d42a2a', bauD='#9e1c1c', cap='#d42a2a', capD='#9e1c1c', scarf='#ffd23f'),
    # branquinho com manchas, moto verde, baú amarelo, boné azul
    'p2': dict(fur='#e8e2d0', furL='#ffffff', furD='#8f8a7c', moto='#3fa65a', motoD='#2a7a40', motoL='#8fd6a0',
               bau='#ffd23f', bauD='#d9901a', cap='#3d7fb5', capD='#2c5f8c', scarf='#d42a2a'),
}

def wheel(im, cx, cy, bent=False):
    disc(im, cx, cy, 4.6, INK); disc(im, cx, cy, 3.2, '#4a4552'); disc(im, cx, cy, 1.2, '#b9b6ad')
    for dx, dy in [(0,-2),(0,2),(-2,0),(2,0)]: put(im, cx+dx, cy+dy, '#b9b6ad')
    if bent:  # roda amassada: achata um lado
        for x in range(cx-4, cx+5): clear(im, x, cy+5); put(im, x, cy+4, INK)
        put(im, cx+3, cy-3, INK); put(im, cx+2, cy-2, '#4a4552')

def dog(im, c, pose, dy=0, ko=False):
    """pose: 'guidao' (mãos no guidão), 'arremesso' (braço para cima), 'sentado' (no chão, destroços)."""
    rect(im, 14, 10+dy, 22, 17+dy, c['fur']); rect(im, 16, 12+dy, 21, 17+dy, c['furL'])
    rect(im, 15, 17+dy, 18, 19+dy, c['furD'])
    if pose == 'arremesso':
        rect(im, 13, 3+dy, 15, 11+dy, c['fur']); rect(im, 13, 2+dy, 15, 2+dy, c['furL'])
    else:
        rect(im, 21, 12+dy, 25, 13+dy, c['fur']); put(im, 25, 13+dy, c['furL'])
    rect(im, 19, 2+dy, 27, 9+dy, c['fur']); rect(im, 24, 6+dy, 30, 9+dy, c['furL'])
    rect(im, 30, 6+dy, 30, 7+dy, INK)
    rect(im, 17, 2+dy, 19, 7+dy, c['furD']); put(im, 18, 8+dy, c['furD'])
    if c['fur'] == '#e8e2d0':  # manchas do branquinho
        put(im, 21, 4+dy, c['furD']); put(im, 22, 4+dy, c['furD']); put(im, 17, 13+dy, c['furD']); put(im, 20, 15+dy, c['furD'])
    if not ko:
        rect(im, 20, 0+dy, 26, 2+dy, c['cap']); rect(im, 19, 2+dy, 27, 2+dy, c['capD']); rect(im, 26, 2+dy, 28, 2+dy, c['capD'])
        put(im, 24, 4+dy, INK); put(im, 24, 5+dy, INK); put(im, 25, 4+dy, '#f4efe2')
        rect(im, 27, 10+dy, 28, 11+dy, '#ff7a9a'); put(im, 27, 9+dy, '#ff7a9a')
    else:  # nocauteado: olhos em X, língua de fora, sem boné
        for x, y in [(23,3),(25,3),(24,4),(23,5),(25,5)]: put(im, x, y+dy, INK)
        rect(im, 27, 10+dy, 28, 12+dy, '#ff7a9a')
    rect(im, 22, 10+dy, 23, 10+dy, c['scarf']); put(im, 21, 11+dy, c['scarf'])

def rider(pkey, damage, pose='guidao', ko=False):
    c = PLAYERS[pkey]; im = new(40, 32)
    if damage >= 3:
        return wreck(pkey, ko)
    # baú
    if damage == 0:
        rect(im, 2, 9, 12, 19, c['bau']); rect(im, 2, 18, 12, 19, c['bauD']); rect(im, 2, 12, 12, 12, '#f4efe2')
        rect(im, 6, 14, 8, 16, '#f4efe2'); put(im, 7, 15, c['bau'])
    else:  # baú quebrado: tampa arrancada, rachaduras, canto faltando
        rect(im, 2, 12, 12, 19, c['bau']); rect(im, 2, 18, 12, 19, c['bauD'])
        for x, y in [(3,12),(4,12),(5,13),(10,12),(11,12),(12,13)]: clear(im, x, y)
        for x, y in [(6,13),(7,14),(6,15),(7,16),(8,17),(10,14),(11,15)]: put(im, x, y, INK)
        rect(im, 1, 10, 4, 10, c['bauD']); put(im, 0, 9, c['bauD'])   # tampa solta
    # corpo
    rect(im, 10, 20, 30, 23, c['moto']); rect(im, 10, 23, 28, 23, c['motoD']); rect(im, 12, 20, 26, 20, c['motoL'])
    rect(im, 26, 16, 31, 21, c['moto']); rect(im, 27, 16, 31, 16, c['motoL'])
    if damage >= 2:
        for x, y in [(28,17),(29,18),(27,19),(30,20),(16,21),(17,22),(22,21)]: put(im, x, y, INK)
        put(im, 32, 18, '#5b5666'); put(im, 32, 19, '#5b5666')            # farol quebrado
        clear(im, 31, 16); clear(im, 30, 16)
    else:
        put(im, 32, 18, '#ffd36b'); put(im, 32, 19, '#ffd36b')
    rect(im, 13, 18, 22, 19, INK)
    for i in range(6): put(im, 29 + i//3, 21 + i % 3 + 1, '#8a8a90')
    rect(im, 26, 13, 27, 15, '#8a8a90'); rect(im, 24, 13, 28, 13, '#5b5666')
    rect(im, 6, 23, 12, 24, '#5b5666')
    dog(im, c, pose, ko=ko)
    outline(im)
    wheel(im, 12, 26); wheel(im, 31, 26, bent=damage >= 2)
    return im

def wreck(pkey, ko):
    """Moto destruída: chassi partido, rodas soltas, baú em pedaços, cachorro sentado."""
    c = PLAYERS[pkey]; im = new(40, 32)
    # pedaços de chassi no chão
    rect(im, 8, 26, 18, 28, c['moto']); rect(im, 8, 28, 18, 28, c['motoD']); put(im, 18, 25, c['moto'])
    rect(im, 22, 25, 31, 28, c['moto']); rect(im, 22, 28, 31, 28, c['motoD']); rect(im, 30, 23, 32, 25, c['moto'])
    rect(im, 3, 25, 6, 28, c['bau']); rect(im, 34, 27, 37, 28, c['bau']); put(im, 1, 28, c['bauD'])
    rect(im, 20, 27, 21, 28, '#8a8a90'); put(im, 33, 24, '#5b5666')
    dog(im, c, 'guidao', dy=8, ko=ko)
    outline(im)
    # rodas deitadas
    for cx in (6, 34):
        rect(im, cx-4, 29, cx+4, 31, INK); rect(im, cx-3, 30, cx+3, 30, '#4a4552')
    return im

def tall(base):
    im = new(40, 40); im.alpha_composite(base, (0, 8)); return im
def wheelie(base):
    big = tall(base).resize((160, 160), Image.NEAREST)
    rot = big.rotate(20, resample=Image.NEAREST, center=(12 * 4 + 2, 38 * 4))
    return rot.resize((40, 40), Image.NEAREST)

def helmet(pkey):
    c = PLAYERS[pkey]
    m = ["..KKKK..", ".KCCCCK.", "KCCLCCCK", "KCCWWWWK", "KCCWWWWK", "KDDDDDDK", ".KKKKKK.", "........"]
    im = new(8, 8)
    pal = {'K': INK, 'C': c['cap'], 'D': c['capD'], 'L': '#f4efe2', 'W': '#9cc3e6'}
    for y, r in enumerate(m):
        for x, ch in enumerate(r):
            if ch != '.': put(im, x, y, pal[ch])
    return im
