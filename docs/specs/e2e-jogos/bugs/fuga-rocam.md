# Bugs e decisões — Fuga da Rocam (US-131)

## Bugs corrigidos

| # | Sintoma | Causa | RN | Arquivo da correção |
|---|---|---|---|---|
| 1 | Segurando a direção para dentro da garagem, o cachorro ficava escondido para sempre: depois de `HIDE_MAX` saía, voltava na hora e se escondia de novo (com as garagens "trancadas"), esfriando o calor sem limite | A meia-volta imediata (`steerPlayer`) não conferia se o tile de destino podia ser ocupado; a garagem trancada só bloqueava a entrada pelo centro do tile | FR-RN-22, FR-RN-05 | `src/games/fuga-rocam/game/engine.ts` (`steerPlayer`: meia-volta só para tile em que `canPlayer`) |
| 2 | Recorde batido por uma **pizza** (sem entrega depois) não virava "novo recorde": no fim o painel mostrava `REC N` e a caixa "Recorde: N" em vez de "Novo recorde!" | A marcação de novo recorde só era feita na entrega | FR-RN-29 | `src/games/fuga-rocam/game/engine.ts` (`checkRecord` chamado na entrega e na pizza) |
| 3 | Mesma semente do teste dava partidas diferentes (pedidos e viaturas em outros lugares) | A semente do motor vinha de `Date.now() ^ Math.random()`; com o tempo virtual o `Date.now` parte da hora real da carga. Além disso o ruído do som consumia `Math.random` (uma vez por amostra, 44 100–48 000 vezes) só se o `AudioContext` abrisse, deslocando a sequência | — (determinismo, spec RN-11) | `components/GameScreen.tsx` (semente de `e2eSeed()` sob a flag), `game/sound.ts` (ruído com gerador próprio) |

Refatoração sem mudança de valor: os números que estavam soltos no motor (`JOB_RADIUS`, `NEXT_JOB_DELAY`, prazo do urgente, `CAUGHT_PAUSE`, `DT_MAX` etc.) foram para `game/constants.ts`, para os testes importarem em vez de copiar.

## Decisões pendentes do utilizador

| # | Ponto | Comportamento atual (mantido e documentado) | Onde |
|---|---|---|---|
| 1 | Sair no meio da partida (← Mapas, Mapas da pausa ou barra do hub) com pontos acima do recorde | O recorde **é** salvo (o `dispose` do motor grava). No Cachorro Loko o mesmo caso não salva | README FR-RN-29; teste `recorde.spec.ts` "sair no meio grava" |
| 2 | Primeira partida de um mapa (recorde 0) | Nunca mostra "NOVO RECORDE"/"Novo recorde!"; a caixa mostra "Recorde: N" | README FR-RN-29 |
| 3 | Turbo segurado com a moto parada na parede | O tanque gasta mesmo parado | README FR-RN-09 |
