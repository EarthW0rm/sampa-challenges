"""Corredor SP: motoboys vistos de trás, trânsito, cenário das avenidas, itens e céus.

Uso: python3 corredor_sp.py <pasta-de-saida>
Saída na estrutura de src/games/corredor-sp/assets/.
As motos são desenhadas com cores-chave (magenta) que o jogo troca pela cor escolhida.
"""
import os, math, random, sys
from PIL import Image, ImageDraw

OUT = sys.argv[1]
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
# TRÂNSITO (vista traseira)
# =====================================================================
CAR_COLORS = {'branco': ('#e8e2d0', '#b3ab95'), 'prata': ('#b9b6ad', '#8a8a90'), 'preto': ('#3b3a48', '#22202c'),
              'vermelho': ('#c0392b', '#8a2418'), 'azul': ('#3d6e9e', '#2a4b70'), 'amarelo': ('#e8b83f', '#b08420')}
# posição das lanternas em cada veículo (para a seta e a luz de freio desenhadas pelo jogo)
LIGHTS = {}

def car(col, taxi=False):
    c, d = CAR_COLORS[col]; im = new(56, 38); oy = 4
    rect(im, 12, 1+oy, 43, 12+oy, c); rect(im, 15, 3+oy, 40, 11+oy, '#2a2840'); rect(im, 16, 4+oy, 24, 5+oy, '#4b5a78')  # teto/vidro
    rect(im, 3, 12+oy, 52, 26+oy, c); rect(im, 3, 24+oy, 52, 26+oy, d); rect(im, 4, 12+oy, 51, 12+oy, '#ffffff' if col != 'branco' else '#ffffff')
    rect(im, 4, 14+oy, 11, 17+oy, '#a8281e'); rect(im, 44, 14+oy, 51, 17+oy, '#a8281e')     # lanternas
    rect(im, 22, 17+oy, 33, 21+oy, '#e8e2d0'); rect(im, 23, 19+oy, 32, 19+oy, '#5b5666')   # placa
    rect(im, 2, 27+oy, 53, 29+oy, '#2a2533')                                                # para-choque
    if taxi:
        rect(im, 22, -3+oy, 33, 0+oy, '#ffd23f'); text(im, 'TAXI', 20, -3+oy - 0, '#1b1220') if False else None
        rect(im, 23, -2+oy, 32, -1+oy, '#1b1220')
    outline(im)
    rect(im, 5, 30+oy, 12, 33+oy, INK); rect(im, 43, 30+oy, 50, 33+oy, INK)               # pneus
    LIGHTS['taxi' if taxi else f'carro_{col}'] = [[4, 14+oy, 8, 4], [44, 14+oy, 8, 4]]
    return im

def suv():
    im = new(60, 44); oy = 2; c, d = '#5b6b5a', '#3e4a3e'
    rect(im, 8, 1+oy, 51, 15+oy, c); rect(im, 11, 3+oy, 48, 13+oy, '#2a2840'); rect(im, 13, 4+oy, 22, 5+oy, '#4b5a78')
    rect(im, 3, 15+oy, 56, 31+oy, c); rect(im, 3, 29+oy, 56, 31+oy, d)
    rect(im, 4, 16+oy, 9, 23+oy, '#a8281e'); rect(im, 50, 16+oy, 55, 23+oy, '#a8281e')
    rect(im, 24, 21+oy, 35, 25+oy, '#e8e2d0'); rect(im, 25, 23+oy, 34, 23+oy, '#5b5666')
    disc(im, 29.5, 10+oy, 6, 5, '#3e4a3e')    # estepe na tampa
    rect(im, 2, 32+oy, 57, 34+oy, '#2a2533')
    outline(im)
    rect(im, 5, 35+oy, 13, 39+oy, INK); rect(im, 46, 35+oy, 54, 39+oy, INK)
    LIGHTS['suv'] = [[4, 16+oy, 6, 8], [50, 16+oy, 6, 8]]
    return im

