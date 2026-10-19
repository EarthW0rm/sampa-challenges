"""Capacete Voador: céu, garoa, prédios modulares de SP, sol, vento e explosões.

Uso: python3 cenario_predios.py <pasta-de-saida>
Também gera os sprites antigos de gorila/banana/coxinha (não usados mais) e uma cena de exemplo.
Copie para src/games/capacete-voador/assets/ só o que for usado: cenario/, predios/*/{topo,andares,base}.png,
predios/masp/masp.png e sprites/{sol_*,vento_*,explosao_*,cratera_mascara}.png.
"""
import os, math, random, json, sys
from PIL import Image, ImageDraw

OUT = sys.argv[1]
def P(*a):
    p = os.path.join(OUT, *a); os.makedirs(os.path.dirname(p), exist_ok=True); return p

def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), a)
def new(w, h): return Image.new('RGBA', (w, h), (0,0,0,0))
def from_map(rows, pal):
    w = max(len(r) for r in rows); im = new(w, len(rows)); px = im.load()
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != '.': px[x, y] = hexc(pal[c])
    return im
def rect(im, x0, y0, x1, y1, col):
    if x1 < x0 or y1 < y0: return
    ImageDraw.Draw(im).rectangle([x0, y0, x1, y1], fill=hexc(col) if isinstance(col, str) else col)
def put(im, x, y, col):
    if 0 <= x < im.width and 0 <= y < im.height: im.putpixel((x, y), hexc(col))

# ---------------- GORILA ----------------
GPAL = {'K':'#1b1220','B':'#6b3f26','H':'#8c5634','F':'#d8a06a'}
half = [
"........KKKK", ".......KHHHH", ".......KBBBB", ".......KFFFF",
".......KFKFF", ".......KFFFF", ".......KBFKK", "........KBBB",
".....KKKBBBB", "....KBBBBBBB", "....KBBBBFFB", "....KBBBFFFF",
"....KBBBFFFF", "....KBBBBFFF", "....KBBBBBBB", ".....KBBBBBB",
".....KBBBBBB", ".....KBBBBKK", "....KBBBBK..", "....KBBBBK..",
"...KBBBBBK..", "...KBBBBBK..", "..KBBBBBBK..", "..KKKKKKKK..",
]
body = [r + r[::-1] for r in half]
arm_down = [(9,1,"..K"),(10,1,".KB")] + [(r,1,"KBB") for r in range(11,17)] + [(17,1,"KFF"),(18,1,".KK")]
arm_up = [(0,1,"KKK"),(1,0,"KFFK"),(2,0,"KBBK"),(3,0,"KBBK"),(4,1,"KBBK"),(5,1,"KBBK"),
          (6,2,"KBBK"),(7,2,"KBBKK"),(8,3,"KBBB")]
def gorilla(left, right):
    rows = [list(r) for r in body]
    for (r, c, s) in left:
        for i, ch in enumerate(s):
            if ch != '.': rows[r][c+i] = ch
    for (r, c, s) in right:
        for i, ch in enumerate(s):
            if ch != '.': rows[r][23-(c+i)] = ch
    return from_map([''.join(r) for r in rows], GPAL)
G = {
 'gorila_parado': gorilla(arm_down, arm_down),
 'gorila_braco_esq': gorilla(arm_up, arm_down),
 'gorila_braco_dir': gorilla(arm_down, arm_up),
 'gorila_vitoria': gorilla(arm_up, arm_up),
}

# ---------------- PROJÉTEIS ----------------
banana = from_map([
"......SS", ".....NYN", ".....NYN", ".....NYN",
"....NYYN", "NNNNYYN.", ".NYYYN..", "..NNN...",
], {'S':'#5a3a14','N':'#8a6410','Y':'#f4d03f'})
BAN = [banana, banana.transpose(Image.ROTATE_270), banana.transpose(Image.ROTATE_180), banana.transpose(Image.ROTATE_90)]
coxinha = from_map([
"...DD...", "...DD...", "..KOOK..", "..KOLK..",
".KOOLOK.", "KOOOOLOK", "KOOOOOOK", ".KKKKKK.",
], {'D':'#8a4a1a','K':'#5a2a10','O':'#c9782c','L':'#eaa94f'})

