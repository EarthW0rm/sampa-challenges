# Calibração dos valores (P) — Pastel de Feira

Relatório da TF-123-02 (`plan.md` 5.4). Gerado por:

```bash
npx esbuild src/games/pastel-de-feira/sim/run.ts --bundle --platform=node --format=esm --outfile=<tmp>/pf-sim.mjs
node <tmp>/pf-sim.mjs --bots all --seeds 50 --days 20
```

## Valores (P) alterados

| Parâmetro | Spec | Final | Motivo |
|---|---|---|---|
| `GOAL_BASE` (RN-50) | R$ 80 | R$ 70 | O piso (`solo`) cumpria os dias 1 a 3 em 76% das sementes, abaixo de 80% |
| `GOAL_GROWTH` (RN-50) | 1,18 | 1,10 | Com 1,18 a meta do dia 20 (≈ R$ 1.857) fica fora do alcance de qualquer estratégia testada; com 1,10 vale ≈ R$ 428 |
| `CHARM_GIFT` (RN-62) | 0,5 | 1,5 | Com 0,5 o brinde dava mais trabalho que encanto e a reputação não subia mais que sem brinde (54% das sementes); com 1,5 sobe (84%) |

| `PATIENCE` (RN-06) | 45 / 40 / 35 s | 70 / 60 / 50 s | Retorno de teste: dava para atender só 3 clientes sozinho; com mais paciência o robô `solo` passou de 84% para 94% e os demais seguem ≥ 80% |

Nenhuma regra (RN) foi alterada: só valores marcados (P). Chegada (RN-02), preços e tempos ficaram como na spec.

## O que os robôs jogam

- **Jogador automático** (`sim/player.ts`): anota, monta, frita e tira no ponto, troca óleo, varre, entrega e cobra; não opera mesas nem Expedição.
- **Todos** regulam o preço pela reputação (`optimizePrices`), como um jogador atento.
- **solo:** só o pasteleiro, sem compras além do estoque sugerido.
- **armadilha:** como o solo, liga o delivery no dia 5 e aceita toda oferta com um toque; sem equipe, as comandas não são embaladas e são canceladas (peso 3,0).
- **brinde-max:** como o equilibrado, mas compra a caixa térmica primeiro, contrata um funcionário e liga brinde 2 + chorinho 3 (a sugestão de compra do jogo passou a contar o brinde e o chorinho).
- **equilibrado:** alarme e tacho grande, caixa térmica, estufa, novas receitas e tacho extra; contrata quando perde meta com fila perdendo gente.

## Resultado por robô (50 sementes)

| Robô | Critério | Sementes que passaram | Resultado |
|---|---|---|---|
| `solo` | Metas dos dias 1 a 3 cumpridas (piso de equilíbrio) | 47/50 (94%) | passou |
| `armadilha` | Delivery no dia 5 sem equipe derruba a reputação no mesmo dia | 50/50 (100%) | passou |
| `brinde-max` | Brinde 2 + chorinho 3 com equipe: nos 4 primeiros dias a reputação sobe mais que a do equilibrado (ou ambas no teto) e o lucro fica abaixo da meta em ≥ 3 | 49/50 (98%) | passou |
| `equilibrado` | Campanha de 20 dias vencível e meta do dia 20 não trivial | 50/50 (100%) | passou |

Cada fechamento de dia dos robôs também confere que o save continua válido (ida e volta por JSON).

## Tabelas por dia (média das sementes; só a primeira tentativa de cada dia)

### `solo`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 151 | 70 | 100% | 3.3 | 18 | 2 | 0 | 50 |
| 2 | 148 | 77 | 98% | 3.6 | 19 | 2 | 0 | 50 |
| 3 | 157 | 85 | 96% | 3.8 | 19 | 3 | 0 | 50 |
| 4 | 164 | 93 | 100% | 4.0 | 20 | 3 | 0 | 50 |
| 5 | 176 | 102 | 96% | 4.1 | 19 | 3 | 0 | 50 |
| 6 | 194 | 113 | 100% | 4.4 | 21 | 3 | 0 | 50 |
| 7 | 204 | 124 | 94% | 4.5 | 22 | 4 | 0 | 50 |
| 8 | 217 | 136 | 98% | 4.6 | 22 | 5 | 0 | 50 |
| 9 | 219 | 150 | 86% | 4.7 | 23 | 5 | 0 | 50 |
| 10 | 213 | 165 | 80% | 4.7 | 21 | 7 | 0 | 50 |
| 11 | 224 | 182 | 78% | 4.7 | 23 | 9 | 0 | 50 |
| 12 | 226 | 200 | 80% | 4.7 | 24 | 8 | 0 | 50 |
| 13 | 222 | 220 | 52% | 4.6 | 23 | 11 | 0 | 50 |
| 14 | 212 | 242 | 15% | 4.5 | 23 | 11 | 0 | 40 |
| 15 | 190 | 266 | 0% | 4.5 | 23 | 13 | 0 | 22 |
| 16 | 143 | 292 | 0% | 4.5 | 19 | 15 | 0 | 1 |

