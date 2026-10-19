"""Primitivas de pixel art em alta definição (sem antialias)."""
import os
from PIL import Image, ImageDraw

INK = '#1b1220'

def hexc(h, a=255):
    h = h.lstrip('#'); return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), a)

def new(w, h): return Image.new('RGBA', (w, h), (0, 0, 0, 0))

def col(c): return hexc(c) if isinstance(c, str) else c

class Pen:
    """Desenha na imagem `im` em pixels nativos."""
    def __init__(self, im): self.im = im; self.d = ImageDraw.Draw(im)
    def rect(self, x0, y0, x1, y1, c):
        if x1 >= x0 and y1 >= y0: self.d.rectangle([x0, y0, x1, y1], fill=col(c))
    def rrect(self, x0, y0, x1, y1, r, c): self.d.rounded_rectangle([x0, y0, x1, y1], radius=r, fill=col(c))
    def poly(self, pts, c): self.d.polygon(pts, fill=col(c))
    def ell(self, x0, y0, x1, y1, c): self.d.ellipse([x0, y0, x1, y1], fill=col(c))
    def disc(self, cx, cy, r, c): self.d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col(c))
    def line(self, pts, c, w=1): self.d.line(pts, fill=col(c), width=w)
    def put(self, x, y, c):
        if 0 <= x < self.im.width and 0 <= y < self.im.height: self.im.putpixel((x, y), col(c))
    def clear(self, x, y):
        if 0 <= x < self.im.width and 0 <= y < self.im.height: self.im.putpixel((x, y), (0, 0, 0, 0))
    def clear_rect(self, x0, y0, x1, y1):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1): self.clear(x, y)

def outline(im, c=INK):
    """Contorno de 1 pixel nativo ao redor da silhueta (modifica e devolve `im`)."""
    src = im.copy(); px = src.load(); o = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y][3]: continue
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                xx, yy = x + dx, y + dy
                if 0 <= xx < im.width and 0 <= yy < im.height and px[xx, yy][3]:
                    o[x, y] = col(c); break
    return im

def mirror(im): return im.transpose(Image.FLIP_LEFT_RIGHT)

def rotate_nn(im, ang, pivot, k=4):
    """Gira sem suavizar (vizinho mais próximo) em torno de `pivot` (pixels nativos)."""
    big = im.resize((im.width * k, im.height * k), Image.NEAREST)
    r = big.rotate(ang, resample=Image.NEAREST, center=(pivot[0] * k + k // 2, pivot[1] * k + k // 2))
    return r.resize(im.size, Image.NEAREST)

class Saida:
    """Acumula os PNGs; `salvar(im, 'pasta', 'nome')` grava em <raiz>/pasta/nome.png."""
    def __init__(self, raiz): self.raiz = raiz; self.itens = {}
    def salvar(self, im, *path):
        p = os.path.join(self.raiz, *path[:-1], path[-1] + '.png')
        os.makedirs(os.path.dirname(p), exist_ok=True); im.save(p); self.itens['/'.join(path)] = im; return p

def scale2x(im):
    """Scale2x (EPX): dobra a resolução arredondando cantos e diagonais sem criar cores novas.
    É o mesmo algoritmo que os jogos aplicavam em tempo de execução (`game/hires.ts`)."""
    w, h = im.size
    src = im.load()
    out = Image.new('RGBA', (w * 2, h * 2), (0, 0, 0, 0)); o = out.load()
    def at(x, y): return src[min(w - 1, max(0, x)), min(h - 1, max(0, y))]
    for y in range(h):
        for x in range(w):
            P = at(x, y); A = at(x, y - 1); B = at(x + 1, y); C = at(x - 1, y); D = at(x, y + 1)
            e0 = e1 = e2 = e3 = P
            if A != D and C != B:
                if C == A: e0 = A
                if A == B: e1 = B
                if D == C: e2 = C
                if B == D: e3 = D
            o[2 * x, 2 * y] = e0; o[2 * x + 1, 2 * y] = e1; o[2 * x, 2 * y + 1] = e2; o[2 * x + 1, 2 * y + 1] = e3
    return out