# ---------------- EXPLOSÃO ----------------
def h01(x, y, s):
    v = math.sin(x*12.9898 + y*78.233 + s*37.719) * 43758.5453
    return v - math.floor(v)
def explosion(r, s, ring=False):
    im = new(16, 16)
    for y in range(16):
        for x in range(16):
            d = math.hypot(x-7.5, y-7.5) + (h01(x, y, s)-0.5)*1.6
            if d > r: continue
            f = d / r
            if ring:
                col = '#3d3340' if f < 0.45 else '#6e5f66' if f < 0.7 else '#e26b2a' if f < 0.88 else '#a8281e'
            else:
                col = '#fffbe6' if f < 0.35 else '#ffd84a' if f < 0.62 else '#f08a24' if f < 0.85 else '#c0392b'
            put(im, x, y, col)
    return im
EXP = [explosion(3.6, 1), explosion(6.2, 2), explosion(7.9, 3, ring=True)]
crater = new(16, 16)
for y in range(16):
    for x in range(16):
        if math.hypot(x-7.5, y-7.5) <= 7.2: crater.putpixel((x, y), (0,0,0,255))

# ---------------- SOL ----------------
def sun(shocked):
    im = new(24, 24)
    for y in range(24):
        for x in range(24):
            d = math.hypot(x-11.5, y-11.5)
            if d <= 6.6: put(im, x, y, '#ffd23f')
            elif d <= 7.6: put(im, x, y, '#d9901a')
    for ang in range(0, 360, 45):
        a = math.radians(ang)
        for rr in ([8.6, 9.6, 10.6] if ang % 90 == 0 else [8.6, 9.6]):
            put(im, round(11.5 + math.cos(a)*rr - 0.01), round(11.5 + math.sin(a)*rr - 0.01), '#ffd23f')
    E = '#6b3a00'
    for (x, y) in [(9,9),(9,10),(14,9),(14,10)]: put(im, x, y, E)
    if shocked:
        for (x, y) in [(11,13),(12,13),(10,14),(13,14),(10,15),(13,15),(11,16),(12,16)]: put(im, x, y, E)
        for (x, y) in [(8,7),(9,7),(14,7),(15,7)]: put(im, x, y, E)
    else:
        for (x, y) in [(8,13),(9,14),(10,15),(11,15),(12,15),(13,15),(14,14),(15,13)]: put(im, x, y, E)
    return im
SUN = {'sol_normal': sun(False), 'sol_assustado': sun(True)}

arrow = from_map([
"..........K.....", "..........KWK...", "KKKKKKKKKKKWWK..", "KWWWWWWWWWWWWWK.",
"KWWWWWWWWWWWWWK.", "KKKKKKKKKKKWWK..", "..........KWK...", "..........K.....",
], {'K':'#1b1220','W':'#f4efe2'})
WIND = {'vento_dir': arrow, 'vento_esq': arrow.transpose(Image.FLIP_LEFT_RIGHT)}

# ---------------- PRÉDIOS ----------------
LIT = '#ffd36b'
class B:
    def __init__(s, key, name, W, fh, top, floor, base, roof):
        s.key, s.name, s.W, s.fh, s.top, s.floor, s.base, s.roof = key, name, W, fh, top, floor, base, roof
    def build(s, n, seed=1):
        rng = random.Random(seed)
        t = s.top(); b = s.base()
        im = new(s.W, t.height + n*s.fh + b.height)
        im.alpha_composite(t, (0, 0))
        for i in range(n): im.alpha_composite(s.floor(rng, i), (0, t.height + i*s.fh))
        im.alpha_composite(b, (0, t.height + n*s.fh))
        return im

