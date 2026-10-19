"""Cachorro de perfil na scooter (Cachorro Loko e Capacete Voador): o desenho 16 bits original,
ampliado com Scale2x para 80×80 (= 40×40 lógicos).

Saídas (pasta `caes`):
  p1_normal_0/1, p1_turbo_0/1, p1_grau_0/1, p1_tonto            (Cachorro Loko)
  p{1,2}_dano{0,1,2}{,_arremesso,_ko,_grau}, p{1,2}_destruida{,_ko}   (Capacete Voador)
"""
from .prim import scale2x
from .fonte16 import loko16 as L, cv16 as C

def gerar(saida):
    s = lambda im, nome: saida.salvar(scale2x(im), 'caes', nome)
    for f in (0, 1):
        s(L.tall(L.rider(f)), f'p1_normal_{f}')
        s(L.tall(L.rider(f, flame=True)), f'p1_turbo_{f}')
        s(L.wheelie(L.rider(f)), f'p1_grau_{f}')
    s(L.tall(L.rider(0, tongue=False, dizzy=True)), 'p1_tonto')
    for pk in C.PLAYERS:
        for d in range(3):
            s(C.tall(C.rider(pk, d)), f'{pk}_dano{d}')
            s(C.tall(C.rider(pk, d, 'arremesso')), f'{pk}_dano{d}_arremesso')
            s(C.tall(C.rider(pk, d, ko=True)), f'{pk}_dano{d}_ko')
            s(C.wheelie(C.rider(pk, d)), f'{pk}_dano{d}_grau')
        s(C.tall(C.wreck(pk, False)), f'{pk}_destruida')
        s(C.tall(C.wreck(pk, True)), f'{pk}_destruida_ko')
