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
| `GOAL_GROWTH` (RN-50) | 1,18 | 1,12 | Com 1,18 a meta do dia 20 (≈ R$ 1.857) fica fora do alcance de qualquer estratégia testada; com 1,12 vale ≈ R$ 603 e o `equilibrado` cumpre o dia 20 em ~50% das tentativas |
| `CHARM_GIFT` (RN-62) | 0,5 | 1,5 | Com 0,5 o brinde dava mais trabalho que encanto e a reputação não subia mais que sem brinde (54% das sementes); com 1,5 sobe (84%) |
| `PATIENCE` (RN-06) | 45 / 40 / 35 s | 90 / 80 / 70 s | Retorno de teste: dava para atender só 3 clientes sozinho |
| `QUEUE_CALM_STEP`/`QUEUE_CALM_MIN` (RN-06b, novo) | — | 0,2 / 0,3 | Quem está atrás na fila gasta a paciência mais devagar (1,0; 0,8; 0,6; 0,4; 0,3…) |
| `DECAY_DELAY`/`DECAY_PER_SECOND` (RN-25) | 10 s / 2 pontos/s | 20 s / 1 ponto/s | Retorno de teste: o pastel pronto durava pouco; agora dura mais que o dobro |
| `REPUTATION_RATE_GAIN_UP` (RN-62) | ×2 | ×4 acima da taxa 0,75 (a perda segue ×2) | Retorno de teste: com a reputação em 1,0 um dia perfeito dava só +0,5, e a mínima de 2,0 (dias 1–5) travava o dia 1 mesmo com lucro acima da meta. Agora um dia perfeito dá +1,0 |

Além dos valores (P), a spec ganhou a RN-06b (calma por posição na fila) e a RN-36a (aviso antes de abrir a feira), e a RN-170 passou a manter moenda e limpeza ativas durante a pausa do tutorial. Nenhum número aleatório mudou; chegada (RN-02), preços e tempos ficaram como na spec.

## O que os robôs jogam

- **Jogador automático** (`sim/player.ts`): anota, monta, frita e tira no ponto, troca óleo, varre, entrega e cobra; não opera mesas nem Expedição.
- **Todos** regulam o preço pela reputação (`optimizePrices`), como um jogador atento.
- **solo:** só o pasteleiro, sem compras além do estoque sugerido.
- **armadilha:** como o solo, liga o delivery no dia 5 e aceita toda oferta com um toque; sem equipe, as comandas não são embaladas e são canceladas (peso 3,0).
- **brinde-max (critério):** a reputação sobe pelo menos como a do equilibrado (ou ambas no teto) e o lucro fica abaixo do dele em ≥ 3 dos 4 primeiros dias; com a economia mais folgada a comparação com a meta deixou de discriminar.
- **brinde-max:** como o equilibrado, mas compra a caixa térmica primeiro, contrata um funcionário e liga brinde 2 + chorinho 3 (a sugestão de compra do jogo passou a contar o brinde e o chorinho).
- **equilibrado:** alarme e tacho grande, caixa térmica, estufa, novas receitas e tacho extra; contrata quando perde meta com fila perdendo gente.

## Resultado por robô (50 sementes)

| Robô | Critério | Sementes que passaram | Resultado |
|---|---|---|---|
| `solo` | Metas dos dias 1 a 3 cumpridas (piso de equilíbrio) | 50/50 (100%) | passou |
| `armadilha` | Delivery no dia 5 sem equipe derruba a reputação no mesmo dia | 50/50 (100%) | passou |
| `brinde-max` | Brinde 2 + chorinho 3 com equipe: nos 4 primeiros dias a reputação sobe pelo menos como a do equilibrado (ou ambas no teto) e o lucro fica abaixo do dele em ≥ 3 | 50/50 (100%) | passou |
| `equilibrado` | Campanha de 20 dias vencível e meta do dia 20 não trivial | 50/50 (100%) | passou |

Cada fechamento de dia dos robôs também confere que o save continua válido (ida e volta por JSON).

## Tabelas por dia (média das sementes; só a primeira tentativa de cada dia)

