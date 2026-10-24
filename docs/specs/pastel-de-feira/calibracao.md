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

Nenhuma regra (RN) foi alterada. Chegada (RN-02), preços e tempos ficaram como na spec.

## Resultado por robô (50 sementes)

| Robô | Critério | Sementes que passaram | Resultado |
|---|---|---|---|
| `solo` | Metas dos dias 1 a 3 cumpridas (piso de equilíbrio) | 42/50 (84%) | passou |
| `armadilha` | Delivery no dia 5 sem equipe derruba a reputação no mesmo dia | 20/50 (40%) | NÃO convergiu |
| `brinde-max` | Reputação sobe e o lucro fica abaixo da meta | 7/50 (14%) | NÃO convergiu |
| `equilibrado` | Campanha de 20 dias vencível e meta do dia 20 não trivial | 50/50 (100%) | passou |

## Critérios que não convergiram (decisão do utilizador)

`armadilha` (40%) e `brinde-max` (14%) ficaram abaixo de 80%. Ajustar valores (P) não resolveu; o que falta são mecânicas que o jogador automático não opera ou pesos de regra:

- **armadilha:** o robô aceita todas as ofertas, mas não opera a Expedição (embalar). A reputação cai no dia 5 em 40% das sementes porque a falha de peso 3,0 por comanda cancelada (RN-94) é diluída pelas vendas do balcão (≈ 18 atendimentos). Opções: aumentar o peso da comanda cancelada (muda a regra RN-94), reduzir o peso dos sucessos no cálculo da reputação (RN-62), ou aceitar que o critério vale só para quem não atende o balcão.
- **brinde-max:** com brinde N = 2 e chorinho 3 desde o dia 1 o pasteleiro sozinho perde a fila (lucro negativo, reputação cai). Com equipe (a partir do dia 6) o brinde pesa pouco na margem e o lucro não fica abaixo da meta na maior parte dos dias. Opções: aumentar o custo do brinde/chorinho (RN-120, RN-123) ou revisar o critério da spec (seção 5) para "com equipe, a reputação sobe e o lucro cai em relação ao equilibrado".

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
| 5 | 129 | 102 | 72% | 3.5 | 18 | 6 | 0 | 50 |

### `brinde-max`

| Dia | Lucro | Meta | Meta cumprida | Reputação | Atendidos | Perdidos | Queimados | Sementes |
|---|---|---|---|---|---|---|---|---|
| 1 | 137 | 70 | 100% | 3.2 | 18 | 4 | 0 | 50 |
| 2 | 137 | 77 | 88% | 3.3 | 18 | 4 | 0 | 50 |
| 3 | 127 | 85 | 86% | 3.4 | 18 | 4 | 0 | 50 |
| 4 | 123 | 93 | 76% | 3.5 | 19 | 6 | 0 | 50 |
| 5 | 129 | 102 | 72% | 3.8 | 19 | 6 | 0 | 50 |
| 6 | 81 | 113 | 42% | 4.1 | 18 | 8 | 0 | 50 |
| 7 | 185 | 124 | 100% | 4.0 | 22 | 5 | 0 | 21 |
| 8 | 169 | 136 | 67% | 4.0 | 21 | 6 | 0 | 21 |
| 9 | 173 | 150 | 64% | 4.3 | 22 | 5 | 0 | 14 |
| 10 | 160 | 165 | 56% | 4.3 | 21 | 7 | 0 | 9 |
| 11 | 197 | 182 | 80% | 4.5 | 24 | 5 | 0 | 5 |
| 12 | 126 | 200 | 0% | 4.4 | 22 | 8 | 0 | 4 |

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
