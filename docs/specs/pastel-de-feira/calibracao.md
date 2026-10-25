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
| Início da paciência (RN-06) | Ao chegar ao fim da fila | Ao ter o pedido anotado | Pedido do jogo: o cliente só começa a perder a paciência depois de anotado. Antes disso ele espera na fila (a fila cheia, RN-04, segue limitando). Os 4 robôs seguem em 50/50 |
| Receitas (RN-30) | Queijo com orégano; Bauru presunto + muçarela; Pizza muçarela + presunto + tomate + orégano | Queijo só muçarela; Bauru muçarela + presunto + tomate; Pizza tomate + muçarela + orégano | Pedido do jogo: cada sabor com o recheio que o nome diz. Os 4 robôs seguem em 50/50 |
| `TACHO.basketPrice` (RN-73, novo) | Tacho grande R$ 400 (2 → 4) | Cesto extra R$ 200 cada | O Tacho grande virou cesto avulso: mesmo custo para encher um tacho, comprável aos poucos e em ordem entre os tachos. Com a Montagem colocando em qualquer tacho, o Fritador assumindo tachos livres e indo à bancada para montar (RN-40, RN-44) e o Fritador cuidando só do tacho dele (coloca, tira e troca o óleo, sem montar; RN-44, RN-45), os 4 robôs seguem em 50/50 |
| `REPUTATION_RATE_GAIN_UP` (RN-62) | ×2 | ×4 acima da taxa 0,75 (a perda segue ×2) | Retorno de teste: com a reputação em 1,0 um dia perfeito dava só +0,5, e a mínima de 2,0 (dias 1–5) travava o dia 1 mesmo com lucro acima da meta. Agora um dia perfeito dá +1,0 |

Além dos valores (P), a spec ganhou a RN-06b (calma por posição na fila) e a RN-36a (aviso antes de abrir a feira), e a RN-170 passou a manter moenda e limpeza ativas durante a pausa do tutorial. Nenhum número aleatório mudou; chegada (RN-02), preços e tempos ficaram como na spec.

## O que os robôs jogam

- **Jogador automático** (`sim/player.ts`): anota, monta, frita e tira no ponto, troca óleo, varre, entrega e cobra; não opera mesas nem Expedição.
- **Todos** regulam o preço pela reputação (`optimizePrices`), como um jogador atento.
- **solo:** só o pasteleiro, sem compras além do estoque sugerido.
- **armadilha:** como o solo, liga o delivery no dia 5 e aceita toda oferta com um toque; sem equipe, as comandas não são embaladas e são canceladas (peso 3,0).
- **brinde-max (critério):** a reputação sobe pelo menos como a do equilibrado (ou ambas no teto) e o lucro fica abaixo do dele em ≥ 3 dos 4 primeiros dias; com a economia mais folgada a comparação com a meta deixou de discriminar.
- **brinde-max:** como o equilibrado, mas compra a caixa térmica primeiro, contrata um funcionário e liga brinde 2 + chorinho 3 (a sugestão de compra do jogo passou a contar o brinde e o chorinho).
- **equilibrado:** alarme e dois cestos extras (tacho 1 com 4 cestos), caixa térmica, estufa, novas receitas e tacho extra; contrata quando perde meta com fila perdendo gente.

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
| 1 | 160 | 70 | 100% | 3.8 | 19 | 2 | 0 | 50 |
| 2 | 178 | 78 | 100% | 4.5 | 19 | 2 | 0 | 50 |
| 3 | 209 | 88 | 100% | 4.9 | 19 | 3 | 0 | 50 |
| 4 | 256 | 98 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 5 | 277 | 110 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 6 | 281 | 123 | 100% | 5.0 | 21 | 2 | 0 | 50 |
| 7 | 283 | 138 | 100% | 5.0 | 22 | 3 | 0 | 50 |
| 8 | 289 | 155 | 100% | 5.0 | 23 | 4 | 0 | 50 |
| 9 | 283 | 173 | 100% | 5.0 | 23 | 4 | 0 | 50 |
| 10 | 282 | 194 | 100% | 5.0 | 23 | 7 | 0 | 50 |
| 11 | 307 | 217 | 98% | 5.0 | 25 | 5 | 0 | 50 |
| 12 | 317 | 244 | 96% | 5.0 | 25 | 6 | 0 | 50 |
| 13 | 325 | 273 | 88% | 5.0 | 26 | 8 | 0 | 50 |
| 14 | 326 | 305 | 72% | 5.0 | 26 | 9 | 0 | 50 |
| 15 | 323 | 342 | 42% | 5.0 | 26 | 11 | 0 | 50 |
| 16 | 281 | 383 | 2% | 4.9 | 23 | 14 | 0 | 50 |
| 17 | 279 | 429 | 0% | 4.9 | 23 | 15 | 0 | 8 |