# Copan — faixas horizontais de brise, contorno ondulado
def copan_floor(rng, i):
    W = 48; im = new(W, 3); ins = [0,1,2,2,1,0][i % 6]
    rect(im, ins, 0, W-1-ins, 0, '#ece6d4'); rect(im, ins, 1, W-1-ins, 1, '#b3ab95')
    rect(im, ins, 2, W-1-ins, 2, '#3a3552')
    for x in range(ins+1, W-1-ins):
        if rng.random() < 0.13: put(im, x, 2, LIT)
    put(im, ins, 2, '#b3ab95'); put(im, W-1-ins, 2, '#b3ab95')
    return im
def copan_top():
    im = new(48, 6); rect(im, 10, 0, 10, 2, '#5b5666'); put(im, 10, 0, '#e84a3a')
    rect(im, 30, 1, 37, 2, '#9a9383'); rect(im, 0, 3, 47, 3, '#f6f2e6'); rect(im, 0, 4, 47, 4, '#ece6d4'); rect(im, 0, 5, 47, 5, '#b3ab95')
    return im
def copan_base():
    im = new(48, 8); rect(im, 0, 0, 47, 1, '#b3ab95'); rect(im, 0, 2, 47, 7, '#2a2533')
    for x in range(1, 47, 6): rect(im, x, 2, x+1, 7, '#cfc8b6')
    for x in range(4, 44, 6): rect(im, x, 4, x+2, 6, '#f2b45a')
    return im

# Edifício Itália — grade escura + Terraço iluminado + antena
def italia_floor(rng, i):
    W = 36; im = new(W, 4); rect(im, 0, 0, W-1, 0, '#7d776c'); rect(im, 0, 1, W-1, 3, '#5c574f')
    for x in range(2, W-2, 3):
        c = LIT if rng.random() < 0.18 else '#2b2d3b'; rect(im, x, 1, x+1, 3, c)
    rect(im, 0, 0, 0, 3, '#4a463f'); rect(im, W-1, 0, W-1, 3, '#4a463f')
    return im
def italia_top():
    im = new(36, 9)
    for y in range(0, 5): put(im, 27, y, '#f4efe2' if y % 2 else '#d63a2f')
    put(im, 27, 0, '#ff5a3c'); rect(im, 6, 3, 12, 4, '#4a463f')
    rect(im, 0, 5, 35, 5, '#c9c2b2'); rect(im, 0, 6, 35, 7, '#ffcf73')
    for x in range(0, 36, 4): rect(im, x, 6, x, 7, '#6b5a3a')
    rect(im, 0, 8, 35, 8, '#7d776c')
    return im
def italia_base():
    im = new(36, 6); rect(im, 0, 0, 35, 5, '#3a3732'); rect(im, 14, 2, 21, 5, '#f2c46a'); rect(im, 17, 2, 18, 5, '#2b2620')
    return im

# Banespa (Altino Arantes) — topo escalonado e mastro
def banespa_rows(im, x0, x1, y0, y1, rng=None):
    for x in range(x0, x1+1):
        pil = (x - x0) % 4 in (0, 3)
        rect(im, x, y0, x, y1, '#e3d1a6' if pil else '#b89f6e')
    for y in range(y0, y1+1):
        if (y - y0) % 4 in (1, 2):
            for x in range(x0, x1+1):
                if (x - x0) % 4 in (1, 2):
                    put(im, x, y, LIT if rng and rng.random() < 0.15 else '#3b3a48')
def banespa_floor(rng, i):
    im = new(40, 4); banespa_rows(im, 0, 39, 0, 3, rng); return im