def bus():
    im = new(76, 70); c, d = '#e8e2d0', '#b3ab95'
    rect(im, 3, 2, 72, 60, c); rect(im, 3, 56, 72, 60, d)
    rect(im, 8, 6, 67, 24, '#2a2840'); rect(im, 10, 7, 30, 9, '#4b5a78')           # vidro traseiro
    rect(im, 3, 30, 72, 34, '#3d7fb5'); rect(im, 3, 35, 72, 36, '#d42a2a')           # faixas
    rect(im, 26, 2, 49, 5, '#1b1220'); text(im, '875', 32, 2, '#ffb02e')            # letreiro
    rect(im, 5, 40, 12, 50, '#a8281e'); rect(im, 63, 40, 70, 50, '#a8281e')
    rect(im, 30, 44, 45, 49, '#e8e2d0'); rect(im, 31, 46, 44, 46, '#5b5666')
    rect(im, 14, 52, 61, 54, '#8a8a90')                                              # grade do motor
    for x in range(16, 60, 4): put(im, x, 53, '#5b5666')
    rect(im, 2, 61, 73, 63, '#2a2533')
    outline(im)
    rect(im, 6, 64, 16, 68, INK); rect(im, 59, 64, 69, 68, INK)
    LIGHTS['onibus'] = [[5, 40, 8, 11], [63, 40, 8, 11]]
    return im

def truck():
    im = new(76, 74)
    rect(im, 2, 0, 73, 58, '#d9d4c4'); rect(im, 2, 56, 73, 58, '#a8a290')            # baú
    rect(im, 37, 2, 38, 56, '#8a8a90')                                               # portas
    for y in (8, 30, 50): rect(im, 33, y, 36, y+2, '#5b5666'); rect(im, 39, y, 42, y+2, '#5b5666')
    rect(im, 6, 18, 30, 30, '#d42a2a'); rect(im, 45, 18, 69, 30, '#d42a2a')         # faixa refletiva
    for x in range(6, 30, 4): rect(im, x, 18, x+1, 30, '#f4efe2')
    for x in range(45, 69, 4): rect(im, x, 18, x+1, 30, '#f4efe2')
    rect(im, 4, 59, 71, 61, '#2a2533')
    rect(im, 5, 60, 12, 64, '#a8281e'); rect(im, 63, 60, 70, 64, '#a8281e')
    rect(im, 31, 60, 44, 64, '#e8e2d0'); rect(im, 32, 62, 43, 62, '#5b5666')
    outline(im)
    rect(im, 3, 65, 17, 71, INK); rect(im, 58, 65, 72, 71, INK)
    rect(im, 6, 66, 14, 72, '#2a2533'); rect(im, 61, 66, 69, 72, '#2a2533')         # para-barro
    LIGHTS['caminhao'] = [[5, 60, 8, 5], [63, 60, 8, 5]]
    return im

def ambulance(frame):
    im = new(64, 56); c = '#f4efe2'
    rect(im, 4, 6, 59, 44, c); rect(im, 4, 42, 59, 44, '#b9b6ad')
    rect(im, 4, 24, 59, 28, '#d42a2a')
    rect(im, 30, 10, 33, 20, '#d42a2a'); rect(im, 26, 14, 37, 16, '#d42a2a')        # cruz
    rect(im, 8, 10, 22, 20, '#2a2840'); rect(im, 41, 10, 55, 20, '#2a2840')           # vidros
    rect(im, 31, 6, 32, 44, '#b9b6ad')
    l, r = ('#ff3b2f', '#3d7fb5') if frame == 0 else ('#3d7fb5', '#ff3b2f')
    rect(im, 8, 1, 30, 5, l); rect(im, 33, 1, 55, 5, r)                             # giroflex
    rect(im, 5, 30, 10, 38, '#a8281e'); rect(im, 53, 30, 58, 38, '#a8281e')
    rect(im, 26, 35, 37, 39, '#e8e2d0')
    rect(im, 3, 45, 60, 47, '#2a2533')
    outline(im)
    rect(im, 6, 48, 15, 52, INK); rect(im, 48, 48, 57, 52, INK)
    LIGHTS['ambulancia'] = [[5, 30, 6, 9], [53, 30, 6, 9]]
    return im

