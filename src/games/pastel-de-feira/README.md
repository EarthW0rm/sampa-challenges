# Pastel de Feira

Jogo de gestão em pixel art: você é o pasteleiro de uma barraca de feira em São Paulo. Em cada
Dia de Feira (4 minutos reais, das 7h às 14h) anota pedidos, monta, frita no ponto, mói o caldo de
cana, entrega e cobra. Entre os dias, compra insumos, melhora a barraca, contrata equipe e tenta bater
a meta de lucro dos 20 dias. Depois do dia 20 vem o modo livre. 1 jogador.

Rota no hub: `#/jogos/pastel-de-feira`.

## Como jogar

O toque/clique é o controle completo. No desktop também há teclado.

| Controle | Ação |
|---|---|
| Toque numa estação | o pasteleiro vai até ela e o painel abre |
| Toque num controle do painel | executa a ação (anotar, ingrediente, fechar, cesto, moenda…) |
| Segurar (moenda, óleo, vassoura) | continua enquanto o dedo/tecla estiver pressionado |
| Toque num item pronto e depois no cliente | entrega |
| Toque na faixa de avisos | aceita a oferta do app |
| Toque num funcionário | manda descansar (se estiver no modo fixo) |
| `1` a `9` | vai à estação (ordem da visão geral) |
| Setas, `Espaço`/`Enter` | escolhe e ativa o controle do painel |
| `Esc` | recolhe o painel |
| `P` / `M` / `F` | pausa / muda efeitos e música / acelera 2× |

### Regras (resumo; a spec completa está em `docs/specs/pastel-de-feira/spec.md`)

- O dia dura 240 s. Às 14h há corte seco: o que está em aberto se perde sem falha.
- Pastel cru vale nota 40, no ponto 80 e passado 55. Queimado vira desperdício. O preço pago usa a nota e a reputação.
- Cada cliente (Econômico, Padrão, Exigente) tem teto de preço e exigência de qualidade. Fila de 6, paciência de 50 a 70 s.
- Meta do dia N: lucro líquido ≥ R$ 70 × 1,10^(N−1) e reputação mínima (2,0 até o dia 5; 3,0 até o 12; 3,5 depois). Meta não cumprida repete o dia.
- Falência: caixa negativo no fechamento. Dá para "passar o ponto" (recomeçar com bônus) depois de zerar.
- Sistemas que entram aos poucos: equipe (dia 2), Associação (dia 3), delivery e tema (dia 5), Especial da Casa (dia 6), escritório (dia 10).

## Parâmetros

Valores de `game/constants.ts` (os marcados com (P) foram calibrados pela simulação sem tela).
Catálogos (receitas, equipamentos, equipe, eventos, desafios) ficam em `game/data/*.ts`.
Mudou um número? Atualize esta tabela.

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 640 × 480 | grade lógica (exceção à regra 7 do `CLAUDE.md` raiz) |
| `SCALE` (`game/hires.ts`) | 2 | canvas 1280×960, sprites em alta |
| `STEP` | 1/60 s | passo fixo da simulação; acelerar 2× = 2 passos por quadro |
| `DAY_SECONDS` (P) | 240 | duração real do dia |
| `ARRIVAL_BASE_INTERVAL` (P) | 12 s | intervalo médio entre clientes no dia 1 |
| `ARRIVAL_DAILY_DECAY` (P) | 4% | o intervalo cai 4% por dia |
| `ARRIVAL_MIN_INTERVAL` (P) | 4 s | piso do intervalo |
| `PEAK_FACTOR` (P) | 1,5 | chegada ×1,5 das 10h às 12h |
| `QUEUE_MAX` | 6 | fila cheia perde cliente (falha de peso 0,5) |
| `ORDER_DRINK_CHANCE` (P) | 0,4 | chance de o pedido levar caldo |
| `PATIENCE` (P) | 70 / 60 / 50 s | paciência (Econômico, Padrão, Exigente) |
| `PROFILE_CEILING` (P) | 0,9 / 1,2 / 1,6 | teto de preço × referência por perfil |
| `PROFILE_MIN_QUALITY` (P) | 30 / 50 / 70 | nota mínima aceita por perfil |
| `QUALITY_RAW` / `QUALITY_PONTO` / `QUALITY_OVERDONE` | 40 / 80 / 55 | nota de cru, no ponto e passado |
| `HOLD_MILL_MANUAL` | 6 s | tempo de um caldo na moenda manual |
| `HOLD_OIL_MANUAL` | 8 s | troca de óleo feita pelo pasteleiro |
| `BENCH_CAPACITY` (P) | 6 | pastéis montados esperando na bancada |
| `STOCK_CAPACITY` | 120 (+80 por caixa térmica) | estoque máximo |
| `OIL_DIRT_PER_PASTRY` | 0,04 | sujeira do óleo por pastel (trava a 100%) |
| `FAIL_WEIGHT` | balcão 1; sem estoque 0,5; comanda atrasada 3 | peso das falhas na reputação |
| `REPUTATION_MAX_DAILY_CHANGE` | 1 | variação máxima da reputação por dia |
| `TABLE_CHOICE` (P) | 0,3 | chance de preferir mesa (não Econômico) |
| `EAT_SECONDS` | 25 s | tempo comendo na mesa |
| `APP_OFFER_INTERVAL` (P) | 25 s | oferta de comanda do app |
| `APP_FEE` (P) | 20% | taxa do app |
| `APP_CAP_BASE/MID/HIGH` (P) | 3 / 6 / 10 | teto diário de comandas por reputação |
| `GOAL_BASE` (P) | R$ 70 | meta de lucro do dia 1 (spec: 80; calibrado, ver `calibracao.md`) |
| `GOAL_GROWTH` (P) | 1,10 | crescimento diário da meta (spec: 1,18; calibrado) |
| `BRINDE_MIN_N`–`BRINDE_MAX_N` | 2–6 | faixa do brinde (RN-120) |
| `CHARM_GIFT` (P) | 1,5 | encanto por brinde entregue (spec: 0,5; calibrado) |
| `XEPA_START_HOUR` | 13 | a xepa só vale a partir das 13h |
| `THEME_MIN_DAY` / `THEME_CHANGE_COST` | 5 / R$ 500 | tema da barraca |

## Rodando só este jogo

```bash
npm run dev     # abra #/jogos/pastel-de-feira
npm run typecheck && npm run build
```

Simulação sem tela (regras, replay e robôs de calibração):

```bash
npx esbuild src/games/pastel-de-feira/sim/run.ts --bundle --platform=node --format=esm --outfile=/tmp/pf-sim.mjs
node /tmp/pf-sim.mjs --scenario all            # todos os grupos de cenários
node /tmp/pf-sim.mjs --list                    # grupos
node /tmp/pf-sim.mjs --replay <arquivo.json>   # reexecuta um dia gravado e compara o hash
node /tmp/pf-sim.mjs --bots all --seeds 50     # robôs de calibração
```
