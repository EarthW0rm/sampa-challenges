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
| `solo` | Metas dos dias 1 a 3 cumpridas (piso de equilíbrio) | 42/50 (84%) | passou |
| `armadilha` | Delivery no dia 5 sem equipe derruba a reputação no mesmo dia | 50/50 (100%) | passou |
| `brinde-max` | Brinde 2 + chorinho 3 com equipe: nos 4 primeiros dias a reputação sobe mais que a do equilibrado (ou ambas no teto) e o lucro fica abaixo da meta em ≥ 3 | 42/50 (84%) | passou |
| `equilibrado` | Campanha de 20 dias vencível e meta do dia 20 não trivial | 50/50 (100%) | passou |

## Tabelas por dia (média das sementes; só a primeira tentativa de cada dia)

### `solo`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 137 | 70 | 100% | 3.2 | 18 | 4 | 0 | 50 |
| 2 | 135 | 77 | 88% | 3.3 | 18 | 4 | 0 | 50 |
| 3 | 140 | 85 | 96% | 3.4 | 18 | 4 | 0 | 50 |
| 4 | 141 | 93 | 86% | 3.5 | 19 | 5 | 0 | 50 |
| 5 | 129 | 102 | 72% | 3.5 | 18 | 6 | 0 | 50 |
| 6 | 150 | 113 | 74% | 3.6 | 21 | 5 | 0 | 50 |
| 7 | 150 | 124 | 72% | 3.7 | 21 | 6 | 0 | 50 |
| 8 | 137 | 136 | 50% | 3.7 | 21 | 8 | 0 | 50 |
| 9 | 139 | 150 | 30% | 3.7 | 21 | 8 | 0 | 50 |
| 10 | 134 | 165 | 20% | 3.6 | 21 | 10 | 0 | 44 |
| 11 | 161 | 182 | 30% | 3.9 | 22 | 10 | 0 | 23 |
| 12 | 158 | 200 | 21% | 4.0 | 21 | 13 | 0 | 14 |
| 13 | 157 | 220 | 17% | 4.0 | 21 | 14 | 0 | 6 |
| 14 | 176 | 242 | 0% | 3.9 | 22 | 12 | 0 | 1 |

### `armadilha`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 137 | 70 | 100% | 3.2 | 18 | 4 | 0 | 50 |
| 2 | 135 | 77 | 88% | 3.3 | 18 | 4 | 0 | 50 |
| 3 | 140 | 85 | 96% | 3.4 | 18 | 4 | 0 | 50 |
| 4 | 141 | 93 | 86% | 3.5 | 19 | 5 | 0 | 50 |
| 5 | -30 | 102 | 0% | 2.7 | 8 | 15 | 11 | 50 |

### `brinde-max`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 137 | 70 | 100% | 3.2 | 18 | 4 | 0 | 50 |
| 2 | 137 | 77 | 88% | 3.3 | 18 | 4 | 0 | 50 |
| 3 | 127 | 85 | 86% | 3.4 | 18 | 4 | 0 | 50 |
| 4 | 123 | 93 | 76% | 3.5 | 19 | 6 | 0 | 50 |
| 5 | 119 | 102 | 66% | 3.8 | 19 | 6 | 0 | 50 |
| 6 | 108 | 113 | 52% | 4.2 | 20 | 5 | 0 | 50 |
| 7 | 67 | 124 | 39% | 4.5 | 19 | 7 | 0 | 46 |
| 8 | 42 | 136 | 10% | 4.7 | 18 | 9 | 0 | 40 |
| 9 | 40 | 150 | 0% | 4.9 | 21 | 7 | 0 | 18 |
| 10 | 45 | 165 | 0% | 5.0 | 22 | 10 | 0 | 3 |

### `equilibrado`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 137 | 70 | 100% | 3.2 | 18 | 4 | 0 | 50 |
| 2 | 137 | 77 | 88% | 3.3 | 18 | 4 | 0 | 50 |
| 3 | 127 | 85 | 86% | 3.4 | 18 | 4 | 0 | 50 |
| 4 | 123 | 93 | 76% | 3.5 | 19 | 6 | 0 | 50 |
| 5 | 129 | 102 | 72% | 3.8 | 19 | 6 | 0 | 50 |
| 6 | 149 | 113 | 70% | 4.2 | 22 | 4 | 0 | 50 |
| 7 | 195 | 124 | 94% | 4.5 | 24 | 3 | 0 | 50 |
| 8 | 200 | 136 | 74% | 4.6 | 24 | 4 | 0 | 50 |
| 9 | 234 | 150 | 80% | 4.8 | 26 | 3 | 0 | 50 |
| 10 | 251 | 165 | 88% | 4.9 | 27 | 4 | 0 | 50 |
| 11 | 249 | 182 | 84% | 4.9 | 29 | 2 | 0 | 50 |
| 12 | 264 | 200 | 82% | 4.9 | 29 | 3 | 0 | 50 |
| 13 | 274 | 220 | 78% | 5.0 | 31 | 3 | 0 | 50 |
| 14 | 283 | 242 | 58% | 5.0 | 33 | 3 | 0 | 50 |
| 15 | 297 | 266 | 66% | 5.0 | 34 | 3 | 0 | 50 |
| 16 | 324 | 292 | 66% | 5.0 | 35 | 3 | 0 | 50 |
| 17 | 341 | 322 | 60% | 5.0 | 38 | 3 | 0 | 50 |
| 18 | 376 | 354 | 54% | 5.0 | 38 | 3 | 0 | 50 |
| 19 | 447 | 389 | 60% | 5.0 | 40 | 2 | 0 | 50 |
| 20 | 562 | 428 | 76% | 5.0 | 41 | 2 | 0 | 50 |