### `armadilha`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 160 | 70 | 100% | 3.8 | 19 | 2 | 0 | 50 |
| 2 | 178 | 78 | 100% | 4.5 | 19 | 2 | 0 | 50 |
| 3 | 209 | 88 | 100% | 4.9 | 19 | 3 | 0 | 50 |
| 4 | 256 | 98 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 5 | 24 | 110 | 2% | 4.6 | 9 | 12 | 11 | 50 |

### `brinde-max`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 160 | 70 | 100% | 3.8 | 19 | 2 | 0 | 50 |
| 2 | 179 | 78 | 100% | 4.5 | 19 | 2 | 0 | 50 |
| 3 | 209 | 88 | 100% | 4.9 | 19 | 2 | 0 | 50 |
| 4 | 265 | 98 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 5 | 287 | 110 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 6 | 277 | 123 | 100% | 5.0 | 21 | 3 | 0 | 50 |
| 7 | 273 | 138 | 90% | 5.0 | 21 | 5 | 0 | 50 |
| 8 | 205 | 155 | 60% | 5.0 | 19 | 8 | 0 | 48 |
| 9 | 153 | 173 | 31% | 5.0 | 22 | 7 | 0 | 48 |
| 10 | 155 | 194 | 29% | 5.0 | 25 | 5 | 0 | 45 |
| 11 | 156 | 217 | 26% | 5.0 | 27 | 4 | 0 | 31 |
| 12 | 179 | 244 | 12% | 5.0 | 28 | 5 | 0 | 17 |
| 13 | 224 | 273 | 25% | 5.0 | 27 | 7 | 0 | 4 |
| 14 | 372 | 305 | 100% | 5.0 | 27 | 11 | 0 | 2 |
| 15 | 353 | 342 | 50% | 5.0 | 27 | 11 | 0 | 2 |
| 16 | 363 | 383 | 0% | 5.0 | 29 | 12 | 0 | 2 |
| 17 | 419 | 429 | 0% | 5.0 | 32 | 6 | 0 | 1 |

### `equilibrado`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 160 | 70 | 100% | 3.8 | 19 | 2 | 0 | 50 |
| 2 | 179 | 78 | 100% | 4.5 | 19 | 2 | 0 | 50 |
| 3 | 209 | 88 | 100% | 4.9 | 19 | 2 | 0 | 50 |
| 4 | 265 | 98 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 5 | 287 | 110 | 100% | 5.0 | 20 | 3 | 0 | 50 |
| 6 | 276 | 123 | 100% | 5.0 | 21 | 3 | 0 | 50 |
| 7 | 305 | 138 | 100% | 5.0 | 22 | 4 | 0 | 50 |
| 8 | 317 | 155 | 100% | 5.0 | 22 | 5 | 0 | 50 |
| 9 | 321 | 173 | 100% | 5.0 | 22 | 4 | 0 | 50 |
| 10 | 323 | 194 | 100% | 5.0 | 22 | 6 | 0 | 50 |
| 11 | 321 | 217 | 98% | 5.0 | 25 | 5 | 0 | 50 |
| 12 | 320 | 244 | 94% | 5.0 | 26 | 6 | 0 | 50 |
| 13 | 321 | 273 | 78% | 5.0 | 26 | 7 | 0 | 50 |
| 14 | 307 | 305 | 54% | 5.0 | 27 | 7 | 0 | 50 |
| 15 | 311 | 342 | 44% | 5.0 | 30 | 6 | 0 | 50 |
| 16 | 367 | 383 | 30% | 5.0 | 34 | 5 | 0 | 50 |
| 17 | 545 | 429 | 68% | 5.0 | 37 | 3 | 0 | 50 |
| 18 | 649 | 481 | 94% | 5.0 | 37 | 5 | 0 | 50 |
| 19 | 636 | 538 | 86% | 5.0 | 38 | 5 | 0 | 50 |
| 20 | 637 | 603 | 64% | 5.0 | 40 | 6 | 0 | 50 |
