"""Biblioteca única de sprites do Sampa Challenges: desenho 16 bits (o original) em alta definição, 2× nativo.

Regra de ouro: 1 pixel lógico do jogo = 2×2 pixels do PNG. Um cachorro que ocupa 40×40 unidades
lógicas é um PNG de 80×80. Os jogos desenham esses PNGs como estão (sem Scale2x), no tamanho
`largura / 2` em coordenadas lógicas.

Módulos:
  prim.py        primitivas (Pen, contorno, rotação, espelho) e `scale2x`
  fonte16/       o desenho 1× original dos sprites (copiado dos scripts antigos); os módulos abaixo o ampliam com Scale2x
  paleta.py      raças, cores das motos, tintas comuns
  caes_lado.py   cachorro de perfil na scooter (Cachorro Loko, Capacete Voador)
  caes_costas.py cachorro visto de trás (Corredor SP)
  itens.py       caixas/itens, capacetes, ícones, HUD
  fx.py          explosão, brilho, poeira, caixa amassada
  gerar.py       gera tudo em src/shared/sprites/assets/  (python3 -m biblioteca.gerar <pasta>)
"""
