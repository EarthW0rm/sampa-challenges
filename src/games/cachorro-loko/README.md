# Cachorro Loko

Jogo de esteiras em pixel art. Um vira-lata caramelo motoboy trabalha para o **LOKO DOG**, uma
lanchonete de cachorro-quente no centro de São Paulo. Os pedidos descem por esteiras em zigue-zague
e ele precisa pegar cada pacote no baú antes que caia na rua. Jogo infinito, com recorde.

Rota no hub: `#/jogos/cachorro-loko`.

## Como jogar

| Controle | Ação |
|---|---|
| ← → ou A / D | andar pela rua |
| P ou Esc | pausar (o jogo também pausa quando a janela perde o foco) |
| Celular | segurar o lado esquerdo ou direito da tela |

### Regras

- O chapeiro joga os pedidos na esteira de cima. São 4 esteiras em zigue-zague (→ ← → ←).
- No fim das 3 primeiras esteiras há um **desvio**: verde ↓ manda o pacote para a esteira de baixo,
  vermelho → joga na rua. A última esteira sempre joga na rua.
- **O desvio troca a cada pacote que passa**, sem relógio: se o primeiro pacote desceu, o segundo vai
  para a rua, o terceiro desce de novo, e assim por diante (bombas também contam). A placa sempre
  mostra o destino do próximo pacote e pisca por 0,5 s logo depois de trocar. Cada esteira tem o
  seu desvio, e os três começam em posições sorteadas.
- Pegue o pacote com o baú ou o corpo do cachorro antes que toque o asfalto. Cada pacote vale 1 ponto.
- **3 vidas.** Pacote que cai na rua tira uma. Pegar uma bomba tira uma e deixa o cachorro tonto
  por 1 s. Bomba que cai na rua explode sem dano.
- A cada 10 entregas sobe o **nível**: esteiras mais rápidas e pacotes mais frequentes. O recorde
  fica salvo no navegador.

### Pacotes

| Pacote | Efeito | Duração |
|---|---|---|
| Caixa, pizza, sacola | +1 ponto (só muda o visual) | — |
| Turbo | moto 54% mais rápida, com fogo no escapamento | 8 s |
| Grau | a moto empina sozinha; a área de pega sobe 10 px (pega antes) | 10 s |
| Ímã | puxa para o baú os pacotes que caem a até 52 px (bombas também!) | 8 s |
| Vida | +1 coração, até 5 | — |
| Dobro | cada pacote vale 2 | 10 s |
| Bomba | não pegue | — |

Todo pacote que não é bomba vale ponto, inclusive os especiais. Pegar o mesmo poder de novo
reinicia o tempo dele.

## Parâmetros

### `game/constants.ts`

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 320 × 200 | resolução lógica (posições e colisões) |
| `SCALE` (`game/hires.ts`) | 2 | o canvas tem 640×400 e os sprites ganham o dobro de detalhe (Scale2x) |
| `GROUND_Y` | 180 | linha do asfalto onde o pacote se perde |
| `GRAVITY` | 320 px/s² | queda dos pacotes |
| `BOX_SIZE` | 12 | tamanho dos pacotes |
| `DOG_FRAME` / `DOG_WHEEL_ROW` / `DOG_BOTTOM` | 40 / 38 / 190 | quadro do cachorro e onde as rodas tocam a rua |
| `DOG_SPEED` / `DOG_TURBO_SPEED` | 160 / 215 px/s | velocidade da moto |
| `DOG_MIN_X` / `DOG_MAX_X` | −2 / 282 | limites da rua |
| `CATCH_RECT` | x1 y10 34×16 | área de pega no quadro virado para a direita (espelha ao virar) |
| `GRAU_LIFT` | 10 px | quanto o grau sobe a área de pega |
| `IMA_RANGE` | 52 px | alcance horizontal do ímã |
| `BELTS` | 4 esteiras (veja abaixo) | posição, altura e sentido |
| `RESTAURANT_POS`, `CHEF_POS`, `SPAWN_POS` | (104,2), (126,26), (172,40) | restaurante, chapeiro e boca de saída |
| `START_LIVES` / `MAX_LIVES` | 3 / 5 | vidas |
| `POWER_DURATION` | turbo 8, grau 10, ímã 8, dobro 10 s | duração dos poderes |
| `BOMBS_FROM_SCORE` | 15 | entregas antes de aparecer bomba |
| `DIZZY_TIME` | 1 s | tontura ao pegar bomba |

Esteiras (a ponta de cada uma fica em cima da próxima, para o pacote cair nela):

| Esteira | x0 → x1 | y | Sentido | Pacote cai na rua perto de |
|---|---|---|---|---|
| 1 | 166 → 250 | 58 | → | x ≈ 265 |
| 2 | 64 → 262 | 84 | ← | x ≈ 40 |
| 3 | 52 → 270 | 110 | → | x ≈ 285 |
| 4 | 84 → 282 | 136 | ← (sempre na rua) | x ≈ 65 |

### Curva de dificuldade (`game/engine.ts`)

`nível = floor(entregas / 10) + 1`

| Grandeza | Fórmula | Nível 1 | Nível 5 | Limite |
|---|---|---|---|---|
| Velocidade das esteiras | `24 + 4·(nível−1)` px/s | 24 | 40 | 64 |
| Intervalo entre pedidos | `3,4 · 0,9^(nível−1)` s (±15% aleatório) | 3,4 | 2,2 | 1,1 |
| Chance de bomba | `10% + 1% por nível acima do 2` (a partir de 15 entregas) | — | 13% | 18% |

Outros números do motor: o desvio pisca por `FLASH_TIME = 0,5 s` depois de trocar (só aviso
visual); pacote especial sai depois de 5 comuns com 22% de chance (ou
garantido no 11º), vida com peso 0,7 (só se faltar coração); pacote jogado na rua sai com
`vx = 18 a 28 px/s` e um pulinho de `vy = −30`; o ímã atua abaixo de y = 70.

Em testes com um robô jogando (25 partidas), a média ficou em ~29 entregas (≈107 s) por partida, com
a primeira vida perdida por volta dos 60 s. Com os desvios trocando por relógio eram ~19 entregas
(≈80 s). O robô enxerga a ordem dos pacotes perfeitamente, então uma pessoa deve ir um pouco pior.

## Rodando só este jogo

Ele roda dentro do hub: `npm run dev` na raiz e abra `#/jogos/cachorro-loko`.
