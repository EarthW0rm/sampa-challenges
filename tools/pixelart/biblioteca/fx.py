"""Efeitos: desenho 16 bits original ampliado com Scale2x.

  fx/explosao_{0,1,2}  48×48    fx/brilho_{0,1,2}  24×24    fx/poeira_{0,1,2}  24×16    fx/caixa_amassada  28×12
"""
from .prim import scale2x
from .fonte16 import loko16 as L

def gerar(saida):
    for k, im in L.FX.items():
        saida.salvar(scale2x(im), 'fx', k)