def banespa_top():
    im = new(40, 27); r = random.Random(7)
    put(im, 20, 0, '#ff3b2f'); rect(im, 20, 1, 20, 4, '#8a8a90')
    banespa_rows(im, 18, 22, 5, 7, r); banespa_rows(im, 14, 26, 8, 13, r)
    banespa_rows(im, 9, 31, 14, 19, r); banespa_rows(im, 4, 35, 20, 25, r)
    for (x0, x1, y) in [(18,22,5),(14,26,8),(9,31,14),(4,35,20),(0,39,26)]: rect(im, x0, y, x1, y, '#f3e6c6')
    return im
def banespa_base():
    im = new(40, 6); rect(im, 0, 0, 39, 5, '#a88d5c'); rect(im, 0, 0, 39, 0, '#f3e6c6')
    for x in (6, 17, 28): rect(im, x, 2, x+5, 5, '#3b2f22'); rect(im, x+1, 3, x+4, 5, '#f2b45a')
    return im

# Martinelli — salmão, cornijas e palacete no topo
def martinelli_floor(rng, i):
    W = 40; im = new(W, 5); rect(im, 0, 0, W-1, 4, '#d98c6a'); rect(im, 0, 0, W-1, 0, '#f0d9bc')
    for x in range(2, W-2, 5):
        c = LIT if rng.random() < 0.15 else '#3d2a2e'
        rect(im, x, 2, x+1, 3, c); rect(im, x, 1, x+1, 1, '#8a4b3a')
    rect(im, 0, 0, 0, 4, '#a85f45'); rect(im, W-1, 0, W-1, 4, '#a85f45')
    return im
def martinelli_top():
    im = new(40, 11)
    rect(im, 18, 0, 21, 0, '#8e3b2c'); rect(im, 16, 1, 23, 1, '#8e3b2c'); rect(im, 14, 2, 25, 2, '#8e3b2c')
    rect(im, 14, 3, 25, 7, '#f0d9bc')
    for x in (16, 19, 22): rect(im, x, 4, x+1, 6, '#3d2a2e')
    put(im, 19, 5, LIT)
    rect(im, 0, 8, 39, 8, '#f6e6cf'); rect(im, 0, 9, 39, 9, '#f0d9bc'); rect(im, 0, 10, 39, 10, '#a85f45')
    return im
def martinelli_base():
    im = new(40, 7); rect(im, 0, 0, 39, 6, '#c47a5a'); rect(im, 0, 0, 39, 0, '#f0d9bc')
    for x in range(2, 38, 6):
        rect(im, x, 3, x+3, 6, '#2e2224'); rect(im, x+1, 2, x+2, 2, '#2e2224'); rect(im, x+1, 4, x+2, 6, '#f2b45a')
    return im

# Predinho pichado — caixa d'água + pixação
GLYPHS = [["K.K","K.K","KKK","K..","K..","K.."], ["KKK","..K",".K.","K..","KKK","..."],
          ["K..","K.K","KK.","K.K","K..","K.."], ["KKK","K.K","KKK","K.K","K.K","K.K"],
          ["K.K","K.K","K.K",".K.",".K.",".K."], ["KK.","K.K","K.K","KK.","K.K","KK."]]
def predinho_floor(rng, i):
    W = 32; im = new(W, 5); rect(im, 0, 0, W-1, 4, '#a7a49c')
    for x0 in (2, 10, 18, 26):
        if x0 + 4 > W - 1: continue
        rect(im, x0, 1, x0+4, 3, '#3b3b44')
        c = LIT if rng.random() < 0.25 else '#2a2a33'; rect(im, x0+1, 1, x0+3, 3, c)
        put(im, x0+2, 1, '#3b3b44'); put(im, x0+2, 3, '#3b3b44')
    for x in range(W):
        if rng.random() < 0.06: put(im, x, 4, '#86837a')
    rect(im, 0, 0, 0, 4, '#86837a'); rect(im, W-1, 0, W-1, 4, '#86837a')
    return im
