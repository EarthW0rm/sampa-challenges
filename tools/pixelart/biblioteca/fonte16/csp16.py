"""Desenho 1× (16 bits) original, copiado de corredor_sp.py sem alterações de arte. Usado pela biblioteca,
que amplia com Scale2x (ver prim.scale2x). Não edite o desenho aqui sem regerar a biblioteca."""

"""Corredor SP: motoboys vistos de trás, trânsito, cenário das avenidas, itens e céus.

Uso: python3 corredor_sp.py <pasta-de-saida>
Saída na estrutura de src/games/corredor-sp/assets/.
As motos são desenhadas com cores-chave (magenta) que o jogo troca pela cor escolhida.
"""
import os, math, random, sys
from PIL import Image, ImageDraw

OUT = '.'
def P(*a):
    p = os.path.join(OUT, *a); os.makedirs(os.path.dirname(p), exist_ok=True); return p
def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2],16), int(h[2:4],16), int(h[4:6],16), a)
def new(w, h): return Image.new('RGBA', (w, h), (0,0,0,0))
def rect(im, x0, y0, x1, y1, col):
    if x1 < x0 or y1 < y0: return
    ImageDraw.Draw(im).rectangle([x0, y0, x1, y1], fill=hexc(col) if isinstance(col, str) else col)
def put(im, x, y, col):
    if 0 <= x < im.width and 0 <= y < im.height: im.putpixel((x, y), hexc(col) if isinstance(col, str) else col)
def disc(im, cx, cy, rx, ry, col):
    for y in range(int(cy-ry-1), int(cy+ry+2)):
        for x in range(int(cx-rx-1), int(cx+rx+2)):
            if ((x-cx)/rx)**2 + ((y-cy)/ry)**2 <= 1: put(im, x, y, col)
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
def mirror(im): return im.transpose(Image.FLIP_LEFT_RIGHT)

INK = '#1b1220'
# cores-chave da moto (trocadas no jogo): base, sombra, brilho
MK, MKD, MKL = '#ff00ff', '#b000b0', '#ff9cff'

FONT = {
 'A':["###","#.#","###","#.#","#.#"],'B':["##.","#.#","##.","#.#","##."],'C':["###","#..","#..","#..","###"],
 'D':["##.","#.#","#.#","#.#","##."],'E':["###","#..","##.","#..","###"],'G':["###","#..","#.#","#.#","###"],
 'I':["###",".#.",".#.",".#.","###"],'K':["#.#","#.#","##.","#.#","#.#"],'L':["#..","#..","#..","#..","###"],
 'M':["#.#","###","###","#.#","#.#"],'N':["##.","#.#","#.#","#.#","#.#"],'O':["###","#.#","#.#","#.#","###"],
 'P':["###","#.#","###","#..","#.."],'R':["##.","#.#","##.","#.#","#.#"],'S':["###","#..","###","..#","###"],
 'T':["###",".#.",".#.",".#.",".#."],'U':["#.#","#.#","#.#","#.#","###"],'V':["#.#","#.#","#.#","#.#",".#."],
 'X':["#.#","#.#",".#.","#.#","#.#"],'Y':["#.#","#.#",".#.",".#.",".#."],'2':["###","..#","###","#..","###"],
 '3':["###","..#",".##","..#","###"],'1':[".#.","##.",".#.",".#.","###"],'0':["###","#.#","#.#","#.#","###"],
 ' ':["...","...","...","...","..."],'.':["...","...","...","...",".#."],'-':["...","...","###","...","..."],
 '!':[".#.",".#.",".#.","...",".#."],'H':["#.#","#.#","###","#.#","#.#"],'F':["###","#..","##.","#..","#.."],
 '4':["#.#","#.#","###","..#","..#"],'5':["###","#..","###","..#","###"],'6':["###","#..","###","#.#","###"],
 '7':["###","..#","..#",".#.",".#."],'8':["###","#.#","###","#.#","###"],'9':["###","#.#","###","..#","###"],
 ':':["...",".#.","...",".#.","..."],'/':["..#","..#",".#.","#..","#.."],'W':["#.#","#.#","###","###","#.#"],
 'J':["..#","..#","..#","#.#","###"],'Q':["###","#.#","#.#","###","..#"],'Z':["###","..#",".#.","#..","###"],
}
def text(im, s, x, y, col):
    for ch in s:
        g = FONT.get(ch, FONT[' '])
        for gy, row in enumerate(g):
            for gx, c in enumerate(row):
                if c == '#': put(im, x+gx, y+gy, col)
        x += 4
def text_w(s): return len(s) * 4 - 1