### `solo`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 157 | 70 | 100% | 3.8 | 19 | 2 | 0 | 50 |
| 2 | 174 | 78 | 100% | 4.5 | 19 | 2 | 0 | 50 |
| 3 | 213 | 88 | 100% | 4.8 | 19 | 3 | 0 | 50 |
| 4 | 266 | 98 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 5 | 291 | 110 | 100% | 5.0 | 20 | 4 | 0 | 50 |
| 6 | 307 | 123 | 100% | 5.0 | 22 | 3 | 0 | 50 |
| 7 | 314 | 138 | 100% | 5.0 | 22 | 4 | 0 | 50 |
| 8 | 324 | 155 | 100% | 5.0 | 23 | 5 | 0 | 50 |
| 9 | 325 | 173 | 100% | 5.0 | 23 | 5 | 0 | 50 |
| 10 | 317 | 194 | 100% | 5.0 | 23 | 8 | 0 | 50 |
| 11 | 322 | 217 | 96% | 5.0 | 24 | 9 | 0 | 50 |
| 12 | 325 | 244 | 96% | 5.0 | 25 | 10 | 0 | 50 |
| 13 | 318 | 273 | 82% | 5.0 | 25 | 12 | 0 | 50 |
| 14 | 294 | 305 | 50% | 4.9 | 24 | 14 | 0 | 50 |
| 15 | 291 | 342 | 22% | 4.9 | 25 | 16 | 0 | 50 |
| 16 | 281 | 383 | 3% | 4.9 | 23 | 16 | 0 | 31 |
| 17 | 241 | 429 | 0% | 4.9 | 25 | 18 | 0 | 3 |

### `armadilha`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 157 | 70 | 100% | 3.8 | 19 | 2 | 0 | 50 |
| 2 | 174 | 78 | 100% | 4.5 | 19 | 2 | 0 | 50 |
| 3 | 213 | 88 | 100% | 4.8 | 19 | 3 | 0 | 50 |
| 4 | 266 | 98 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 5 | 36 | 110 | 4% | 4.6 | 10 | 12 | 11 | 50 |

### `brinde-max`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 157 | 70 | 100% | 3.8 | 19 | 2 | 0 | 50 |
| 2 | 176 | 78 | 100% | 4.5 | 19 | 2 | 0 | 50 |
| 3 | 212 | 88 | 100% | 4.9 | 19 | 3 | 0 | 50 |
| 4 | 262 | 98 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 5 | 286 | 110 | 86% | 5.0 | 19 | 4 | 0 | 50 |
| 6 | 229 | 123 | 68% | 5.0 | 19 | 5 | 0 | 50 |
| 7 | 163 | 138 | 52% | 5.0 | 19 | 7 | 0 | 50 |
| 8 | 147 | 155 | 38% | 5.0 | 20 | 6 | 0 | 48 |
| 9 | 123 | 173 | 25% | 5.0 | 21 | 6 | 0 | 32 |
| 10 | 129 | 194 | 18% | 5.0 | 24 | 5 | 0 | 17 |
| 11 | 214 | 217 | 33% | 5.0 | 27 | 5 | 0 | 6 |
| 12 | 180 | 244 | 0% | 5.0 | 28 | 5 | 0 | 4 |
| 13 | 84 | 273 | 0% | 5.0 | 30 | 7 | 1 | 1 |

### `equilibrado`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 157 | 70 | 100% | 3.8 | 19 | 2 | 0 | 50 |
| 2 | 176 | 78 | 100% | 4.5 | 19 | 2 | 0 | 50 |
| 3 | 212 | 88 | 100% | 4.9 | 19 | 3 | 0 | 50 |
| 4 | 262 | 98 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 5 | 325 | 110 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 6 | 333 | 123 | 100% | 5.0 | 21 | 3 | 0 | 50 |
| 7 | 333 | 138 | 100% | 5.0 | 22 | 4 | 0 | 50 |
| 8 | 329 | 155 | 100% | 5.0 | 22 | 5 | 0 | 50 |
| 9 | 327 | 173 | 100% | 5.0 | 23 | 4 | 0 | 50 |
| 10 | 320 | 194 | 100% | 5.0 | 22 | 6 | 0 | 50 |
| 11 | 316 | 217 | 98% | 5.0 | 25 | 5 | 0 | 50 |
| 12 | 319 | 244 | 94% | 5.0 | 25 | 6 | 0 | 50 |
| 13 | 313 | 273 | 80% | 5.0 | 26 | 7 | 0 | 50 |
| 14 | 318 | 305 | 56% | 5.0 | 28 | 7 | 0 | 50 |
| 15 | 331 | 342 | 46% | 5.0 | 30 | 7 | 0 | 50 |
| 16 | 326 | 383 | 22% | 5.0 | 31 | 7 | 0 | 50 |
| 17 | 527 | 429 | 66% | 5.0 | 37 | 3 | 0 | 50 |
| 18 | 624 | 481 | 84% | 5.0 | 39 | 4 | 0 | 50 |
| 19 | 640 | 538 | 82% | 5.0 | 40 | 4 | 0 | 50 |
| 20 | 604 | 603 | 50% | 5.0 | 41 | 5 | 0 | 50 |
