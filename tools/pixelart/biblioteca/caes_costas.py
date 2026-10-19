"""Cachorro visto de trás (Corredor SP): o desenho 16 bits original, ampliado com Scale2x
(80×88; `queda` 96×88). Mantém as cores-chave magenta que o jogo troca pela cor escolhida.

Saídas (pasta `caes_costas`): <raça>_<150|600|1000>_<reto|esq|dir|grau|queda>
"""
from .prim import scale2x
from .fonte16 import csp16 as S

def gerar(saida):
    for b in S.BREEDS:
        for cat, fn in S.RIDERS.items():
            base = fn(b)
            for pose, im in [('reto', base), ('esq', S.rotate(base, 12, (20, 43))), ('dir', S.rotate(base, -12, (20, 43))),
                             ('grau', S.grau(base)), ('queda', S.crash(base))]:
                saida.salvar(scale2x(im), 'caes_costas', f'{b}_{cat}_{pose}')
