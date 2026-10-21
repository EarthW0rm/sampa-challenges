# Xadrez Paulistano

Xadrez completo num tabuleiro de calçada paulistana (pedra portuguesa clara e basalto), com a
Catedral da Sé ao fundo. Duas pessoas no mesmo aparelho ou uma pessoa contra o computador, com a
força do computador escolhida numa barra de 1 a 100 (100 = mestre).

Rota no hub: `#/jogos/xadrez-paulistano`.

## Como jogar

| Controle | Ação |
|---|---|
| Clique/toque numa peça e depois na casa | joga o lance |
| Arrastar a peça | joga o lance (solta fora de uma casa válida = volta) |
| Setas | movem o cursor amarelo no tabuleiro |
| Enter / Espaço | seleciona a peça ou joga na casa do cursor |
| Esc | solta a peça selecionada |

Botões: **Desfazer** (contra o computador, volta até ser a sua vez de novo), **Desistir** e
**Nova partida** (os dois pedem confirmação com um segundo clique), **Girar** (vira o tabuleiro) e
**Som**.

### Regras

Todas as regras oficiais: roque (curto e longo, sem passar por casa atacada), en passant,
promoção com escolha da peça, xeque, xeque-mate e os empates por afogamento, regra dos 50 lances,
repetição tripla e material insuficiente (rei contra rei, rei e uma peça menor, bispos da mesma
cor). Os lances aparecem em notação algébrica em português: **R** rei, **D** dama, **T** torre,
**B** bispo, **C** cavalo.

### Modos

- **Contra o computador:** escolha brancas, pretas ou sorteio, e o nível de 1 a 100. As últimas
  escolhas ficam salvas (`xadrez-paulistano:config`).
- **2 jogadores:** nomes das brancas e das pretas; opção de girar o tabuleiro sozinho para quem vai
  jogar.

### Níveis do computador

| Faixa | Nome | Como joga |
|---|---|---|
| 1–20 | Iniciante | olha 1–2 lances, erra a avaliação e às vezes joga um lance qualquer |
| 21–40 | Casual | 2–3 lances à frente, ainda com bastante erro |
| 41–60 | Clube | 3–5 lances, enxerga as trocas até o fim |
| 61–80 | Avançado | 5–6 lances, pouco erro |
| 81–99 | Especialista | 6–7 lances, praticamente sem erro a partir do 86 |
| 100 | Mestre | sem limite de profundidade: pensa até 3 s por lance, sem erro proposital |

Em partidas automáticas computador × computador (4 partidas por par, alternando as cores), o nível
mais alto venceu todas: 30 × 1, 60 × 30, 85 × 60 e 100 × 85.

## Parâmetros

`game/constants.ts` (a curva de cada nível é calculada em `game/levels.ts`; `t` vai de 0 no nível 1
a 1 no 100):

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 320 × 200 | grade lógica |
| `SCALE` (`game/hires.ts`) | 2 | canvas de 640×400; os PNGs ganham o dobro de detalhe (Scale2x) |
| `BOARD_X`, `BOARD_Y`, `SQ` | 14, 12, 22 | posição do tabuleiro e lado da casa (iguais no gerador do fundo) |
| `PANEL_X`, `PANEL_W` | 204, 110 | painel da direita |
| `BOX_TOP_Y`, `BOX_BOTTOM_Y`, `BOX_H` | 6, 156, 38 | caixas dos dois lados (nome, vez, capturadas, vantagem) |
| `STATUS_Y`, `STATUS_H` | 132, 20 | caixa de status (vez, xeque, pensando, resultado) |
| `MOVE_ANIM_S` | 0,18 | duração da peça deslizando |
| `DRAG_THRESHOLD` | 3 | quanto o ponteiro anda para virar arrasto |
| `AI_MIN_DELAY_MS` | 450 | espera mínima antes do lance do computador |
| `DEFAULT_LEVEL` | 30 | nível inicial da barra |
| `AI_TIME_MIN_MS`, `AI_TIME_MAX_MS` | 200, 3000 | tempo de busca por lance: `MIN + (MAX − MIN)·t²` |
| `AI_DEPTH_MAX` | 64 | profundidade do mestre (quem limita é o tempo); nos outros níveis `1 + ⌊7t⌋` |
| `AI_NOISE_MAX` | 250 | ruído em centipeões na nota dos lances no nível 1: `MAX·(1 − t)²` |
| `AI_NOISE_MIN` | 5 | abaixo disso o ruído é desligado (a partir do nível ~86) |
| `AI_BLUNDER_MAX` | 0,35 | chance de lance aleatório no nível 1: `MAX·(1 − t)³` |
| `AI_QUIESCENCE_FROM` | 15 | a partir deste nível a busca segue as trocas até o fim |
| `AI_TT_SIZE` | 2¹⁹ | entradas da tabela de transposição (~7 MB no worker) |

## Arte

Gerada por `tools/pixelart/xadrez_paulistano.py` (fundo com tabuleiro e painéis, 12 peças 20×20,
12 peças mini 10×11 e a capa):

```bash
cd tools/pixelart && python3 xadrez_paulistano.py /tmp/xadrez
# copie cenario/, pecas/ e capa.png para src/games/xadrez-paulistano/assets/
```

## Rodando só este jogo

Ele roda dentro do hub: `npm run dev` na raiz e abra `#/jogos/xadrez-paulistano`.
