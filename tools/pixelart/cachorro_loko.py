"""Cachorro Loko: cachorro na moto, caixas, efeitos, esteira, restaurante LOKO DOG, HUD e cenário.

Uso: python3 cachorro_loko.py <pasta-de-saida>
Saída já na estrutura de src/games/cachorro-loko/assets/ (mais spritesheet e uma cena de exemplo).
A cena de exemplo usa as esteiras antigas (mais compridas); as posições reais estão em game/constants.ts.
"""
import os, math, random, json, sys
from PIL import Image, ImageDraw

OUT = sys.argv[1]
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

# ------------------------------------------------------------------ ESTEIRA
def belt_tile(f):
    im = new(16, 8)
    rect(im, 0, 0, 15, 0, '#5b5666'); rect(im, 0, 1, 15, 2, '#2a2533')
    for x in range(16):
        if (x + f) % 4 == 0: put(im, x, 1, '#4a4552')
    rect(im, 0, 3, 15, 5, '#8a8a90'); rect(im, 0, 3, 15, 3, '#b9b6ad')
    for cx in (3, 11):
        put(im, cx, 4, INK); put(im, cx + (1 if f % 2 else -1), 4, '#5b5666')
    rect(im, 0, 6, 15, 6, '#2a2533'); rect(im, 0, 7, 15, 7, '#1b1220')
    return im
def belt_end(f, right):
    im = new(6, 8); disc(im, 2.5, 3.5, 3.2, '#5b5666'); disc(im, 2.5, 3.5, 2.2, '#8a8a90'); disc(im, 2.5, 3.5, 0.8, INK)
    a = f * math.pi / 2; put(im, round(2.5 + math.cos(a) * 2), round(3.5 + math.sin(a) * 2), '#f4efe2')
    return im if right else im.transpose(Image.FLIP_LEFT_RIGHT)
def leg():
    im = new(4, 16); rect(im, 1, 0, 2, 15, '#5b5666'); rect(im, 1, 0, 1, 15, '#8a8a90'); rect(im, 0, 15, 3, 15, '#2a2533'); return im
def flap(state):
    # desviador no fim da esteira: verde = desce para a próxima; vermelho = arremessa na rua
    im = new(8, 12); rect(im, 3, 0, 4, 11, '#5b5666')
    if state == 'desce':
        rect(im, 1, 1, 6, 4, INK); rect(im, 2, 2, 5, 3, '#3fa65a')
        for i, y in enumerate(range(5, 10)): rect(im, 3 - (1 if y == 8 else 0), y, 4 + (1 if y == 8 else 0), y, '#3fa65a' if y != 9 else '#3fa65a')
    else:
        rect(im, 1, 1, 6, 4, INK); rect(im, 2, 2, 5, 3, '#ff4d5e')
        for x in range(2, 8): put(im, x, 7, '#ff4d5e')
        put(im, 6, 6, '#ff4d5e'); put(im, 6, 8, '#ff4d5e')
    return im
BELT = {f'esteira_{i}': belt_tile(i) for i in range(4)}
BELT.update({f'esteira_ponta_dir_{i}': belt_end(i, True) for i in range(4)})
BELT.update({f'esteira_ponta_esq_{i}': belt_end(i, False) for i in range(4)})
BELT['esteira_pe'] = leg()
BELT['desvio_desce'] = flap('desce'); BELT['desvio_rua'] = flap('rua')

# ------------------------------------------------------------------ RESTAURANTE + CHAPEIRO
FONT = {'L': ["X..","X..","X..","X..","XXX"], 'O': ["XXX","X.X","X.X","X.X","XXX"], 'K': ["X.X","X.X","XX.","X.X","X.X"],
        'D': ["XX.","X.X","X.X","X.X","XX."], 'G': ["XXX","X..","X.X","X.X","XXX"], ' ': ["...","...","...","...","..."],
        '-': ["...","...","XXX","...","..."]}
def text(im, s, x, y, col):
    for ch in s:
        for gy, row in enumerate(FONT[ch]):
            for gx, c in enumerate(row):
                if c == 'X': put(im, x+gx, y+gy, col)
        x += 4
