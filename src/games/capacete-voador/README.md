# Capacete Voador

O **Gorillas** do QBasic com motoboys. Dois cachorros, cada um na sua moto em cima de um prédio de
São Paulo, trocam capacetes por cima do Copan, do Edifício Itália, do MASP e companhia. Quem
acertar primeiro vence a rodada; a partida vai até o número de pontos escolhido no menu.

Rota no hub: `#/jogos/capacete-voador`.

## Como jogar

Na sua vez, digite o **ângulo** (0–180) e a **velocidade** (1–200) e pressione **Enter** (ou
"Lançar!"). Ângulos acima de 90 lançam para trás. O capacete sofre gravidade e vento; a seta
amarela no rodapé mostra o vento da rodada.

### Regras

| Situação | Resultado |
|---|---|
| Capacete acerta a **moto** do adversário | quebra uma peça: 1º acerto o baú, 2º o farol e a roda (começa a sair fumaça) |
| **3º acerto** na mesma moto | moto destruída: o dono perde a rodada |
| Capacete acerta a **cabeça** do piloto | vitória na hora |
| Acerta a **própria** moto ou cabeça | conta contra você, igual a ser acertado |
| Acerta um prédio | abre uma cratera; passa a vez |
| Sai pela lateral ou cai no chão | passa a vez |
| Passa pelo sol | o sol faz cara de susto (só visual) |

A moto volta inteira a cada rodada, numa cidade nova e com vento novo. O primeiro a jogar alterna
entre as rodadas. Quem vence a rodada comemora dando grau.

### Modos

| Modo | Como funciona |
|---|---|
| 2 jogadores | dois humanos se revezam no mesmo computador |
| Contra o computador | você à esquerda (caramelo, moto azul), o computador à direita (branquinho, moto verde) |
| Treino | o motoboy da direita nunca ataca; o placar mostra tiros e acertos |

### Dificuldade do computador

| Nível | Comportamento | Medido em 30 cidades aleatórias |
|---|---|---|
| Fácil | nunca acerta: cada tiro é simulado antes e só sai se errar todo mundo | 0 acertos |
| Médio | começa errando por uns 14 de velocidade e erra 40% menos a cada tiro; a partir do 5º tiro acerta com certeza | 1º acerto entre o 2º e o 5º tiro |
| Difícil | 35% de chance no 1º tiro, 60% no 2º, certeza do 3º em diante; quando acerta, mira na cabeça 30% das vezes | 1º acerto entre o 1º e o 3º tiro |

O computador usa exatamente a mesma simulação da tela, então o tiro que ele calcula é o que
acontece. Se um prédio alto bloqueia todos os caminhos, ele atira no ponto mais próximo para abrir
uma cratera; nesse caso a garantia do difícil vale a partir daí.

### Opções do menu

| Opção | Valores | Padrão |
|---|---|---|
| Modo | 2 jogadores, contra o computador, treino | contra o computador |
| Dificuldade | fácil, médio, difícil (só contra o computador) | médio |
| Nomes | até 14 caracteres | Jogador 1 / Jogador 2 |
| Pontos para vencer | 1 a 10 | 3 |
| Gravidade | número livre; atalhos Terra 9.8, Lua 1.6, Marte 3.7, Júpiter 24.8 | 9.8 |
| Garoa | camada visual de chuvisco | desligada |

## Física

Igual ao QBasic: as "unidades" da tela original de 640 px são pixels lógicos do campo 640×400
(`POS_SCALE = 1`):

```
x(t) = x0 + (vx·t + ½·(vento/5)·t²)
y(t) = y0 − (vy·t − ½·g·t²)
vx = cos(ângulo)·velocidade·direção    vy = sin(ângulo)·velocidade
```

A simulação anda em passos fixos de `DT = 0,05` (120 passos por segundo real, 6 unidades de tempo
por segundo) e verifica colisão a cada ~1,5 px do caminho. O vento da rodada é um inteiro de −5 a 5,
com 1/3 de chance de somar até ±9.

## Parâmetros

