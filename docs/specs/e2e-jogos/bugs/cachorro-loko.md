# Bugs e decisões — Cachorro Loko (US-127)

## Bugs corrigidos

| # | Sintoma | Causa | RN | Arquivo da correção |
|---|---|---|---|---|
| 1 | Com a última vida, um pacote pego no mesmo quadro em que outro tocava o asfalto ainda pontuava depois do fim do turno: o placar exibido passava do recorde salvo (que já tinha sido gravado com o placar menor) | `updateBoxes` seguia processando os pacotes restantes do quadro depois que `loseLife` mudava a fase para `over` | CL-RN-26, CL-RN-27 | `src/games/cachorro-loko/game/engine.ts` (`updateBoxes` para o laço quando a fase vira `over`) |

## Decisões pendentes do utilizador

| # | Ponto | Comportamento atual (mantido e documentado) | Onde |
|---|---|---|---|
| 1 | Sair no meio da partida (← Menu, Menu da pausa ou barra do hub) com o placar acima do recorde | O recorde **não** é salvo: só o fim do turno (0 vidas) grava. O HUD chega a mostrar "NOVO RECORDE!" e o valor se perde ao sair | README CL-RN-27/CL-RN-28; teste `navegacao.spec.ts` "sair no meio da partida não salva o placar" |