def predinho_top():
    im = new(32, 14)
    rect(im, 20, 0, 27, 4, '#2c5f8c'); rect(im, 21, 1, 26, 3, '#3d7fb5'); rect(im, 21, 5, 21, 5, '#555555'); rect(im, 26, 5, 26, 5, '#555555')
    rect(im, 0, 6, 31, 6, '#cfccc4'); rect(im, 0, 7, 31, 13, '#b9b6ad')
    r = random.Random(11); x = 1
    while x + 3 <= 31:
        g = GLYPHS[r.randrange(len(GLYPHS))]
        for gy, row in enumerate(g):
            for gx, ch in enumerate(row):
                if ch == 'K': put(im, x+gx, 7+gy, '#141414')
        x += 4
    return im
def predinho_base():
    im = new(32, 6); rect(im, 0, 0, 31, 5, '#8f8c84')
    rect(im, 2, 1, 13, 5, '#4d4d52')
    for x in range(2, 14, 2): rect(im, x, 1, x, 5, '#6a6a70')
    rect(im, 18, 2, 28, 5, '#2a2a33'); rect(im, 19, 3, 27, 5, '#f2b45a')
    return im

# Faria Lima — torre de vidro corporativa
def farialima_floor(rng, i):
    W = 36; im = new(W, 3); rect(im, 0, 0, W-1, 1, '#2f5f8f'); rect(im, 0, 2, W-1, 2, '#1f3b5a')
    rect(im, 22, 0, 24, 1, '#6fa3cf'); rect(im, 26, 0, 26, 1, '#4f86ba')
    for x in range(1, W-1, 2):
        if rng.random() < 0.08: rect(im, x, 0, x, 1, '#dff1ff')
    rect(im, 0, 0, 0, 2, '#1a2f47'); rect(im, W-1, 0, W-1, 2, '#1a2f47')
    return im
def farialima_top():
    im = new(36, 6); put(im, 8, 0, '#ff3b2f'); rect(im, 8, 1, 8, 2, '#8a8a90')
    rect(im, 0, 3, 35, 3, '#9cc3e6'); rect(im, 0, 4, 35, 5, '#4b7fb0')
    return im
def farialima_base():
    im = new(36, 6); rect(im, 0, 0, 35, 0, '#9cc3e6'); rect(im, 0, 1, 35, 5, '#1f2b3a')
    rect(im, 3, 2, 32, 5, '#e9f2f7'); [rect(im, x, 2, x, 5, '#1f2b3a') for x in range(7, 33, 5)]
    return im

BUILDINGS = [
 B('copan', 'Edifício Copan', 48, 3, copan_top, copan_floor, copan_base, 3),
 B('italia', 'Edifício Itália', 36, 4, italia_top, italia_floor, italia_base, 5),
 B('banespa', 'Edifício Altino Arantes (Banespa)', 40, 4, banespa_top, banespa_floor, banespa_base, 5),
 B('martinelli', 'Edifício Martinelli', 40, 5, martinelli_top, martinelli_floor, martinelli_base, 0),
 B('predinho', 'Predinho pichado', 32, 5, predinho_top, predinho_floor, predinho_base, 6),
 B('farialima', 'Torre Faria Lima', 36, 3, farialima_top, farialima_floor, farialima_base, 3),
]
def masp():
    im = new(56, 30)
    rect(im, 4, 4, 51, 15, '#2f3a48')
    for x in range(4, 52, 4): rect(im, x, 4, x, 15, '#4a5a6e')
    rect(im, 4, 7, 51, 7, '#4a5a6e'); rect(im, 4, 11, 51, 11, '#4a5a6e')
    rect(im, 10, 5, 13, 6, '#7f97b3'); rect(im, 30, 8, 33, 10, LIT)
    rect(im, 0, 0, 55, 2, '#d42a2a'); rect(im, 0, 3, 55, 3, '#9e1c1c')
    rect(im, 0, 0, 3, 27, '#d42a2a'); rect(im, 52, 0, 55, 27, '#d42a2a')
    rect(im, 3, 4, 3, 27, '#9e1c1c'); rect(im, 55, 4, 55, 27, '#9e1c1c')
    rect(im, 0, 16, 55, 16, '#d42a2a'); rect(im, 0, 17, 55, 17, '#9e1c1c')
    rect(im, 0, 28, 55, 29, '#9a968c')
    return im