### `armadilha`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 151 | 70 | 100% | 3.3 | 18 | 2 | 0 | 50 |
| 2 | 148 | 77 | 98% | 3.6 | 19 | 2 | 0 | 50 |
| 3 | 157 | 85 | 96% | 3.8 | 19 | 3 | 0 | 50 |
| 4 | 164 | 93 | 100% | 4.0 | 20 | 3 | 0 | 50 |
| 5 | -35 | 102 | 0% | 3.3 | 8 | 9 | 11 | 50 |

### `brinde-max`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 151 | 70 | 100% | 3.3 | 18 | 2 | 0 | 50 |
| 2 | 151 | 77 | 98% | 3.6 | 19 | 2 | 0 | 50 |
| 3 | 150 | 85 | 94% | 3.8 | 19 | 3 | 0 | 50 |
| 4 | 156 | 93 | 96% | 4.0 | 19 | 3 | 0 | 50 |
| 5 | 183 | 102 | 100% | 4.2 | 19 | 3 | 0 | 50 |
| 6 | 166 | 113 | 82% | 4.3 | 20 | 4 | 0 | 50 |
| 7 | 91 | 124 | 40% | 4.5 | 19 | 6 | 0 | 50 |
| 8 | 113 | 136 | 39% | 4.9 | 20 | 4 | 0 | 49 |
| 9 | 85 | 150 | 22% | 4.9 | 20 | 4 | 0 | 41 |
| 10 | 89 | 165 | 18% | 5.0 | 21 | 3 | 0 | 22 |
| 11 | 58 | 182 | 0% | 5.0 | 19 | 4 | 0 | 5 |

### `equilibrado`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 151 | 70 | 100% | 3.3 | 18 | 2 | 0 | 50 |
| 2 | 151 | 77 | 98% | 3.6 | 19 | 2 | 0 | 50 |
| 3 | 150 | 85 | 94% | 3.8 | 19 | 3 | 0 | 50 |
| 4 | 156 | 93 | 96% | 4.0 | 19 | 3 | 0 | 50 |
| 5 | 183 | 102 | 100% | 4.2 | 19 | 3 | 0 | 50 |
| 6 | 209 | 113 | 100% | 4.4 | 21 | 3 | 0 | 50 |
| 7 | 223 | 124 | 94% | 4.5 | 22 | 3 | 0 | 50 |
| 8 | 231 | 136 | 94% | 4.7 | 22 | 3 | 0 | 50 |
| 9 | 240 | 150 | 92% | 4.8 | 23 | 3 | 0 | 50 |
| 10 | 227 | 165 | 78% | 4.8 | 22 | 4 | 0 | 50 |
| 11 | 253 | 182 | 78% | 4.9 | 26 | 3 | 0 | 50 |
| 12 | 285 | 200 | 94% | 5.0 | 27 | 3 | 0 | 50 |
| 13 | 277 | 220 | 82% | 5.0 | 28 | 3 | 0 | 50 |
| 14 | 288 | 242 | 74% | 5.0 | 29 | 4 | 0 | 50 |
| 15 | 294 | 266 | 62% | 5.0 | 31 | 3 | 0 | 50 |
| 16 | 277 | 292 | 44% | 4.9 | 31 | 4 | 0 | 50 |
| 17 | 343 | 322 | 62% | 5.0 | 36 | 2 | 0 | 50 |
| 18 | 369 | 354 | 54% | 5.0 | 37 | 2 | 0 | 50 |
| 19 | 470 | 389 | 68% | 5.0 | 39 | 2 | 0 | 50 |
| 20 | 584 | 428 | 80% | 5.0 | 39 | 2 | 0 | 50 |