Valores em `game/constants.ts`, salvo indicação.

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 640 × 400 | resolução lógica (física, colisão, posições) |
| `SCALE` (`game/hires.ts`) | 2 | o canvas tem 1280×800 e os sprites ganham o dobro de detalhe (Scale2x) |
| `POS_SCALE` | 1 | unidades QBasic → pixels |
| `DT` / `SUBSTEPS_PER_SECOND` | 0,05 / 120 | passo da física / velocidade do voo na tela |
| `MAX_FLIGHT_T` | 80 | tempo máximo de voo |
| `DEFAULT_GRAVITY` | 9,8 | gravidade inicial |
| `ANGLE_MIN/MAX`, `VELOCITY_MIN/MAX` | 0–180, 1–200 | limites dos campos |
| `RIDER_SIZE` / `RIDER_WHEEL_ROW` | 40 / 38 | quadro do motoboy e linha das rodas |
| `PILOT_BOX` | x19 y9 10×8 | área da cabeça (vitória direta) |
| `MOTO_BOX` | x1 y17 33×22 | área da moto (baú, chassi, rodas) |
| `MOTO_HP` | 3 | acertos até destruir a moto |
| `CRATER_RADIUS` | 6 | cratera de capacete no prédio |
| `DESTROY_CRATER_RADIUS` | 12 | cratera sob a moto destruída |
| `SUN_RECT` | x310 y6 20×20 | área que assusta o sol |
| `THINK_MS` / `ANNOUNCE_MS` (engine.ts) | 800 / 900 ms | computador "pensando" / mostrando o tiro |
| `ROUND_OVER_MS` (engine.ts) | 2800 ms | comemoração antes da próxima rodada |
| `EXPLOSION_FRAME_MS` (engine.ts) | 110 ms | duração de cada quadro de explosão |
| `ANGLE_RANGE` / `VELOCITY_RANGE` (ai.ts) | 15–88 / 10–160 | tiros que o computador considera |

### Cidade (`game/city.ts`)

| Prédio | Largura | Andar | Topo | Base | Recebe motoboy |
|---|---|---|---|---|---|
| Copan | 48 | 3 (onda a cada 6) | 6 | 8 | sim |
| Edifício Itália | 36 | 4 | 9 | 6 | sim |
| Altino Arantes (Banespa) | 40 | 4 | 27 | 6 | não (topo escalonado) |
| Martinelli | 40 | 5 | 11 | 7 | não (palacete no topo) |
| Predinho pichado | 32 | 5 | 14 | 6 | não (estreito demais para a moto) |
| Torre Faria Lima | 36 | 3 | 6 | 6 | sim |
| MASP | 56 | altura fixa 30 | — | — | não (fica só no miolo, no máximo 1) |

A cidade preenche os 640 px com prédios aleatórios (15 a 18 por rodada), alturas de 60 a 270 px
(o MASP tem altura fixa e aparece no máximo uma vez). Os motoboys **não têm lugar fixo**: o jogador 1
aparece num prédio de telhado reto (largura ≥ 36, altura ≥ 60) cujo centro esteja nos primeiros
230 px, e o jogador 2 num prédio parecido nos últimos 230 px, com pelo menos 260 px entre eles. Um
prédio candidato é recusado se algum vizinho for mais de 110 px mais alto que ele (o motoboy ficaria
encurralado). Ajuste em `ZONE_P1`, `ZONE_P2`, `MIN_RIDER_GAP` e `MAX_NEIGHBOR_RISE`.

## Som

Todos os efeitos são sintetizados com WebAudio em `game/sound.ts` (nenhum arquivo de áudio): sopro e
"pop" ao arremessar, assobio contínuo durante o voo (o tom sobe e desce com a altura do capacete e
acompanha o lado da tela), explosão no prédio, estouro na moto, "bonk" na cabeça, explosão grande
quando a moto é destruída, susto do sol, queda fora do campo, jingle de rodada e fanfarra de fim de
jogo. O botão **Som** da barra de cima liga/desliga e a escolha fica em
`localStorage` (`capacete-voador:som`). O áudio só começa depois do primeiro clique ou tecla
(exigência dos navegadores).

## Rodando só este jogo

Ele roda dentro do hub: `npm run dev` na raiz e abra `#/jogos/capacete-voador`.