# ---------------- CENÁRIO ----------------
BAYER = [[0,8,2,10],[12,4,14,6],[3,11,1,9],[15,7,13,5]]
STOPS = [(0,'#1b1638'),(40,'#2e1f4f'),(80,'#5a2c64'),(115,'#8f3a62'),(145,'#c4555a'),(170,'#e98a55'),(200,'#f5b860')]
def sky(s=1):
    """Céu com `s` = fator de resolução (1 = 320x200, 2 = 640x400)."""
    W_, H_ = 320 * s, 200 * s
    im = new(W_, H_); px = im.load()
    for y in range(H_):
        yy0 = y / s
        for i in range(len(STOPS)-1):
            if STOPS[i][0] <= yy0 < STOPS[i+1][0] or (i == len(STOPS)-2): break
        y0, c0 = STOPS[i]; y1, c1 = STOPS[i+1]; t = (yy0 - y0) / (y1 - y0)
        for x in range(W_):
            px[x, y] = hexc(c1 if t*16 > BAYER[y % 4][x % 4] + 0.5 else c0)
    r = random.Random(3)
    for _ in range(40 * s * s):
        x, y = r.randrange(W_), r.randrange(70 * s); put(im, x, y, '#f4efe2' if r.random() < .5 else '#a99cc9')
    # silhueta distante
    x = 0
    while x < W_:
        w = r.randrange(6 * s, 16 * s); h = r.randrange(24 * s, 70 * s)
        rect(im, x, H_-h, x+w-1, H_-1, '#3a2547')
        for yy in range(H_-h+2, H_-1, 3):
            for xx in range(x+1, x+w-1, 2):
                if r.random() < 0.08: put(im, xx, yy, '#e7a35c')
        x += w
    for mx, mh in [(70, 98), (84, 92), (205, 104)] if s == 1 else [(120, 98), (150, 92), (250, 104), (390, 100), (450, 90), (530, 106)]:   # antenas da Paulista
        mx, mh = (mx, mh) if s == 1 else (mx, mh * 2)
        for yy in range(H_-mh, H_-60*s):
            put(im, mx, yy, '#f4efe2' if (yy // (3*s)) % 2 else '#d63a2f')
        put(im, mx, H_-mh-1, '#ff5a3c')
    return im
def garoa(s=1):
    W_, H_ = 320 * s, 200 * s
    im = new(W_, H_); r = random.Random(5)
    for _ in range(260 * s * s):
        x, y = r.randrange(W_), r.randrange(H_)
        for k in range(r.choice([2, 3]) * (1 if s == 1 else 2)):
            if 0 <= x-k < W_ and 0 <= y+k < H_: im.putpixel((x-k, y+k), (201, 214, 232, 150))
    return im

# ---------------- SAÍDA ----------------
names = {}
def save(im, *path):
    p = P(*path); im.save(p); names['/'.join(path)] = im; return p
for k, v in G.items(): save(v, 'sprites', k + '.png')
for i, b in enumerate(BAN): save(b, 'sprites', f'banana_{i}.png')
save(coxinha, 'sprites', 'coxinha.png')
for i, e in enumerate(EXP): save(e, 'sprites', f'explosao_{i}.png')
save(crater, 'sprites', 'cratera_mascara.png')
for k, v in SUN.items(): save(v, 'sprites', k + '.png')
for k, v in WIND.items(): save(v, 'sprites', k + '.png')

PREVIEW_FLOORS = {'copan': 18, 'italia': 22, 'banespa': 12, 'martinelli': 12, 'predinho': 9, 'farialima': 24}
meta = {}
for b in BUILDINGS:
    save(b.top(), 'predios', b.key, 'topo.png')
    save(b.floor(random.Random(2), 0), 'predios', b.key, 'andar.png')
    rs = random.Random(21); strip = new(b.W, b.fh*12)
    for i in range(12): strip.alpha_composite(b.floor(rs, i), (0, i*b.fh))
    save(strip, 'predios', b.key, 'andares.png')
    save(b.base(), 'predios', b.key, 'base.png')
    pv = b.build(PREVIEW_FLOORS[b.key], seed=4); save(pv, 'predios', b.key, 'preview.png')
    meta[b.key] = {'nome': b.name, 'largura': b.W, 'altura_andar': b.fh, 'altura_topo': b.top().height,
                   'altura_base': b.base().height, 'linha_telhado': b.roof, 'preview_px': list(pv.size)}
save(masp(), 'predios', 'masp', 'masp.png')
meta['masp'] = {'nome': 'MASP', 'largura': 56, 'altura_fixa': 30, 'linha_telhado': 0}

bg = sky(); save(sky(2), 'cenario', 'ceu_fundo.png'); gr = garoa(); save(garoa(2), 'cenario', 'garoa.png')  # campo 640x400

# cena de exemplo 320x200
scene = bg.copy()
bb = {b.key: b for b in BUILDINGS}
layout = [('predinho', 8), ('copan', 16), ('italia', 21), ('masp', 0), ('martinelli', 10), ('banespa', 9), ('farialima', 20), ('predinho', 6)]
x = 0; tops = []
for key, n in layout:
    im = masp() if key == 'masp' else bb[key].build(n, seed=x+1)
    roof = 0 if key == 'masp' else bb[key].roof
    scene.alpha_composite(im, (x, 200 - im.height)); tops.append((x, im.width, 200 - im.height + roof)); x += im.width
scene.alpha_composite(SUN['sol_normal'], (148, 4))
g1x, g1w, g1y = tops[1]; g2x, g2w, g2y = tops[6]
p1 = (g1x + g1w//2 - 12, g1y - 24); p2 = (g2x + g2w//2 - 12, g2y - 24)
scene.alpha_composite(G['gorila_braco_esq'], p1); scene.alpha_composite(G['gorila_parado'], p2)
sx, sy = p1[0] + 6, p1[1] - 2
for t in range(0, 24, 2):
    px_ = sx + t * 2.6; py_ = sy - t * 3.4 + 0.11 * t * t
    put(scene, round(px_), round(py_), '#f4efe2')
scene.alpha_composite(BAN[1], (round(sx + 26*2.6) - 4, round(sy - 26*3.4 + 0.11*26*26) - 4))
save(scene, 'cenario', 'cena_exemplo.png')

# spritesheet + atlas
sprite_keys = [k for k in names if k.startswith('sprites/')]
pad = 2; sx = pad; sy = pad; rowh = 0; frames = {}; SW = 160
for k in sprite_keys:
    im = names[k]
    if sx + im.width + pad > SW: sx = pad; sy += rowh + pad; rowh = 0
    frames[k.split('/')[1][:-4]] = {'x': sx, 'y': sy, 'w': im.width, 'h': im.height, 'img': im}
    sx += im.width + pad; rowh = max(rowh, im.height)
sheet = new(SW, sy + rowh + pad)
for f in frames.values(): sheet.alpha_composite(f.pop('img'), (f['x'], f['y']))
sheet.save(P('spritesheet.png'))
json.dump({'meta': {'image': 'spritesheet.png', 'size': {'w': sheet.width, 'h': sheet.height}, 'escala_nativa': '1px', 'resolucao_base': [320, 200]},
           'frames': frames, 'predios': meta}, open(P('spritesheet.json'), 'w'), ensure_ascii=False, indent=2)

# prancha de revisão em 4x
def up(im, s): return im.resize((im.width*s, im.height*s), Image.NEAREST)
up(scene, 3).save(P('_review_scene.png')); up(sheet, 5).save(P('_review_sheet.png'))
print(json.dumps(meta, ensure_ascii=False))
