# Pinball Paulista

Mesa de pinball vertical em pixel art, no clima da Avenida Paulista: bumpers-semáforo, corredores
azuis (faixa de ônibus), o **Minhocão** que prende a bola, o MASP ao fundo e o cachorro motoboy
na capa. Uma mesa completa, 3 bolas, recorde salvo no navegador.

Rota no hub: `#/jogos/pinball-paulista`.

## Como jogar

| Controle | Ação |
|---|---|
| ← ou Z | flipper esquerdo |
| → ou / | flipper direito |
| Espaço (segurar e soltar) ou ↓ | lançador: quanto mais tempo segurado, mais forte |
| N | sacudir a mesa (nudge) |
| P ou Esc | pausar (a janela perdendo o foco também pausa) |
| Celular | tocar a metade esquerda/direita da mesa = flippers; botão **Lançar** (segure e solte); botão **Sacudir** |

### A mesa

- **Semáforos (3 bumpers):** a cada batida a lâmpada avança: 0–2 batidas vermelho, 3–5 amarelo,
  6+ verde (+500 no 6º toque). Os 3 verdes juntos ligam a **Onda Verde**: bumpers em dobro por 15 s.
- **Raias do topo (semáforo):** a bola que passa acende a raia; apertar um flipper gira as luzes.
  As 3 acesas = **multiplicador do bônus +1** (até ×5) e 1000 pontos.
- **MOTOBOY:** 7 placas nas guias dos corredores azuis (3 à esquerda, 4 à direita). Cada letra nova
  vale 500 (50 se já estava acesa). As 7 acesas = **Multiball** (2 bolas extras) + 2000.
- **Minhocão (buraco central):** prende a bola por ~1 s, dá 250 pontos e um **prêmio surpresa** (ciclo
  bônus, letra, segura-bola, multiplicador, 10.000 pontos, letra, onda verde, bola extra — esta só
  uma vez por jogo) e solta a bola para um dos lados. Depois de capturar, o buraco fica "entupido"
  por 4 s (evita ficar repetindo o prêmio).
- **Corredores (spinner):** a roda de moto gira com a bola e dá 10 pontos por meia volta.
- **Estilingues:** chutam a bola para fora (com um pouco de acaso). Flippers listrados de barreira.
- **Segura-bola:** nos 12 s depois de lançar, uma bola perdida volta de graça.
- **Bônus de fim de bola:** pontos acumulados (bumper 10, alvo 100, raia 50, Minhocão 100…) × multiplicador.
- **Tilt:** sacudir mais de 3 vezes seguidas (a conta cai 1 a cada 4 s) desliga os flippers e
  a bola é perdida sem bônus.

## Parâmetros

### `game/constants.ts`

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 240 × 400 | campo lógico (canvas 480×800 com `SCALE` 2) |
| `BALL_R` | 5 | raio da bola |
| `GRAVITY` | 430 px/s² | queda ao longo da mesa inclinada |
| `MAX_SPEED` | 900 px/s | velocidade máxima da bola |
| `STEP` | 1/480 s | passo fixo da física (8 subpassos por quadro a 60 fps) |
| `E_WALL` / `E_FLIPPER` | 0,45 / 0,35 | elasticidade de paredes e flippers |
| `REST_SPEED` | 40 px/s | abaixo disso o quique é zerado (a bola assenta em vez de tremer) |
| `FLIPPER_LEN`, `FLIPPER_R0/R1` | 36, 6 → 3,6 | comprimento e raio base/ponta (cápsula) |
| `FLIPPER_REST` / `FLIPPER_UP` | +30° / −26° | ângulos |
| `FLIPPER_OMEGA_UP` / `_DOWN` | 15 / 9 rad/s | velocidade angular (a ponta chega a ~540 px/s) |
| `BUMPER_R`, `BUMPER_KICK` | 11, 270 px/s | bumper e velocidade mínima de saída |
| `SLING_KICK` | 230 px/s | estilingue (±15–25% e ±20° sorteados) |
| `KICKOUT`, `KICKOUT_HOLD` | (111,232) r7, 1,1 s | buraco do Minhocão |
| `PLUNGER_MIN` / `PLUNGER_RANGE` / `PLUNGER_CHARGE_TIME` | 430 / 470 px/s / 0,9 s | lançamento fraco não sobe a rampa; forte vai a ~900 |
| `BALLS_PER_GAME`, `SAVER_SECONDS`, `MAX_MULT`, `NUDGE_LIMIT` | 3, 12, 5, 3 | regras |

### Geometria (`game/geometry.ts`)

Paredes são segmentos (a bola é um círculo); a mesa é simétrica em torno de x = 111 (`mx(x) = 222 − x`)
exceto o arco, centrado em x = 120 para incluir a rampa de lançamento (x 214–232). Os alvos MOTOBOY
só contam quando a bola está do lado certo da guia (`nx`). O portão de mão única (`GATE`) deixa a bola
entrar no campo vinda da rampa, mas não voltar.
