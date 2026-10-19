"""Gera toda a biblioteca em <pasta> (normalmente src/shared/sprites/assets).

Uso (a partir de tools/pixelart):  python3 -m biblioteca.gerar ../../src/shared/sprites/assets
"""
import importlib, sys
from .prim import Saida

MODULOS = ['caes_lado', 'caes_costas', 'itens', 'fx']

def main():
    saida = Saida(sys.argv[1])
    for nome in MODULOS:
        try:
            mod = importlib.import_module(f'.{nome}', __package__)
        except ModuleNotFoundError as e:
            if e.name and e.name.endswith(nome): print('(pulado)', nome); continue
            raise
        mod.gerar(saida); print('ok', nome)
    print(len(saida.itens), 'sprites')

if __name__ == '__main__':
    main()
