# Sinuca de Bar

Sinuca de boteco vista de cima, em pixel art: mesa de pano verde, bolas numeradas e a regra da
casa. Duas modalidades (lisas × listradas e ímpares × pares), para 2 jogadores no mesmo aparelho ou
contra o computador em 3 níveis.

Rota no hub: `#/jogos/sinuca-de-bar`.

## Como jogar

| Controle | Ação |
|---|---|
| Toque/clique ou arraste na mesa | mira (o taco aponta para o ponto tocado) |
| ◀ ▶ / ‹ › | gira a mira 1° / 0,2° |
| Barra **Força** | força da tacada (5% a 100%) |
| **Tacar!** | dá a tacada |
| Arrastar a branca | posiciona a branca quando há **bola na mão** |
| ← / → (Shift = fino) | mira |
| ↑ / ↓ | força |
| Espaço / Enter | tacada |
| W A S D (Shift = fino) | move a branca com bola na mão |

A linha pontilhada mostra até onde a branca vai e a bola-fantasma (onde ela encosta). A linha
amarela é o caminho da bola atingida; **vermelha** quando aquela bola não pode ser tocada primeiro.

### Regras

| | Lisas × listradas | Ímpares × pares |
|---|---|---|
| Grupo A | lisas, 1 a 7 | ímpares, 1 a 13 |
| Grupo B | listradas, 9 a 15 | pares, 2 a 14 |
| Bola castigo | 8 (preta) | 15 |

- **Saída:** a branca fica atrás da linha de cabeceira (área clara à esquerda) e pode ser movida ali.
  Quem dá a saída na primeira partida é escolhido no menu; depois alterna.
- **Grupos:** a mesa começa aberta. A primeira bola encaçapada sem falta (inclusive na saída) define
  o grupo de quem tacou; o outro fica com o grupo restante.
- **Vez:** encaçapou uma bola do seu grupo sem falta, continua. Errou, ou só derrubou bola do
  adversário, passa a vez (a bola do adversário fica encaçapada).
- **Faltas:** branca na caçapa; não tocar em nenhuma bola; tocar primeiro na bola do adversário (ou
  na castigo antes da hora; com a mesa aberta, tocar primeiro na castigo). Punição: o adversário
  joga com **bola na mão** em qualquer lugar da mesa.
- **Bola castigo:** só pode ser encaçapada depois de todas as bolas do seu grupo saírem; nessa
  hora a primeira bola tocada tem que ser ela. Encaçapar a castigo na hora certa, sem falta, vence.
  **Perde na hora** quem encaçapa a castigo antes da hora (inclusive junto com a última bola do
  grupo), quem derruba a branca junto com ela, ou quem a encaçapa com falta.
- **Castigo na saída:** volta para a marca do pé da mesa e o jogo segue (regra da casa adotada aqui).

### Computador

| Nível | Erro de mira (desvio) | Erro de força | Forças testadas | Pensa na próxima |
|---|---|---|---|---|
| Pato | 2,2° | 15% | 2 | não |
| Bom de taco | 0,9° | 7% | 3 | não |
| Tubarão | 0,25° | 3% | 5 | sim |

## Parâmetros

`game/constants.ts` (a mesa precisa bater com o topo de `tools/pixelart/sinuca_de_bar.py`):

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 320 × 200 | grade lógica (posições e colisões) |
| `SCALE` (`game/hires.ts`) | 2 | o canvas tem 640×400; o fundo ganha o dobro de detalhe (Scale2x) |
| `FELT_L/R/T/B` | 16 / 304 / 40 / 184 | bordas do pano (288 × 144) |
| `HEAD_X`, `FOOT_X` | 88, 232 | linha de cabeceira e marca do pé (ponta do triângulo) |
| `BALL_R` | 4 | raio da bola (PNG 16×16 em 2× nativo) |
| `JAW_CORNER`, `JAW_MID` | 11, 9 | bocas das caçapas (canto ≈ 2 bolas na diagonal, meio ≈ 2,25 bolas): maior = mais fácil encaçapar |
| `JAW_FACING` | 5 | quina cortada de cada boca: desvia para dentro a bola que chega em ângulo |
| `POCKETS[].r` | 8,5 (canto), 7,5 (meio) | raio de captura: o centro da bola dentro dele cai |
| `PHYS_DT` | 1/240 s | passo fixo da física (o mesmo da previsão da IA) |
| `MAX_SUBSTEP_MOVE` | 0,5 px | maior deslocamento por subpasso (evita atravessar bolas) |
| `MAX_SPEED` | 975 px/s | velocidade da branca com força 100% |
| `ROLL_DECEL` | 45 px/s² | atrito do pano: maior = bolas param antes |
| `LINEAR_DRAG` | 0,2 /s | arrasto extra nas bolas rápidas |
| `STOP_SPEED` | 2 px/s | abaixo disso a bola para |
| `BALL_RESTITUTION` | 0,97 | energia que sobra no choque entre bolas |
| `CUSHION_RESTITUTION` | 0,8 | energia que sobra na tabela |
| `MAX_SHOT_TIME` | 20 s | limite de uma tacada simulada |
| `DEFAULT_POWER`, `POWER_STEP` | 0,4, 0,05 | força inicial e passo das teclas ↑/↓ |
| `AIM_STEP_DEG`, `AIM_FINE_DEG` | 1°, 0,2° | passo da mira (teclas e botões) |
| `CUE_LENGTH`, `CUE_PULL` | 120, 14 px | tamanho do taco e recuo máximo (mostra a força) |
| `STROKE_S` | 0,16 s | animação do taco antes de a branca sair |
| `TOAST_S` | 2,4 s | tempo de cada aviso na mesa |
| `SINK_S` | 0,18 s | bola sumindo na caçapa |
| `AI_THINK_S`, `AI_AIM_S` | 0,5 s, 0,8 s | pausa do computador antes de mirar e tempo girando o taco |

Níveis do computador: `LEVELS` em `game/ai.ts` (tabela acima).

## Rodando só este jogo

Ele roda dentro do hub: `npm run dev` na raiz e abra `#/jogos/sinuca-de-bar`.
