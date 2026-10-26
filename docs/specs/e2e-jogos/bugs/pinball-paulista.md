# Bugs encontrados — Pinball Paulista (US-128)

| # | Sintoma | Causa | RN | Arquivo da correção |
|---|---|---|---|---|
| 1 | As letras MOTOBOY nunca acendiam por batida (só pelo prêmio "letra" do Minhocão); o Multiball praticamente não saía | A placa fica sobre a guia do corredor; a parede da guia era tratada antes do alvo no mesmo subpasso, rebatia a bola e o alvo via velocidade normal ≥ 0 (impacto 0) | PP-RN-12, PP-RN-13 | `game/engine.ts` (`stepBall`: alvos antes das paredes) |
| 2 | O aviso **CUIDADO!** no 3º tranco nunca aparecia | A conta de trancos cai continuamente (`NUDGE_DECAY`), então `nudges >= NUDGE_LIMIT` não acontecia antes do tilt | PP-RN-07 | `game/engine.ts` (`nudge`: `nudges > NUDGE_LIMIT - 1`) |
| 3 | O placar continuava subindo depois do fim de jogo (placar final ≠ recorde salvo) e "Jogar de novo" podia começar com pontos | O spinner que ainda girava pontuava em qualquer fase, e `restart()` não parava a roda | PP-RN-18, PP-RN-24 | `game/engine.ts` (`update`: spinner não pontua em `over`; `restart`: zera os spinners) |
| 4 | Saindo no meio da partida com recorde novo (← Menu, Menu da pausa, barra "← Sampa Challenges"), o título e o card do hub mostravam o recorde antigo | O recorde só era gravado no fim de jogo e no cleanup do motor (`dispose`); o título e a home do hub leem o recorde ao renderizar, antes desse cleanup | PP-RN-25 | `game/engine.ts` (`addScore` grava o recorde assim que o placar passa) |

## Decisões pendentes do utilizador

| # | Ponto | Comportamento atual (mantido e documentado no README) |
|---|---|---|
| 1 | A passagem que completa as 3 raias reacende a mesma raia logo depois do reset (a bola ainda está no sensor) e pontua `PTS.raia` + `BONUS_PTS.raia` de novo | Mantido (PP-RN-11). Alternativa: acender só na entrada no sensor |
| 2 | Toque de tecla mais curto que 1 quadro (abaixa e solta antes do próximo quadro) não move o flipper nem gira as raias | Mantido; o jogo lê o estado das teclas a cada quadro |
