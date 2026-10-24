"""Pastel de Feira: cenário da feira, pisos, equipamentos, pastéis por estado, ícones e capa.

Uso: python3 pastel_de_feira.py <pasta-de-saida>      (normalmente ../../src/games/pastel-de-feira/assets)
Os PNGs são 1× (o jogo aplica Scale2x). Cachorros ficam na biblioteca (`biblioteca/caes_pe.py`).
Não edite os PNGs à mão: mude este script e gere de novo.
"""
import os, sys, random
from PIL import Image
from biblioteca.prim import Pen, new, outline, INK

WOOD, WOOD_D, WOOD_L = '#8a5a33', '#5d3b21', '#b07a45'
RED, RED_D, CREAM = '#c8402f', '#8a2a20', '#f1e6d0'
METAL, METAL_D, METAL_L = '#8a8a90', '#5b5666', '#d6d4cc'
OIL, OIL_D = '#e0a020', '#a8701a'
OUT = '.'

def save(im, name):
    p = os.path.join(OUT, name + '.png'); os.makedirs(os.path.dirname(p) or '.', exist_ok=True); im.save(p); return p

# ---------- fundo (640×480) ----------
def fundo():
    im = new(640, 480); p = Pen(im); rnd = random.Random(7)
    p.rect(0, 0, 639, 479, '#2b2433')
    # céu do fim de tarde atrás das barracas vizinhas
    for y in range(0, 22):
        p.rect(0, y, 639, y, ['#f0b27a', '#eaa070', '#e08f68', '#d27e64'][min(3, y // 6)])
    # barracas vizinhas (silhuetas) e bandeirinhas
    for x0 in range(0, 640, 128):
        p.rect(x0 + 8, 6, x0 + 96, 21, '#6b4a3a'); p.rect(x0 + 8, 6, x0 + 96, 9, RED if (x0 // 128) % 2 else '#3d7fb5')
    for x in range(0, 640, 20):
        p.poly([(x, 0), (x + 10, 0), (x + 5, 7)], ['#ffd23f', '#3fa65a', '#d42a2a', '#3d7fb5'][(x // 20) % 4])
    # toldo
    for x in range(0, 640, 32):
        p.rect(x, 22, x + 31, 27, RED if (x // 32) % 2 == 0 else CREAM)
        p.rect(x, 28, x + 31, 29, RED_D if (x // 32) % 2 == 0 else '#c9b99a')
    # piso de feira (paralelepípedo escuro)
    for y in range(30, 480, 8):
        for x in range(0, 640, 16):
            off = 8 if (y // 8) % 2 else 0
            c = '#2f2838' if rnd.random() > .2 else '#342c3e'
            p.rect(x + off, y, x + off + 14, y + 6, c)
    return im

def piso(base, light, dark, seed, w=16, h=16):
    im = new(w, h); p = Pen(im); rnd = random.Random(seed)
    p.rect(0, 0, w - 1, h - 1, base)
    for _ in range(w):
        p.put(rnd.randrange(w), rnd.randrange(h), light if rnd.random() > .5 else dark)
    p.rect(0, h - 1, w - 1, h - 1, dark)
    return im

def piso_madeira():
    im = new(16, 16); p = Pen(im)
    for i, y in enumerate(range(0, 16, 4)):
        p.rect(0, y, 15, y + 2, WOOD if i % 2 else '#946036'); p.rect(0, y + 3, 15, y + 3, WOOD_D)
        p.put((i * 5 + 3) % 16, y + 1, WOOD_L)
    return im

# ---------- pastéis ----------
ESTADOS = {'cru': ('#e8d6b0', '#c9b080'), 'ponto': ('#e0a050', '#a8702a'), 'passado': ('#b8702a', '#7a4818'), 'queimado': ('#3a2a22', '#1b1220')}

def pastel(cat, estado):
    big = cat == 'especial'
    w, h = (20, 13) if big else (16, 11)
    im = new(w, h); p = Pen(im); f, d = ESTADOS[estado]
    p.ell(0, 0, w - 1, h * 2 - 2, f)
    p.clear_rect(0, h - 1, w - 1, h * 2)                       # só a metade de cima: meia-lua
    p.rect(1, h - 3, w - 2, h - 2, d)                          # base do pastel (borda do garfo)
    for x in range(1, w - 1, 2): p.put(x, h - 4, d)            # fecho
    p.rect(3, 2, w - 6, 2, '#ffffff' if estado == 'cru' else f)   # brilho
    if estado == 'ponto': p.rect(4, 2, 7, 2, '#ffd278')
    if cat == 'doce' and estado != 'queimado':
        for x, y in ((5, 4), (8, 3), (11, 5)): p.put(x, y, '#ffffff'); p.put(x + 1, y + 1, '#ff9cb0')
    if big and estado != 'queimado':
        p.put(7, 4, '#2d6a2d'); p.put(8, 4, '#2d6a2d'); p.rect(11, 3, 13, 4, '#ffd23f')
    if estado == 'queimado':
        for x, y in ((4, 3), (9, 5), (12, 3)): p.put(x, y, '#6b6b73')
    return outline(im)

def copo():
    im = new(10, 14); p = Pen(im)
    p.poly([(1, 0), (8, 0), (7, 12), (2, 12)], '#e8f4f0'); p.poly([(2, 3), (7, 3), (7, 11), (3, 11)], '#9bd96b')
    p.rect(2, 3, 7, 4, '#c8f08a'); p.rect(5, 0, 6, 2, '#2d6a2d')       # canudo
    return outline(im)

def moeda():
    im = new(9, 9); p = Pen(im); p.disc(4, 4, 3, '#ffd23f'); p.rect(3, 3, 5, 3, '#fff0a0'); p.rect(3, 6, 5, 6, '#d9901a'); p.rect(4, 3, 4, 6, '#d9901a')
    return outline(im)

# ---------- equipamentos ----------
def tacho(baskets=4):
    w, h = 44, 30
    im = new(w, h); p = Pen(im)
    p.rrect(0, 6, w - 1, h - 1, 3, METAL_D); p.rect(2, 8, w - 3, 12, OIL); p.rect(2, 12, w - 3, 13, OIL_D)
    p.rect(0, 6, w - 1, 7, METAL_L); p.rect(4, h - 5, 9, h - 2, INK); p.rect(w - 10, h - 5, w - 5, h - 2, INK)
    for i in range(baskets):
        x = 4 + i * ((w - 12) // max(1, baskets - 1)) if baskets > 1 else 18
        p.rect(x, 0, x + 6, 9, METAL); p.rect(x + 1, 2, x + 5, 8, METAL_D); p.rect(x + 2, 0, x + 4, 1, INK)
    return outline(im)

def estufa():
    im = new(40, 28); p = Pen(im)
    p.rect(0, 0, 39, 27, METAL); p.rect(0, 22, 39, 27, METAL_D); p.rect(3, 3, 36, 18, '#2f4a52'); p.rect(3, 3, 36, 5, '#4f7a85')
    for x in (8, 18, 28): p.rect(x, 9, x + 6, 13, '#e0a050')
    p.rect(14, 22, 25, 23, '#ff8a2a')
    return outline(im)

def moenda(tipo):
    im = new(32, 36); p = Pen(im)
    p.rect(4, 14, 27, 33, METAL_D); p.rect(4, 14, 27, 16, METAL_L); p.rect(10, 4, 21, 14, METAL)
    p.rect(12, 6, 19, 12, '#2d6a2d')                                   # cana
    p.rect(2, 18, 6, 20, '#8a8a90'); p.rect(0, 20, 3, 28, '#8a8a90')   # manivela
    if tipo == 'manual': p.disc(2, 29, 3, WOOD)
    if tipo == 'motor': p.rect(22, 20, 30, 30, '#3d7fb5'); p.rect(23, 21, 29, 22, '#7fb3dd')
    if tipo == 'auto': p.rect(22, 20, 30, 30, '#3fa65a'); p.put(26, 25, '#ffffff'); p.rect(25, 24, 27, 26, '#ffffff')
    return outline(im)

def caixa_termica():
    im = new(28, 24); p = Pen(im)
    p.rect(0, 4, 27, 23, '#3d7fb5'); p.rect(0, 0, 27, 6, '#7fb3dd'); p.rect(0, 22, 27, 23, '#2c5f8c'); p.rect(11, 8, 16, 10, '#ffffff')
    return outline(im)

def mesa():
    im = new(48, 28); p = Pen(im)
    p.rect(0, 0, 47, 12, WOOD_L); p.rect(0, 10, 47, 13, WOOD_D); p.rect(4, 13, 7, 26, WOOD_D); p.rect(40, 13, 43, 26, WOOD_D)
    p.rect(14, 3, 20, 7, '#f4efe2'); p.rect(30, 3, 36, 7, '#d42a2a')   # guardanapo e molho
    return outline(im)

def maquininha():
    im = new(12, 16); p = Pen(im); p.rect(0, 0, 11, 15, '#3b3a48'); p.rect(2, 2, 9, 5, '#9bd96b')
    for y in (8, 11): 
        for x in (2, 5, 8): p.put(x, y, METAL_L)
    return outline(im)

# ---------- ícones ----------
def icone(kind):
    im = new(14, 14); p = Pen(im)
    if kind == 'fiscal': p.rect(2, 1, 11, 12, '#f4efe2'); p.rect(4, 3, 9, 3, '#3d7fb5'); p.rect(4, 6, 9, 6, '#8a8a90'); p.rect(4, 9, 7, 9, '#8a8a90'); p.disc(10, 10, 2, '#d42a2a')
    elif kind == 'energia': p.poly([(8, 0), (2, 8), (6, 8), (4, 13), (11, 5), (7, 5)], '#ffd23f')
    elif kind == 'excursao': p.rect(1, 3, 12, 9, '#ffd23f'); p.rect(2, 4, 11, 5, '#3d7fb5'); p.disc(4, 10, 2, INK); p.disc(10, 10, 2, INK)
    elif kind == 'fogo': p.poly([(7, 0), (3, 6), (4, 12), (10, 12), (11, 6), (8, 4)], '#ff8a2a'); p.poly([(7, 5), (5, 10), (6, 12), (9, 12), (9, 9)], '#ffd23f')
    elif kind == 'queimado': p.disc(7, 5, 3, '#c9915a'); p.rect(3, 9, 11, 12, '#d42a2a'); p.put(6, 4, INK); p.put(9, 4, INK)
    elif kind == 'chuva': p.rect(2, 2, 11, 6, '#8a8a90'); [p.rect(3 + i * 3, 8, 3 + i * 3, 11, '#7fb3dd') for i in range(4)]
    elif kind == 'calor': p.disc(7, 7, 4, '#ffd23f'); [p.put(7 + dx, 7 + dy, '#ff8a2a') for dx, dy in ((0, -6), (0, 6), (-6, 0), (6, 0))]
    return outline(im)

def perfil(kind):
    c = {'economico': '#6fcf6f', 'padrao': '#5aa7e8', 'exigente': '#d9503f'}[kind]
    im = new(12, 6); p = Pen(im); p.rect(0, 0, 11, 5, c); p.rect(0, 4, 11, 5, '#00000040' if False else INK)
    return im

def placa_xepa():
    im = new(60, 24); p = Pen(im); p.rect(0, 0, 59, 23, '#d42a2a'); p.rect(2, 2, 57, 21, '#f4efe2'); p.rect(4, 4, 55, 19, '#d42a2a')
    p.rect(6, 0, 7, 2, WOOD_D); p.rect(52, 0, 53, 2, WOOD_D)
    return outline(im)

# ---------- capa 320×200 ----------
def capa():
    im = new(320, 200); p = Pen(im)
    for y in range(200): p.rect(0, y, 319, y, ['#f0b27a', '#e8946a', '#d27e64', '#8a5a7a'][min(3, y // 22)] if y < 90 else '#2b2433')
    for x in range(0, 320, 16): p.poly([(x, 0), (x + 8, 0), (x + 4, 8)], ['#ffd23f', '#3fa65a', '#d42a2a', '#3d7fb5'][(x // 16) % 4])
    for x in range(0, 320, 32):                                       # toldo
        p.rect(x, 20, x + 31, 38, RED if (x // 32) % 2 == 0 else CREAM)
    for x in range(0, 320, 32): p.rect(x, 38, x + 31, 41, RED_D if (x // 32) % 2 == 0 else '#c9b99a')
    p.rect(30, 110, 290, 150, WOOD); p.rect(30, 110, 290, 114, WOOD_L); p.rect(30, 146, 290, 150, WOOD_D)   # balcão
    p.rect(30, 150, 290, 199, WOOD_D)
    for x in range(0, 320, 16): p.rect(x, 168, x + 14, 174, '#342c3e')
    # tacho com pastéis
    im.alpha_composite(tacho(4).resize((88, 60), Image.NEAREST), (116, 70))
    im.alpha_composite(pastel('especial', 'ponto').resize((60, 39), Image.NEAREST), (50, 82))
    im.alpha_composite(pastel('salgado', 'ponto').resize((48, 33), Image.NEAREST), (230, 90))
    im.alpha_composite(copo().resize((30, 42), Image.NEAREST), (200, 86))
    return im

def main():
    global OUT
    OUT = sys.argv[1] if len(sys.argv) > 1 else '.'
    save(fundo(), 'cenario/fundo')
    for n, im in [('madeira', piso_madeira()), ('fila', piso('#352c42', '#403650', '#2a2234', 3)), ('mesas', piso('#4a3a2a', '#5a4836', '#3a2c20', 4)),
                  ('metal', piso('#3b3a48', '#4a4958', '#2c2b38', 5))]: save(im, f'cenario/piso_{n}')
    for c in ('salgado', 'doce', 'especial'):
        for e in ESTADOS: save(pastel(c, e), f'itens/pastel_{c}_{e}')
    save(copo(), 'itens/copo'); save(moeda(), 'itens/moeda')
    for b in (1, 2, 4): save(tacho(b), f'equip/tacho_{b}')
    save(estufa(), 'equip/estufa')
    for t in ('manual', 'motor', 'auto'): save(moenda(t), f'equip/moenda_{t}')
    save(caixa_termica(), 'equip/caixa_termica'); save(mesa(), 'equip/mesa'); save(maquininha(), 'equip/maquininha')
    for k in ('fiscal', 'energia', 'excursao', 'fogo', 'queimado', 'chuva', 'calor'): save(icone(k), f'icones/{k}')
    for k in ('economico', 'padrao', 'exigente'): save(perfil(k), f'icones/perfil_{k}')
    save(placa_xepa(), 'icones/placa_xepa')
    save(capa(), 'capa')

if __name__ == '__main__': main()
