"""Cachorros de pé (clientes, pasteleiro e equipe da feira): desenho 1× 16 bits.

O pelo usa cores-chave magenta (base, sombra, brilho) que o jogo troca pela cor sorteada;
focinho, nariz, olhos, manchas, avental e chapéu têm cor fixa. A biblioteca amplia com Scale2x
(ver `prim.scale2x`) e grava em `caes_pe/`. Não edite os PNGs: mexa aqui e regere.
"""
from ..prim import new, Pen, outline, INK

MK, MKD, MKL = '#ff00ff', '#b000b0', '#ff9cff'     # pelo: base, sombra, brilho
NOSE, TONGUE, WHITE, CREAM = '#2a1a22', '#e8506a', '#ffffff', '#f4efe2'

# tamanho 1× (largura, altura); o PNG final é o dobro
SIZES = {'p': (24, 32), 'm': (28, 36), 'g': (32, 40)}
POSES = ['parado', 'andando_0', 'andando_1', 'sentado', 'comendo_0', 'comendo_1', 'bravo', 'feliz']

# orelha, focinho (0 curto..2 longo), mancha fixa, rabo, focinho/peito claro fixo
BREEDS = {
    'caramelo':  dict(ear='caida', snout=1, spots=None,     tail='curto', light=None),
    'pitbull':   dict(ear='rosa',  snout=0, spots=None,     tail='curto', light=CREAM),
    'pincher':   dict(ear='pe',    snout=1, spots='sobrancelha', tail='curto', light=None),
    'collie':    dict(ear='ponta', snout=2, spots=None,     tail='longo', light=WHITE),
    'dalmata':   dict(ear='caida', snout=1, spots='pintas', tail='longo', light=None),
    'salsicha':  dict(ear='caida', snout=2, spots=None,     tail='curto', light=None),
    'vira-lata': dict(ear='ponta', snout=1, spots='mancha', tail='longo', light=CREAM),
}

# aparência da roupa: (cor do chapéu, sombra, avental, sombra do avental, tipo de chapéu)
OUTFITS = {
    'pasteleiro':     dict(hat='#f4efe2', hatD='#b9b6ad', apron='#d42a2a', apronD='#9e1c1c', kind='toque'),
    'func_fritador':  dict(hat='#ff8a2a', hatD='#c9601a', apron='#5b5666', apronD='#3b3a48', kind='bone'),
    'func_geral':     dict(hat='#3d7fb5', hatD='#2c5f8c', apron='#3fa65a', apronD='#2a7a40', kind='bone'),
}


def _layout(size):
    w, h = SIZES[size]
    cx = w // 2
    hh = round(h * 0.17); hw = round(w * 0.30)
    head_top = 3
    head_cy = head_top + hh
    body_top = head_cy + hh - 1
    leg_h = round(h * 0.22)
    foot_y = h - 1
    body_bot = foot_y - leg_h
    bw = round(w * 0.52) // 2 * 2
    return dict(w=w, h=h, cx=cx, hh=hh, hw=hw, head_cy=head_cy, body_top=body_top, body_bot=body_bot,
                bw=bw, leg_h=leg_h, foot_y=foot_y, leg_w=max(3, round(w * 0.16)))


