"""Cachorros de pé (Pastel de Feira): clientes em 7 raças × 3 portes, pasteleiro e equipe.
O desenho 1× 16 bits (cpe16) é ampliado com Scale2x. Pelo em cores-chave magenta
(`#ff00ff`, `#b000b0`, `#ff9cff`) trocadas pelo jogo.

Saídas (pasta `caes_pe`): <raça>_<p|m|g>_<pose>, pasteleiro_<pose>, func_<fritador|geral>_<pose>
"""
from .prim import scale2x
from .fonte16 import cpe16 as C

def gerar(saida):
    for b in C.BREEDS:
        for s in C.SIZES:
            for pose in C.POSES:
                saida.salvar(scale2x(C.dog(s, b, pose)), 'caes_pe', f'{b}_{s}_{pose}')
    for nome, outfit, breed in [('pasteleiro', 'pasteleiro', 'caramelo'), ('func_fritador', 'func_fritador', 'pitbull'),
                                ('func_geral', 'func_geral', 'collie')]:
        for pose in C.POSES:
            saida.salvar(scale2x(C.dog('m', breed, pose, outfit)), 'caes_pe', f'{nome}_{pose}')
