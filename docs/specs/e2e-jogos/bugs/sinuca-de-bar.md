# Bugs da Sinuca de Bar achados pelos testes de ponta a ponta (US-132)

| # | Sintoma | Causa | RN | Arquivo da correção |
|---|---|---|---|---|
| 1 | Depois de uma falta que não encerra a partida, o aviso "FALTA: …" aparecia duas vezes na mesa (os dois avisos visíveis iguais) | `resolveShot` já põe "Falta: …" nas mensagens e o `endShot` do motor acrescentava o mesmo aviso de novo | SB-RN-19 a SB-RN-24 | `src/games/sinuca-de-bar/game/engine.ts` (`endShot`: só acrescenta o aviso quando as mensagens não o trazem, caso da falta que encerra a partida) |
| 2 | Na vez do computador a barra **Força** continuava ativa: mexer nela durante os 0,8 s em que o computador gira o taco mudava a força da tacada dele | a barra não tinha `disabled` e `setPower` não conferia de quem era a vez (os botões e o teclado já eram travados) | SB-RN-06, SB-RN-31 | `src/games/sinuca-de-bar/components/GameScreen.tsx` (barra desligada com `thinking`) e `game/engine.ts` (`setPower` ignora na vez do computador) |

## Decisões pendentes do utilizador

Nenhuma.