def wrong_way():
    """Motoboy na contramão do corredor: visto de frente, farol aceso."""
    im = new(40, 44); c = BREEDS['caramelo']; oy = 6
    rect(im, 8, 15+oy, 13, 17+oy, c['fur']); rect(im, 26, 15+oy, 31, 17+oy, c['fur'])
    handlebar(im, 15+oy)
    rect(im, 13, 11+oy, 26, 22+oy, c['fur']); rect(im, 16, 13+oy, 23, 22+oy, c['furL'])
    disc(im, 19.5, 5+oy, 5.2, 4.8, HELMET); rect(im, 15, 4+oy, 24, 7+oy, '#2a2840'); rect(im, 16, 4+oy, 19, 4+oy, '#7fb3dd')  # visor
    rect(im, 13, 23+oy, 26, 27+oy, '#3d7fb5'); rect(im, 15, 23+oy, 24, 23+oy, '#7fb3dd')    # carenagem
    rect(im, 17, 24+oy, 22, 26+oy, '#fff7c2')                                                # farol
    rect(im, 12, 24+oy, 13, 25+oy, '#ffb02e'); rect(im, 26, 24+oy, 27, 25+oy, '#ffb02e')
    outline(im)
    rect(im, 17, 28+oy, 22, 37+oy, INK); rect(im, 18, 28+oy, 21, 36+oy, '#3b3a48')
    return im

# =====================================================================
# CENÁRIO (beira da pista)
# =====================================================================
def poste():
    im = new(24, 80)
    rect(im, 3, 6, 4, 79, '#8a8a90'); rect(im, 3, 6, 3, 79, '#b9b6ad')
    rect(im, 3, 4, 18, 5, '#8a8a90'); rect(im, 14, 6, 21, 8, '#5b5666'); rect(im, 15, 9, 20, 9, '#fff7c2')
    rect(im, 1, 76, 6, 79, '#5b5666')
    return outline(im)

def arvore(kind):
    im = new(48, 64); r = random.Random(kind)
    leaf = {'ipe_roxo': ('#9b5bb5', '#6e3a8a', '#c890dd'), 'ipe_amarelo': ('#f2c230', '#c99a10', '#ffe27a'), 'comum': ('#3f8a4a', '#2a6034', '#6fbf6a')}[kind]
    rect(im, 22, 34, 25, 63, '#6b4a2a'); rect(im, 22, 34, 22, 63, '#8a6238')
    for _ in range(26):
        cx, cy = r.randrange(8, 40), r.randrange(4, 36); rr = r.randrange(5, 9)
        disc(im, cx, cy, rr, rr * 0.85, leaf[r.randrange(2)])
    for _ in range(30): put(im, r.randrange(6, 42), r.randrange(4, 36), leaf[2])
    return outline(im)