def _ears(p, L, br, dy=0):
    cx, hw, hy, hh = L['cx'], L['hw'], L['head_cy'] + dy, L['hh']
    e = br['ear']
    if e == 'caida':
        for s in (-1, 1):
            x = cx + s * (hw - 1)
            p.rect(min(x, x + s * 3), hy - hh + 1, max(x, x + s * 3), hy + 3, MKD)
            p.rect(min(x, x + s * 2), hy - hh + 2, max(x, x + s * 2), hy + 1, MK)
    elif e == 'rosa':
        for s in (-1, 1):
            x = cx + s * (hw - 2)
            p.rect(min(x, x + s * 3), hy - hh - 1, max(x, x + s * 3), hy - hh + 2, MKD)
            p.rect(min(x, x + s * 2), hy - hh, max(x, x + s * 2), hy - hh + 1, MK)
    elif e == 'pe':
        for s in (-1, 1):
            x = cx + s * (hw - 3)
            for i in range(6):
                p.rect(min(x, x + s * 1), hy - hh - 3 + i, max(x, x + s * 1), hy - hh - 3 + i, MK)
            p.put(x + s, hy - hh - 3, MKD)
            p.put(x, hy - hh - 1, MKL)
    elif e == 'ponta':
        for s in (-1, 1):
            x = cx + s * (hw - 2)
            p.rect(min(x, x + s * 2), hy - hh - 2, max(x, x + s * 2), hy - hh + 3, MK)
            p.rect(min(x, x + s * 2), hy - hh - 2, max(x, x + s * 2), hy - hh - 1, WHITE)
            p.put(x, hy - hh + 1, MKD)