# =====================================================================
# MOTOBOYS VISTOS DE TRÁS (40×44)
# =====================================================================
BREEDS = {
    # pelo, sombra, detalhe (peito/patas), orelha
    'caramelo': dict(fur='#d9903f', furD='#9a5a22', furL='#f2c27a', ear='floppy'),
    'pitbull':  dict(fur='#8b8fa3', furD='#5d6175', furL='#f4efe2', ear='rose'),
    'pincher':  dict(fur='#3e3240', furD='#241c26', furL='#b8642a', ear='tall'),
    'collie':   dict(fur='#383046', furD='#221c2c', furL='#f4efe2', ear='tipped'),
}
HELMET, HELMET_D = '#f4efe2', '#b9b6ad'   # capacete branco; o visor fica na frente (não aparece)

def dog_back(im, b, ox=0, oy=0, torso=True):
    """Costas do cachorro: capacete, orelhas, pescoço, braços até o guidão."""
    c = BREEDS[b]
    # braços até as manoplas
    rect(im, 8+ox, 15+oy, 13+ox, 17+oy, c['fur']); rect(im, 26+ox, 15+oy, 31+ox, 17+oy, c['fur'])
    rect(im, 7+ox, 16+oy, 8+ox, 17+oy, c['furL']); rect(im, 31+ox, 16+oy, 32+ox, 17+oy, c['furL'])
    if torso:
        rect(im, 13+ox, 11+oy, 26+ox, 22+oy, c['fur']); rect(im, 13+ox, 20+oy, 26+ox, 22+oy, c['furD'])
    # nuca peluda + capacete só no alto da cabeça (assim dá para ver a raça)
    rect(im, 15+ox, 4+oy, 24+ox, 11+oy, c['fur']); rect(im, 15+ox, 10+oy, 24+ox, 11+oy, c['furD'])
    disc(im, 19.5+ox, 3.5+oy, 5.0, 3.6, HELMET); rect(im, 14+ox, 5+oy, 25+ox, 5+oy, HELMET_D)
    rect(im, 17+ox, 0+oy, 22+ox, 0+oy, '#ffffff')
    e = c['ear']
    if e == 'floppy':      # caramelo: orelhas caídas grandes
        rect(im, 11+ox, 4+oy, 14+ox, 11+oy, c['furD']); rect(im, 25+ox, 4+oy, 28+ox, 11+oy, c['furD'])
        rect(im, 12+ox, 5+oy, 13+ox, 9+oy, c['fur']); rect(im, 26+ox, 5+oy, 27+ox, 9+oy, c['fur'])
    elif e == 'rose':      # pitbull: cabeçona, orelhas pequenas dobradas, nuca larga
        rect(im, 13+ox, 6+oy, 26+ox, 11+oy, c['fur'])
        rect(im, 12+ox, 4+oy, 14+ox, 6+oy, c['furD']); rect(im, 25+ox, 4+oy, 27+ox, 6+oy, c['furD'])
    elif e == 'tall':      # pincher: orelhas em pé, bem altas, e cabecinha
        for i in range(6):
            rect(im, 13+ox, -1+oy+i, 14+ox, -1+oy+i, c['fur']); rect(im, 25+ox, -1+oy+i, 26+ox, -1+oy+i, c['fur'])
        rect(im, 13+ox, 1+oy, 13+ox, 3+oy, c['furL']); rect(im, 26+ox, 1+oy, 26+ox, 3+oy, c['furL'])
        rect(im, 16+ox, 9+oy, 23+ox, 11+oy, c['furL'])
    elif e == 'tipped':    # border collie: orelhas meio em pé com ponta branca, coleira branca
        rect(im, 12+ox, 1+oy, 14+ox, 6+oy, c['fur']); rect(im, 25+ox, 1+oy, 27+ox, 6+oy, c['fur'])
        rect(im, 12+ox, 1+oy, 13+ox, 2+oy, c['furL']); rect(im, 26+ox, 1+oy, 27+ox, 2+oy, c['furL'])
        rect(im, 15+ox, 9+oy, 24+ox, 11+oy, c['furL']); rect(im, 19+ox, 5+oy, 20+ox, 8+oy, c['furL'])

def handlebar(im, y, x0=5, x1=34, mirrors=True):
    rect(im, x0+2, y, x1-2, y, '#5b5666')
    rect(im, x0, y, x0+2, y+1, INK); rect(im, x1-2, y, x1, y+1, INK)       # manoplas
    if mirrors:
        rect(im, x0+3, y-4, x0+3, y-1, '#8a8a90'); rect(im, x0+1, y-6, x0+4, y-4, '#2a2840')
        rect(im, x1-3, y-4, x1-3, y-1, '#8a8a90'); rect(im, x1-4, y-6, x1-1, y-4, '#2a2840')