def placa(label):
    w = max(80, text_w(label) + 16); im = new(w, 48)
    rect(im, 8, 18, 10, 47, '#8a8a90'); rect(im, w-11, 18, w-9, 47, '#8a8a90')
    rect(im, 2, 2, w-3, 22, '#1f7a4a'); rect(im, 3, 3, w-4, 21, '#2a9a5c'); rect(im, 4, 4, w-5, 20, '#1f7a4a')
    text(im, label, (w - text_w(label)) // 2, 10, '#f4efe2')
    rect(im, w//2 - 6, 4, w//2 + 6, 7, '#1f7a4a')
    return outline(im)

def outdoor(kind):
    im = new(80, 56)
    rect(im, 18, 34, 20, 55, '#5b5666'); rect(im, 59, 34, 61, 55, '#5b5666')
    rect(im, 1, 1, 78, 35, '#e8e2d0'); rect(im, 3, 3, 76, 33, '#16121f')
    if kind == 'lokodog':
        rect(im, 3, 3, 76, 33, '#ffd23f'); text(im, 'LOKO DOG', 8, 8, '#1b1220'); text(im, 'PEDE JA!', 8, 18, '#d42a2a')
        rect(im, 50, 9, 71, 15, '#c9945a'); rect(im, 51, 11, 70, 13, '#b04a2a'); rect(im, 53, 11, 68, 11, '#ffd23f')
    elif kind == 'capacete':
        rect(im, 3, 3, 76, 33, '#3d7fb5'); text(im, 'CAPACETE', 8, 8, '#f4efe2'); text(im, 'VOADOR', 8, 16, '#ffd23f')
        disc(im, 62, 18, 8, 7, '#d42a2a'); rect(im, 58, 18, 69, 21, '#9cc3e6')
    else:
        rect(im, 3, 3, 76, 33, '#d42a2a'); text(im, 'USE', 8, 8, '#f4efe2'); text(im, 'CAPACETE', 8, 16, '#f4efe2'); text(im, 'SEMPRE', 8, 24, '#ffd23f')
    return outline(im)

def grafite(v):
    im = new(96, 32); r = random.Random(v)
    rect(im, 0, 4, 95, 31, '#9a968c'); rect(im, 0, 4, 95, 5, '#b9b6ad')
    cols = ['#ff4d5e', '#ffd23f', '#3fa65a', '#3d7fb5', '#9b5bb5', '#ff8a2a', '#5fd1d1']
    for _ in range(9):
        x, y = r.randrange(0, 90), r.randrange(8, 28); w, h = r.randrange(8, 22), r.randrange(4, 12)
        disc(im, x + w/2, y, w/2, h/2, cols[r.randrange(len(cols))])
    # um personagem grande (olho e boca) como os murais da 23 de Maio
    cx = 20 + v * 25; disc(im, cx, 17, 9, 9, cols[(v+2) % len(cols)]); disc(im, cx-3, 15, 2, 2, '#f4efe2'); disc(im, cx+3, 15, 2, 2, '#f4efe2')
    put(im, cx-3, 15, INK); put(im, cx+3, 15, INK); rect(im, cx-3, 20, cx+3, 21, INK)
    for _ in range(14):
        x = r.randrange(0, 94); rect(im, x, r.randrange(8, 28), x+1, r.randrange(8, 30), INK)
    return outline(im)

def predio(v):
    im = new(64, 120); r = random.Random(v)
    wall = ['#b9b6ad', '#d9c4a0', '#9a968c'][v]
    rect(im, 2, 6, 61, 119, wall); rect(im, 2, 6, 61, 9, '#5b5666')
    for y in range(14, 114, 8):
        for x in range(6, 58, 9):
            rect(im, x, y, x+5, y+4, '#ffd36b' if r.random() < 0.18 else '#2a2840')
    rect(im, 24, 0, 35, 6, '#3d7fb5')       # caixa d'água
    return outline(im)

def cohab():
    im = new(96, 64); r = random.Random(7)
    rect(im, 2, 4, 93, 63, '#d9b48a'); rect(im, 2, 4, 93, 7, '#9a6a3a')
    for y in range(12, 60, 9):
        for x in range(6, 90, 10):
            rect(im, x, y, x+6, y+5, '#ffd36b' if r.random() < 0.15 else '#3b3a48'); rect(im, x, y+5, x+6, y+5, '#f4efe2')
    for x in range(10, 90, 20): rect(im, x, 8, x+1, 63, '#b8946a')
    return outline(im)

def casa(v):
    """Casas da comunidade: tijolo aparente, laje, caixa d'água azul, escada externa."""
    im = new(64, 56); r = random.Random(v * 13)
    tij = ['#b5562e', '#a04a28', '#c96a3a']
    floors = [(4, 30, 59, 55), (10, 12, 50, 30)] if v != 2 else [(2, 34, 40, 55), (22, 20, 62, 55), (8, 6, 36, 34)]
    for (x0, y0, x1, y1) in floors:
        rect(im, x0, y0, x1, y1, tij[r.randrange(3)])
        for y in range(y0+2, y1, 3):
            for x in range(x0 + (y // 3 % 2) * 2, x1, 4): put(im, x, y, '#7a3418')
        rect(im, x0-1, y0-2, x1+1, y0-1, '#9a968c')                                    # laje
        if r.random() < 0.6: rect(im, x0+3, y0+4, x0+8, y0+9, '#2a2840')               # janela
        if r.random() < 0.5: rect(im, x1-10, y0+4, x1-5, y0+9, '#ffd36b')
        if r.random() < 0.6: rect(im, (x0+x1)//2 - 2, y1-9, (x0+x1)//2 + 2, y1, '#5b4636')  # porta
    tx = floors[-1][0] + 4; ty = floors[-1][1] - 9
    rect(im, tx, ty, tx+8, ty+6, '#3d7fb5'); rect(im, tx, ty, tx+8, ty, '#7fb3dd')     # caixa d'água
    if v == 1:
        for i in range(8): rect(im, 52 - i*2, 30 + i*3, 55 - i*2, 30 + i*3, '#9a968c')  # escada externa
        rect(im, 40, 24, 58, 24, '#d42a2a'); [put(im, x, 25, ['#ffd23f', '#3fa65a', '#3d7fb5'][x % 3]) for x in range(41, 58, 2)]  # varal
    return outline(im)

def trem():
    im = new(128, 32)
    rect(im, 1, 2, 126, 27, '#c9cdd4'); rect(im, 1, 2, 126, 4, '#8a8a90')
    rect(im, 1, 20, 126, 23, '#d42a2a')                  # linha vermelha
    for x in range(6, 120, 14): rect(im, x, 8, x+9, 16, '#2a2840'); rect(im, x+1, 9, x+3, 10, '#7fb3dd')
    rect(im, 62, 6, 65, 19, '#8a8a90')
    for x in (12, 40, 86, 114): disc(im, x, 29, 3, 2, INK)
    return outline(im)

def mureta():
    im = new(48, 14)
    rect(im, 0, 3, 47, 13, '#b9b6ad'); rect(im, 0, 3, 47, 4, '#e8e2d0'); rect(im, 0, 11, 47, 13, '#8a8a90')
    for x in range(0, 48, 12): rect(im, x, 3, x, 13, '#8a8a90')
    return im

def cone():
    im = new(10, 14)
    for y in range(1, 12):
        w = y // 2; rect(im, 5 - w, y, 4 + w, y, '#ff8a2a' if (y // 3) % 2 == 0 else '#f4efe2')
    rect(im, 0, 12, 9, 13, '#2a2533')
    return outline(im)

def buraco():
    im = new(40, 10)
    disc(im, 19.5, 5, 19, 4.5, '#2a2533'); disc(im, 19.5, 5.5, 15, 3, '#16121f')
    for x in range(4, 36, 5): put(im, x, 1 + (x % 3), '#5b5666')
    return im

def ponte_estaiada():
    """Ponte Estaiada (Octavio Frias) para o horizonte da Nações Unidas: mastro em X e cabos."""
    im = new(140, 90)
    top = (70, 2)
    for i, (dx, base) in enumerate([(-20, 88), (20, 88)]):
        x0 = 70 + dx
        for t in range(0, 90):
            y = 88 - t; x = round(x0 + (top[0] - x0) * t / 86)
            rect(im, x - 1, y, x + 1, y, '#e8e2d0')
    for k in range(10):
        ax, ay = 70, 6 + k * 3
        for side in (-1, 1):
            bx = 70 + side * (14 + k * 6); by = 70
            n = max(abs(bx - ax), abs(by - ay))
            for s in range(n + 1): put(im, round(ax + (bx - ax) * s / n), round(ay + (by - ay) * s / n), '#c9c0d8')
    rect(im, 0, 70, 139, 73, '#b9b6ad'); rect(im, 0, 74, 139, 75, '#8a8a90')
    return im

# =====================================================================
# HORIZONTES (320×90, dia e noite) por pista
# =====================================================================
def skyline(track, night):
    im = new(320, 90); r = random.Random({'23-de-maio': 1, 'radial-leste': 2, 'nacoes-unidas': 3}[track])
    far = '#6e5f7a' if not night else '#241c33'; near = '#4a3a5a' if not night else '#16121f'
    lit = '#ffd36b'
    def block(x, w, h, col, win=True):
        rect(im, x, 90 - h, x + w - 1, 89, col)
        if win:
            for yy in range(90 - h + 3, 88, 4):
                for xx in range(x + 2, x + w - 2, 3):
                    if r.random() < (0.35 if night else 0.08): put(im, xx, yy, lit if night else '#8a7a9a')
    if track == '23-de-maio':
        x = 0
        while x < 320:
            w = r.randrange(10, 24); block(x, w, r.randrange(30, 75), far); x += w + r.randrange(0, 4)
        # Obelisco do Ibirapuera
        for y in range(12, 90):
            hw = 1 + (y - 12) // 22; rect(im, 236 - hw, y, 236 + hw, y, '#e8e2d0' if not night else '#8a8a90')
        put(im, 236, 11, '#e8e2d0' if not night else '#8a8a90')
        x = 0
        while x < 320:
            w = r.randrange(14, 30); block(x, w, r.randrange(12, 40), near); x += w + r.randrange(2, 10)
    elif track == 'radial-leste':
        x = 0
        while x < 320:
            w = r.randrange(16, 30); block(x, w, r.randrange(18, 40), far); x += w + r.randrange(0, 6)
        # estádio no horizonte (arquibancada curva e cobertura)
        sx = 196
        for xx in range(0, 90):
            h = 30 + int(8 * math.sin(xx / 90 * math.pi))
            rect(im, sx + xx, 90 - h, sx + xx, 89, '#9a968c' if not night else '#3b3a48')
        rect(im, sx - 4, 90 - 40, sx + 93, 90 - 37, '#e8e2d0' if not night else '#5b5666')
        x = 0
        while x < 320:
            w = r.randrange(20, 36); block(x, w, r.randrange(10, 26), near); x += w + r.randrange(4, 14)
    else:
        x = 0
        while x < 320:   # torres espelhadas da Berrini
            w = r.randrange(12, 22); h = r.randrange(40, 82)
            rect(im, x, 90 - h, x + w - 1, 89, '#5f7fa0' if not night else '#1f2b3a')
            for xx in range(x + 1, x + w - 1, 2):
                rect(im, xx, 90 - h + 2, xx, 88, '#86a8c8' if not night else ('#3d6e9e' if r.random() < 0.6 else '#ffd36b'))
            x += w + r.randrange(2, 8)
        ponte = ponte_estaiada()
        if night:
            px = ponte.load()
            for yy in range(ponte.height):
                for xx in range(ponte.width):
                    if px[xx, yy][3]: px[xx, yy] = hexc('#f4efe2') if (xx + yy) % 5 else hexc('#ffd36b')
        im.alpha_composite(ponte, (150, 0))
        # morro com a comunidade
        for xx in range(0, 120):
            h = 26 + int(12 * math.sin(xx / 120 * math.pi))
            rect(im, xx, 90 - h, xx, 89, '#8a4a30' if not night else '#2a1a20')
        for _ in range(140):
            xx = r.randrange(0, 118); hh = 26 + int(12 * math.sin(xx / 120 * math.pi))
            yy = r.randrange(90 - hh + 2, 89)
            put(im, xx, yy, (lit if r.random() < 0.6 else '#ff9a6a') if night else ['#c96a3a', '#e8e2d0', '#3d7fb5', '#a04a28'][r.randrange(4)])
    return im

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

# =====================================================================
# SAÍDA
# =====================================================================
saved = {}
def save(im, *path):
    im.save(P(*path)); saved['/'.join(path)] = im

for b in BREEDS:
    for cat, fn in RIDERS.items():
        base = fn(b)
        save(base, 'motos', f'{b}_{cat}_reto.png')
        save(rotate(base, 12, (20, 43)), 'motos', f'{b}_{cat}_esq.png')
        save(rotate(base, -12, (20, 43)), 'motos', f'{b}_{cat}_dir.png')
        save(grau(base), 'motos', f'{b}_{cat}_grau.png')
        save(crash(base), 'motos', f'{b}_{cat}_queda.png')
save(wrong_way(), 'transito', 'moto_contramao.png')
for col in CAR_COLORS: save(car(col), 'transito', f'carro_{col}.png')
save(car('branco', taxi=True), 'transito', 'taxi.png')
save(suv(), 'transito', 'suv.png'); save(bus(), 'transito', 'onibus.png'); save(truck(), 'transito', 'caminhao.png')
save(ambulance(0), 'transito', 'ambulancia_0.png'); save(ambulance(1), 'transito', 'ambulancia_1.png')
save(poste(), 'cenario', 'poste.png')
for k in ('ipe_roxo', 'ipe_amarelo', 'comum'): save(arvore(k), 'cenario', f'arvore_{k}.png')
for name, label in [('23-de-maio', 'AV 23 DE MAIO'), ('radial-leste', 'RADIAL LESTE'), ('nacoes-unidas', 'AV NACOES UNIDAS')]:
    save(placa(label), 'cenario', f'placa_{name}.png')
for k in ('lokodog', 'capacete', 'seguranca'): save(outdoor(k), 'cenario', f'outdoor_{k}.png')
for v in range(3): save(grafite(v), 'cenario', f'grafite_{v}.png'); save(predio(v), 'cenario', f'predio_{v}.png'); save(casa(v), 'cenario', f'casa_comunidade_{v}.png')
save(cohab(), 'cenario', 'cohab.png'); save(trem(), 'cenario', 'trem_metro.png')
save(mureta(), 'cenario', 'mureta.png'); save(cone(), 'cenario', 'cone.png'); save(buraco(), 'cenario', 'buraco.png')
for t in ('23-de-maio', 'radial-leste', 'nacoes-unidas'):
    save(skyline(t, False), 'horizonte', f'{t}_dia.png'); save(skyline(t, True), 'horizonte', f'{t}_noite.png')
for k, v in ITEMS.items(): save(v, 'itens', f'{k}.png')
for i, im in enumerate(capacete_voo()): save(im, 'itens', f'capacete_voo_{i}.png')

import json
json.dump(LIGHTS, open(P('transito', 'lanternas.json'), 'w'), indent=1)
print(len(saved), 'arquivos')