def restaurant():
    W, Hh = 112, 52; im = new(W, Hh)
    rect(im, 4, 14, W-5, Hh-1, '#e8e2d0')                                  # fachada
    for y in range(16, Hh, 4):
        for x in range(4 + (y // 4 % 2) * 4, W-5, 8): put(im, x, y, '#cfc8b6')   # azulejo
    rect(im, 0, 8, W-1, 13, INK)                                           # placa
    rect(im, 1, 9, W-2, 12, '#d42a2a')
    rect(im, 30, 0, 81, 9, INK); rect(im, 31, 1, 80, 8, '#ffd23f')
    text(im, 'LOKO DOG', 40, 2, INK)
    # cachorro-quente na placa
    rect(im, 84, 2, 95, 6, '#c9945a'); rect(im, 85, 3, 94, 4, '#b04a2a'); rect(im, 86, 3, 93, 3, '#ffd23f')
    for x in range(1, W-1):                                                # toldo listrado
        for y in range(14, 19):
            put(im, x, y, '#d42a2a' if (x // 4) % 2 == 0 else '#f4efe2')
    for x in range(1, W-1, 4): put(im, x+1, 19, '#d42a2a'); put(im, x+2, 19, '#d42a2a')
    rect(im, 12, 24, 52, 40, INK); rect(im, 13, 25, 51, 39, '#3a2547')   # balcão/janela
    rect(im, 13, 36, 51, 39, '#8f6538'); rect(im, 13, 35, 51, 35, '#c9945a')
    rect(im, 62, 24, 99, 46, INK); rect(im, 63, 25, 98, 45, '#2a2533')    # boca de saída das caixas
    for y in range(26, 45, 3): rect(im, 63, y, 98, y, '#3b3a48')
    rect(im, 4, Hh-2, W-5, Hh-1, '#9a968c')
    put(im, 20, 27, '#ffd36b'); put(im, 44, 27, '#ffd36b')
    return im
def chef(f):
    m = [
        "....WWWW....",
        "...WWWWWW...",
        "...WWWWWW...",
        "....SSSS....",
        "....SKSK....",
        "....SSSS....",
        "....SMMS....",
        "...WWWWWW...",
        "..SWWAAWWS..",
        "..SWWAAWWS..",
        "...WWAAWW...",
        "...WWAAWW...",
        "....DD.DD...",
        "....DD.DD...",
    ]
    if f == 1:
        m[7] = "...WWWWWWSS."; m[8] = "...WWAAWW.S."; m[9] = "..SWWAAWW..."
    im = from_map(m, {'W':'#f4efe2','S':'#c98a5a','K':INK,'M':'#7a3a2a','A':'#d42a2a','D':'#3b3a48'})
    return outline(im)
REST = {'restaurante': restaurant(), 'chapeiro_0': chef(0), 'chapeiro_1': chef(1)}

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

# ------------------------------------------------------------------ CENÁRIO
BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]
STOPS = [(0,'#1b1638'),(40,'#2e1f4f'),(80,'#5a2c64'),(115,'#8f3a62'),(140,'#c4555a'),(160,'#e98a55'),(176,'#f5b860')]
def background():
    im = new(320, 200); px = im.load()
    for y in range(176):
        for i in range(len(STOPS)-1):
            if STOPS[i][0] <= y < STOPS[i+1][0] or i == len(STOPS)-2: break
        y0, c0 = STOPS[i]; y1, c1 = STOPS[i+1]; t = min(1, (y - y0) / (y1 - y0))
        for x in range(320): px[x, y] = hexc(c1 if t*16 > BAYER[y % 4][x % 4] + 0.5 else c0)
    r = random.Random(9); x = 0
    while x < 320:                                                       # prédios ao fundo
        w = r.randrange(10, 26); h = r.randrange(40, 110)
        rect(im, x, 176-h, x+w-1, 175, '#3a2547')
        for yy in range(176-h+3, 172, 4):
            for xx in range(x+2, x+w-2, 3):
                if r.random() < 0.12: put(im, xx, yy, '#e7a35c')
        x += w + r.randrange(0, 3)
    for mx, mh in [(48, 150), (262, 140)]:
        for yy in range(176-mh, 176-100): put(im, mx, yy, '#f4efe2' if (yy // 3) % 2 else '#d63a2f')
        put(im, mx, 176-mh-1, '#ff5a3c')
    rect(im, 0, 176, 319, 179, '#9a968c'); rect(im, 0, 176, 319, 176, '#cfc8b6')     # calçada
    for x in range(0, 320, 12): put(im, x, 178, '#7d7970')
    rect(im, 0, 180, 319, 199, '#3b3a48')                                             # asfalto
    for x in range(4, 320, 24): rect(im, x, 191, x+11, 192, '#f4efe2')                # faixa
    for x in range(0, 320, 3):
        if r.random() < 0.15: put(im, x, r.randrange(182, 199), '#4a4552')
    return im

# ------------------------------------------------------------------ SAÍDA
saved = {}
def save(im, *path):
    im.save(P(*path)); saved['/'.join(path)] = im
for k, v in DOG.items(): save(v, 'sprites', k + '.png')
for k, v in BOX.items(): save(v, 'caixas', k + '.png')
for k, v in FX.items(): save(v, 'efeitos', k + '.png')
for k, v in BELT.items(): save(v, 'esteira', k + '.png')
for k, v in REST.items(): save(v, 'cenario', k + '.png')
for k, v in HUD.items(): save(v, 'hud', k + '.png')
bg = background(); save(bg, 'cenario', 'fundo_rua.png')

# ------------------------------------------------------------------ CENA DE EXEMPLO
scene = bg.copy()
rest = REST['restaurante']; scene.alpha_composite(rest, (104, 2))
scene.alpha_composite(REST['chapeiro_1'], (126, 26))
def draw_belt(x0, x1, y, f=0, legs=True):
    for x in range(x0, x1, 16):
        t = BELT[f'esteira_{f}']
        if x + 16 > x1: t = t.crop((0, 0, x1 - x, 8))
        scene.alpha_composite(t, (x, y))
    scene.alpha_composite(BELT[f'esteira_ponta_esq_{f}'], (x0 - 5, y))
    scene.alpha_composite(BELT[f'esteira_ponta_dir_{f}'], (x1 - 1, y))
# esteiras em zigue-zague: 1 → direita, 2 → esquerda, 3 → direita, 4 → esquerda
BELTS = [(166, 262, 58), (44, 276, 84), (30, 290, 110), (72, 300, 136)]
for (a, b, y) in BELTS:
    for lx in (a + 10, b - 14):
        for yy in range(y + 8, 176, 16): scene.alpha_composite(BELT['esteira_pe'], (lx, min(yy, 160)))
for i, (a, b, y) in enumerate(BELTS): draw_belt(a, b, y, i % 4)
scene.alpha_composite(BELT['desvio_desce'], (262, 46)); scene.alpha_composite(BELT['desvio_rua'], (36, 72))
scene.alpha_composite(BELT['desvio_desce'], (290, 98))
for x, y, k in [(190, 47, 'caixa'), (240, 47, 'pizza'), (120, 73, 'turbo'), (200, 73, 'sacola'), (90, 99, 'bomba_0'), (160, 99, 'caixa'), (250, 125, 'grau'), (140, 125, 'caixa')]:
    scene.alpha_composite(BOX[k], (x, y))
scene.alpha_composite(BOX['dobro'], (26, 120))
scene.alpha_composite(FX['brilho_1'], (24, 106))
scene.alpha_composite(DOG['cachorro_grau_0'], (14, 144))
scene.alpha_composite(FX['poeira_1'], (6, 178))
scene.alpha_composite(FX['caixa_amassada'], (230, 176))
for i in range(3): scene.alpha_composite(HUD['coracao_cheio' if i < 2 else 'coracao_vazio'], (6 + i*9, 6))
save(scene, 'cenario', 'cena_exemplo.png')

# spritesheet + atlas
keys = [k for k in saved if not k.startswith('cenario/')]
SW = 200; x = y = 2; rowh = 0; frames = {}
for k in keys:
    im = saved[k]
    if x + im.width + 2 > SW: x = 2; y += rowh + 2; rowh = 0
    frames[k[:-4]] = {'x': x, 'y': y, 'w': im.width, 'h': im.height}; x += im.width + 2; rowh = max(rowh, im.height)
sheet = new(SW, y + rowh + 2)
for k in keys: f = frames[k[:-4]]; sheet.alpha_composite(saved[k], (f['x'], f['y']))
sheet.save(P('spritesheet.png'))
json.dump({'meta': {'image': 'spritesheet.png', 'resolucao_base': [320, 200]}, 'frames': frames}, open(P('spritesheet.json'), 'w'), ensure_ascii=False, indent=1)

def up(im, s): return im.resize((im.width*s, im.height*s), Image.NEAREST)
up(scene, 3).save(P('_rev_scene.png'))
# prancha de revisão dos sprites
rev = new(560, 260); xx = 4
for k in ['cachorro_0','cachorro_1','cachorro_turbo_0','cachorro_grau_0','cachorro_tonto']:
    rev.alpha_composite(up(DOG[k], 3), (xx, 4)); xx += 124
xx = 4
for k in BOX: rev.alpha_composite(up(BOX[k], 4), (xx, 110)); xx += 52
xx = 4
for k in list(FX) + ['chapeiro_0', 'chapeiro_1']:
    im = FX.get(k) or REST[k]; rev.alpha_composite(up(im, 3), (xx, 180)); xx += max(40, im.width*3+6)
up(rev, 1).save(P('_rev_sprites.png'))