def rider_150(b):
    """CêGezinha: moto pequena, pneu fino, baú vermelho clássico."""
    im = new(40, 44); oy = 6
    dog_back(im, b, oy=oy)
    handlebar(im, 15+oy)
    rect(im, 11, 12+oy, 28, 26+oy, MK); rect(im, 11, 25+oy, 28, 26+oy, MKD); rect(im, 11, 12+oy, 28, 12+oy, MKL)  # baú na cor da moto
    rect(im, 11, 15+oy, 28, 15+oy, '#f4efe2'); rect(im, 18, 18+oy, 21, 21+oy, '#f4efe2'); put(im, 19, 19+oy, MK); put(im, 20, 20+oy, MK)
    rect(im, 13, 27+oy, 26, 29+oy, '#3b3a48'); rect(im, 13, 29+oy, 26, 29+oy, '#22202c')  # rabeta
    rect(im, 17, 30+oy, 22, 30+oy, '#d42a2a')                                      # lanterna
    rect(im, 16, 31+oy, 23, 33+oy, '#e8e2d0'); rect(im, 17, 32+oy, 22, 32+oy, '#5b5666')  # placa
    rect(im, 26, 28+oy, 29, 29+oy, '#8a8a90')                                      # escapamento
    outline(im)
    rect(im, 17, 34+oy, 22, 37+oy, INK); rect(im, 18, 34+oy, 21, 36+oy, '#3b3a48')  # pneu
    return im

def rider_600(b):
    """Hornetão: esportiva, pneu largo, rabeta empinada, mochila térmica."""
    im = new(40, 44); oy = 6
    dog_back(im, b, oy=oy)
    handlebar(im, 15+oy, 6, 33)
    rect(im, 13, 11+oy, 26, 22+oy, '#ff8a2a'); rect(im, 13, 20+oy, 26, 22+oy, '#c9601a')  # mochila térmica
    rect(im, 13, 14+oy, 26, 14+oy, '#ffd23f'); rect(im, 16, 17+oy, 23, 17+oy, '#ffd23f')
    rect(im, 12, 23+oy, 27, 27+oy, MK); rect(im, 12, 26+oy, 27, 27+oy, MKD)        # tanque/laterais
    rect(im, 15, 22+oy, 24, 23+oy, MKL)
    rect(im, 11, 22+oy, 28, 24+oy, MK); rect(im, 14, 27+oy, 25, 29+oy, MK); rect(im, 17, 29+oy, 22, 29+oy, '#ff3b2f')  # rabeta + lanterna
    rect(im, 16, 30+oy, 23, 31+oy, '#e8e2d0'); rect(im, 17, 31+oy, 22, 31+oy, '#5b5666')
    rect(im, 10, 28+oy, 12, 31+oy, '#8a8a90'); rect(im, 27, 28+oy, 29, 31+oy, '#8a8a90')  # 2 escapes
    outline(im)
    rect(im, 15, 32+oy, 24, 37+oy, INK); rect(im, 16, 32+oy, 23, 35+oy, '#3b3a48')
    return im

def rider_1000(b):
    """Tratorzão: big trail, malas laterais e top case, guidão alto, pneu de cravo."""
    im = new(40, 44); oy = 6
    dog_back(im, b, oy=oy-1)
    handlebar(im, 13+oy, 4, 35)
    rect(im, 12, 13+oy, 27, 21+oy, MK); rect(im, 12, 20+oy, 27, 21+oy, MKD); rect(im, 12, 13+oy, 27, 13+oy, MKL); rect(im, 12, 16+oy, 27, 16+oy, '#5b5666')  # top case
    rect(im, 1, 19+oy, 10, 30+oy, '#b9b6ad'); rect(im, 29, 19+oy, 38, 30+oy, '#b9b6ad')                # malas laterais
    rect(im, 1, 29+oy, 10, 30+oy, '#8a8a90'); rect(im, 29, 29+oy, 38, 30+oy, '#8a8a90')
    rect(im, 3, 21+oy, 8, 21+oy, '#5b5666'); rect(im, 31, 21+oy, 36, 21+oy, '#5b5666')
    rect(im, 11, 22+oy, 28, 27+oy, MK); rect(im, 11, 26+oy, 28, 27+oy, MKD); rect(im, 13, 22+oy, 26, 22+oy, MKL)
    rect(im, 16, 28+oy, 23, 28+oy, '#ff3b2f'); rect(im, 16, 29+oy, 23, 31+oy, '#e8e2d0'); rect(im, 17, 30+oy, 22, 30+oy, '#5b5666')
    outline(im)
    rect(im, 15, 32+oy, 24, 37+oy, INK); rect(im, 16, 32+oy, 23, 36+oy, '#3b3a48')
    for y in range(33+oy, 37+oy, 2): put(im, 15, y, '#5b5666'); put(im, 24, y, '#5b5666')        # cravos
    return im