def _head(p, L, br, mood, dy=0, mouth=0):
    cx, hw, hh, hy = L['cx'], L['hw'], L['hh'], L['head_cy'] + dy
    _ears(p, L, br, dy)
    p.ell(cx - hw, hy - hh, cx + hw, hy + hh, MK)
    p.rect(cx - hw + 1, hy + hh - 2, cx + hw - 1, hy + hh - 1, MKD)
    p.rect(cx - hw + 2, hy - hh + 1, cx - 1, hy - hh + 1, MKL)
    sn = br['snout']
    light = br['light'] or MKL
    sw = 3 + sn
    p.rect(cx - sw // 2 - 1, hy + 1, cx + sw // 2 + 1, hy + hh - 1 + (1 if sn == 2 else 0), light)
    p.rect(cx - 1, hy + 1, cx, hy + 1, NOSE)
    if br['light'] and br['ear'] == 'ponta':               # faixa branca na testa
        p.rect(cx, hy - hh + 1, cx, hy, br['light'])
    ey = hy - 2
    if mood == 'feliz':
        for s in (-1, 1):
            x = cx + s * 3
            p.put(x, ey, INK); p.put(x - s, ey + 1, INK); p.put(x + s, ey + 1, INK)
    elif mood == 'bravo':
        for s in (-1, 1):
            x = cx + s * 3
            p.put(x, ey + 1, INK); p.put(x + s, ey + 1, INK)
            p.put(x - s, ey - 1, INK); p.put(x, ey, INK); p.put(x + s, ey, INK)
    else:
        for s in (-1, 1): p.put(cx + s * 3, ey, INK); p.put(cx + s * 3, ey + 1, INK)
    my = hy + hh - 1
    if mood == 'bravo':
        p.rect(cx - 2, my, cx + 1, my, INK); p.put(cx - 2, my + 1, INK); p.put(cx + 1, my + 1, INK)
    elif mood == 'feliz' or mouth == 2:
        p.rect(cx - 2, my, cx + 1, my + 1, INK); p.rect(cx - 1, my + 1, cx, my + 1, TONGUE)
    elif mouth == 1:
        p.rect(cx - 1, my, cx, my, INK)
    sp = br['spots']
    if sp == 'sobrancelha':
        for s in (-1, 1): p.put(cx + s * 3, ey - 2, '#b8642a')
        p.rect(cx - 2, hy + hh - 2, cx + 1, hy + hh - 2, '#b8642a')
    elif sp == 'pintas':
        for dx, dyy in ((-hw + 2, -hh + 2), (hw - 2, -hh + 3), (-hw + 1, 0)): p.put(cx + dx, hy + dyy, INK)
    elif sp == 'mancha':
        p.rect(cx - hw + 1, hy - hh + 2, cx - hw + 3, hy - 1, CREAM)


def _spots(p, L, br, y0, y1):
    if br['spots'] == 'pintas':
        cx, bw = L['cx'], L['bw']
        for dx, dy in ((-bw // 2 + 2, 1), (1, 2), (bw // 2 - 3, 4), (-3, 6), (bw // 2 - 2, 8)):
            if y0 + dy < y1: p.put(cx + dx, y0 + dy, INK); p.put(cx + dx + 1, y0 + dy, INK)
    elif br['spots'] == 'mancha':
        p.rect(L['cx'] + 1, y0 + 2, L['cx'] + 4, y0 + 5, CREAM)


def _tail(p, L, br, y, side=1, up=0):
    cx, bw = L['cx'], L['bw']
    x = cx + side * (bw // 2)
    if br['tail'] == 'longo':
        p.rect(x, y - 3 - up, x + side * 2, y - up, MK); p.put(x + side * 2, y - 4 - up, MKL)
    else:
        p.rect(x, y - 1 - up, x + side, y - up, MK)


def _body(p, L, br, outfit, top, bot):
    cx, bw = L['cx'], L['bw']
    p.rect(cx - bw // 2, top, cx + bw // 2 - 1, bot, MK)
    p.rect(cx - bw // 2, bot - 1, cx + bw // 2 - 1, bot, MKD)
    light = br['light']
    if light and not outfit:
        p.rect(cx - 2, top, cx + 1, bot - 2, light)
    elif not outfit:
        p.rect(cx - 1, top + 1, cx, bot - 3, MKL)
    _spots(p, L, br, top, bot)
    if outfit:
        o = OUTFITS[outfit]
        p.rect(cx - bw // 2 + 1, top + 1, cx + bw // 2 - 2, bot, o['apron'])
        p.rect(cx - bw // 2 + 1, bot - 1, cx + bw // 2 - 2, bot, o['apronD'])
        p.rect(cx - bw // 2 + 1, top + 1, cx + bw // 2 - 2, top + 1, WHITE)
        p.rect(cx - 2, top + 4, cx + 1, top + 5, o['apronD'])      # bolso


def _hat(p, L, outfit, dy=0):
    if not outfit: return
    o = OUTFITS[outfit]; cx, hw, hh, hy = L['cx'], L['hw'], L['hh'], L['head_cy'] + dy
    top = hy - hh
    if o['kind'] == 'toque':
        p.rect(cx - hw + 2, top - 3, cx + hw - 3, top, o['hat'])
        p.rect(cx - hw + 1, top - 5, cx + hw - 2, top - 3, o['hat'])
        p.rect(cx - hw + 1, top, cx + hw - 2, top + 1, o['hatD'])
    else:
        p.rect(cx - hw + 1, top - 1, cx + hw - 2, top + 1, o['hat'])
        p.rect(cx - hw + 1, top + 1, cx + hw - 2, top + 1, o['hatD'])
        p.rect(cx + 1, top + 1, cx + hw + 1, top + 2, o['hatD'])         # aba


def _arm(p, L, side, top, length, held=None, out=0):
    cx, bw = L['cx'], L['bw']
    x = cx + side * (bw // 2 + (0 if side > 0 else -1)) + (side * out)
    x0 = x if side > 0 else x - 1
    p.rect(x0, top, x0 + 1, top + length, MK)
    p.rect(x0, top + length - 1, x0 + 1, top + length, MKL)
    if held: p.rect(x0 - 1 if side > 0 else x0, top + length - 3, x0 + 2, top + length - 1, held)


def _legs(p, L, step=0):
    cx, bw, lw = L['cx'], L['bw'], L['leg_w']
    for i, s in enumerate((-1, 1)):
        lift = 0
        if step: lift = 1 if (i == 0) == (step == 1) else 0
        x = cx + s * (bw // 4) - (lw // 2 if s < 0 else lw // 2 - 1) + (0 if s < 0 else 0)
        x0 = x - (1 if s < 0 else 0)
        yb = L['foot_y'] - lift
        p.rect(x0, L['body_bot'] + 1, x0 + lw - 1, yb - 1, MK)
        p.rect(x0, yb - 1, x0 + lw - 1 + 1, yb, MKD)
        p.rect(x0 + (0 if s < 0 else 1), L['body_bot'] + 1, x0 + (0 if s < 0 else 1), yb - 2, MKL)


def _item(p, x, y, kind='pastel'):
    p.rect(x, y, x + 3, y + 2, '#e0a050'); p.rect(x, y + 2, x + 3, y + 2, '#a8702a'); p.put(x + 1, y, '#ffd278')


def dog(size, breed, pose, outfit=None):
    L = _layout(size)
    br = BREEDS[breed]
    im = new(L['w'], L['h']); p = Pen(im)
    cx, bw = L['cx'], L['bw']
    bt, bb = L['body_top'], L['body_bot']
    mood, mouth, dy, step = 'normal', 0, 0, 0
    if pose == 'sentado':
        # corpo mais baixo: pernas dobradas para a frente
        drop = L['leg_h'] - 3
        L2 = dict(L); L2['head_cy'] += drop; L2['body_top'] += drop; L2['body_bot'] = L['foot_y'] - 3
        L2['leg_h'] = 3
        _tail(p, L2, br, L['foot_y'] - 2, 1)
        _body(p, L2, br, outfit, L2['body_top'], L2['body_bot'])
        for s in (-1, 1):
            _arm(p, L2, s, L2['body_top'] + 1, 4)
        p.rect(cx - bw // 2, L['foot_y'] - 3, cx + bw // 2 - 1, L['foot_y'], MK)
        p.rect(cx - bw // 2, L['foot_y'] - 1, cx + bw // 2 - 1, L['foot_y'], MKD)
        p.rect(cx - 1, L['foot_y'] - 3, cx, L['foot_y'] - 2, MKL)
        _head(p, L2, br, 'normal')
        _hat(p, L2, outfit)
        return outline(im)
    if pose.startswith('andando'):
        step = 1 if pose.endswith('0') else 2
    if pose in ('comendo_0', 'comendo_1'):
        mouth = 2 if pose.endswith('1') else 1
    if pose == 'bravo': mood = 'bravo'
    if pose == 'feliz': mood = 'feliz'
    if pose == 'feliz' or pose == 'andando_1': dy = 0
    bob = 1 if pose == 'andando_1' else 0
    _tail(p, L, br, bb - 1, 1 if pose != 'bravo' else 1, up=1 if pose == 'bravo' else 0)
    _legs(p, L, step)
    _body(p, L, br, outfit, bt + bob, bb)
    al = max(5, L['h'] // 6)
    if pose == 'feliz':
        for s in (-1, 1):
            x = cx + s * (bw // 2 + (0 if s > 0 else -1)); x0 = x if s > 0 else x - 1
            p.rect(x0 + s, bt - 3, x0 + s + 1, bt + 3, MK); p.rect(x0 + s, bt - 4, x0 + s + 1, bt - 3, MKL)
    elif pose.startswith('comendo'):
        _arm(p, L, -1, bt + 1, al)
        x0 = cx + bw // 2
        p.rect(x0, bt - 1, x0 + 1, bt + al, MK)
        _item(p, x0 - 2 if mouth == 2 else x0 - 1, bt - 2, 'pastel')
    elif pose == 'bravo':
        for s in (-1, 1): _arm(p, L, s, bt + 1, al - 1, out=0)
        for s in (-1, 1):
            x0 = cx + s * (bw // 2) - (1 if s < 0 else 0) + (s * 1)
            p.rect(x0, bt + al - 2, x0 + 1, bt + al, MKL)
    elif step:
        a = (1, -1) if step == 1 else (-1, 1)
        for s, sw in zip((-1, 1), a):
            _arm(p, L, s, bt + 1 + (1 if sw > 0 else 0), al - (0 if sw > 0 else 1))
    else:
        for s in (-1, 1): _arm(p, L, s, bt + 1, al)
    _head(p, L, br, mood, dy=bob, mouth=mouth)
    _hat(p, L, outfit, dy=bob)
    return outline(im)
