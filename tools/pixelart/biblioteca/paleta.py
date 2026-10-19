"""Cores comuns da biblioteca: raças de cachorro, motos e tintas."""

INK = '#1b1220'
METAL, METAL_D, METAL_L = '#8a8a90', '#5b5666', '#d6d4cc'
TIRE, TIRE_L = '#2b2733', '#4a4552'
CREAM = '#f4efe2'
PINK, PINK_D = '#ff7a9a', '#d9507a'

# Raças. fur = pelo, furL = parte clara (peito/focinho), furD = sombra, furDD = sombra forte,
# cap = boné/capacete padrão da raça, orelha = formato da orelha.
RACAS = {
    'caramelo': dict(fur='#d9903f', furL='#f2c27a', furD='#9a5a22', furDD='#6e3d14', orelha='caida', manchas=False),
    'branquinho': dict(fur='#e8e2d0', furL='#ffffff', furD='#a9a392', furDD='#6f6a5d', orelha='caida', manchas=True),
    'pitbull': dict(fur='#8b8fa3', furL='#f4efe2', furD='#5d6175', furDD='#3c4052', orelha='rosa', manchas=False),
    'pincher': dict(fur='#3e3240', furL='#b8642a', furD='#241c26', furDD='#150f17', orelha='pe', manchas=False),
    'collie': dict(fur='#383046', furL='#f4efe2', furD='#221c2c', furDD='#150f1c', orelha='ponta', manchas=False),
}

# Combinações usadas nos jogos (moto, baú, boné). O Cachorro Loko usa 'p1'.
JOGADORES = {
    'p1': dict(raca='caramelo', moto='#3d7fb5', motoD='#2c5f8c', motoL='#7fb3dd', bau='#d42a2a', bauD='#9e1c1c', bauL='#f26a5a',
               cap='#d42a2a', capD='#9e1c1c', capL='#f26a5a', lenco='#d42a2a', lencoD='#9e1c1c'),
    'p2': dict(raca='branquinho', moto='#3fa65a', motoD='#2a7a40', motoL='#8fd6a0', bau='#ffd23f', bauD='#d9901a', bauL='#fff0a0',
               cap='#3d7fb5', capD='#2c5f8c', capL='#7fb3dd', lenco='#d42a2a', lencoD='#9e1c1c'),
}
