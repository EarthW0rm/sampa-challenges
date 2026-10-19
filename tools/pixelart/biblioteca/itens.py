"""Caixas, itens, capacetes e HUD: desenho 16 bits original ampliado com Scale2x.

  itens/caixa_{caixa,turbo,grau,ima,vida,dobro}, itens/{pizza,sacola}, itens/bomba_{0,1}   24×24 (Cachorro Loko)
  itens/pickup_{capacete,pacote,vida,velocidade,grau}                                     32×32 (Corredor SP)
  capacete/{p1,p2}_{0..3}                                                                 16×16 (Capacete Voador, Corredor)
  hud/coracao_{cheio,vazio}                                                               14×12
"""
from PIL import Image
from .prim import scale2x
from .fonte16 import loko16 as L, cv16 as C, csp16 as S

def gerar(saida):
    for k in ['caixa', 'turbo', 'grau', 'ima', 'vida', 'dobro']:
        saida.salvar(scale2x(L.BOX[k]), 'itens', f'caixa_{k}')
    for k in ['pizza', 'sacola', 'bomba_0', 'bomba_1']:
        saida.salvar(scale2x(L.BOX[k]), 'itens', k)
    for k, im in S.ITEMS.items():
        saida.salvar(scale2x(im), 'itens', f'pickup_{k}')
    for pk in C.PLAYERS:
        h = C.helmet(pk)
        for i, t in enumerate([None, Image.ROTATE_270, Image.ROTATE_180, Image.ROTATE_90]):
            saida.salvar(scale2x(h if t is None else h.transpose(t)), 'capacete', f'{pk}_{i}')
    for k, im in L.HUD.items():
        saida.salvar(scale2x(im), 'hud', k)