RIDERS = {'150': rider_150, '600': rider_600, '1000': rider_1000}

def rotate(im, ang, pivot):
    big = im.resize((im.width*4, im.height*4), Image.NEAREST)
    r = big.rotate(ang, resample=Image.NEAREST, center=(pivot[0]*4, pivot[1]*4))
    return r.resize(im.size, Image.NEAREST)

def grau(im):
    """De trás, empinar = a moto sobe e a roda da frente aparece acima do capacete."""
    out = new(40, 44)
    out.alpha_composite(im.crop((0, 0, 40, 38)), (0, -3))
    out.alpha_composite(im.crop((0, 38, 40, 44)), (0, 38))     # pneu continua no chão
    rect(out, 16, 35, 23, 37, INK); rect(out, 17, 35, 22, 37, '#3b3a48')
    disc(out, 19.5, 2.5, 3.2, 2.2, INK); disc(out, 19.5, 2.5, 2, 1.2, '#3b3a48')  # roda da frente no alto
    return out

def crash(im):
    """Moto deitada (quadro 48×44): gira 80° e encaixa pela base."""
    big = im.resize((im.width*4, im.height*4), Image.NEAREST).rotate(-80, resample=Image.NEAREST, expand=True)
    small = big.resize((big.width//4, big.height//4), Image.NEAREST)
    bb = small.getbbox(); small = small.crop(bb)
    out = new(48, 44); out.alpha_composite(small, ((48 - small.width)//2, 44 - small.height))
    return out

# =====================================================================
# ITENS (16×16) E HUD
# =====================================================================
def item_box(body, dark, icon):
    im = new(16, 16)
    rect(im, 0, 1, 15, 15, INK); rect(im, 1, 2, 14, 14, body); rect(im, 1, 12, 14, 14, dark)
    icon(im); return im
def ic_pacote(im):
    rect(im, 1, 2, 14, 14, '#c9945a'); rect(im, 1, 12, 14, 14, '#9a6a3a'); rect(im, 7, 2, 8, 6, '#e8d6b0'); rect(im, 3, 8, 6, 8, '#9a6a3a')
def ic_vida(im):
    for y, row in enumerate([".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."]):
        for x, c in enumerate(row):
            if c == '#': put(im, 4 + x, 5 + y, '#ff4d5e')
    put(im, 5, 6, '#ffb3bb')
def ic_raio(im):
    for x, y in [(9,3),(8,4),(7,5),(6,6),(5,7),(6,7),(7,7),(8,7),(9,7),(10,7),(9,8),(8,9),(7,10),(6,11)]: put(im, x, y, '#ffd84a')
def ic_grau(im):
    disc(im, 5, 10, 2.6, 2.6, INK); disc(im, 11, 6, 2.6, 2.6, INK)
    for i in range(6): put(im, 5 + i, 10 - i * 4 // 6, '#f4efe2')
def capacete_voo():
    """Capacete arremessado (8×8, igual ao do Capacete Voador), em 4 rotações."""
    m = ["..KKKK..", ".KCCCCK.", "KCCLCCCK", "KCCWWWWK", "KCCWWWWK", "KDDDDDDK", ".KKKKKK.", "........"]
    pal = {'K': INK, 'C': '#d42a2a', 'D': '#9e1c1c', 'L': '#f4efe2', 'W': '#9cc3e6'}
    im = new(8, 8)
    for y, r in enumerate(m):
        for x, ch in enumerate(r):
            if ch != '.': put(im, x, y, pal[ch])
    return [im, im.transpose(Image.ROTATE_270), im.transpose(Image.ROTATE_180), im.transpose(Image.ROTATE_90)]
def ic_capacete(im):
    h = capacete_voo()[0]; im.alpha_composite(h, (4, 4))
ITEMS = {
    'capacete': item_box('#e8e2d0', '#b3ab95', ic_capacete),
    'pacote': item_box('#c9945a', '#9a6a3a', ic_pacote),
    'vida': item_box('#f4efe2', '#c9c0d8', ic_vida),
    'velocidade': item_box('#3d7fb5', '#2c5f8c', ic_raio),
    'grau': item_box('#3fa65a', '#2a7a40', ic_grau),
}
