# Bugs e decisões — testes de ponta a ponta de todos os jogos

> Registro consolidado da entrega `e2e-jogos` (spec RN-61). Cada bug foi achado por um teste que joga
> pela tela, corrigido no jogo e coberto pelo teste da regra citada. As decisões pendentes são
> comportamentos atuais mantidos e escritos no manual do jogo até o utilizador decidir.

## 1. Bugs de jogo corrigidos (12)

| # | Jogo | Sintoma | Causa | RN | Correção |
|---|---|---|---|---|---|
| 1 | Cachorro Loko | Com a última vida, um pacote pego no mesmo quadro em que outro tocava o asfalto ainda pontuava depois do fim do turno; o placar exibido passava do recorde salvo | `updateBoxes` seguia processando os pacotes do quadro depois que `loseLife` mudava a fase para `over` | CL-RN-26, CL-RN-27 | `cachorro-loko/game/engine.ts`: o laço para quando a fase vira `over` |
| 2 | Pinball Paulista | As letras MOTOBOY nunca acendiam por batida (só pelo prêmio "letra" do Minhocão); o Multiball praticamente não saía | A parede da guia era tratada antes do alvo no mesmo subpasso e rebatia a bola antes do impacto | PP-RN-12, PP-RN-13 | `pinball-paulista/game/engine.ts` (`stepBall`): alvos antes das paredes |
| 3 | Pinball Paulista | O aviso CUIDADO! no 3º tranco nunca aparecia | A conta de trancos cai sem parar (`NUDGE_DECAY`), então `nudges >= NUDGE_LIMIT` não acontecia antes do tilt | PP-RN-07 | `pinball-paulista/game/engine.ts` (`nudge`): `nudges > NUDGE_LIMIT - 1` |
| 4 | Pinball Paulista | O placar subia depois do fim de jogo e "Jogar de novo" podia começar com pontos | O spinner pontuava em qualquer fase e `restart()` não parava a roda | PP-RN-18, PP-RN-24 | `pinball-paulista/game/engine.ts`: spinner não pontua em `over`; `restart` zera os spinners |
| 5 | Pinball Paulista | Saindo no meio da partida com recorde novo, o título e o card do hub mostravam o recorde antigo | O recorde só era gravado no fim de jogo e no cleanup do motor, depois que título e home já tinham lido o valor | PP-RN-25 | `pinball-paulista/game/engine.ts` (`addScore`): grava o recorde assim que o placar passa |
| 6 | Corredor SP | Escolha salva com pista, cachorro ou cor desconhecidos derrubava o jogo (tela de erro do hub) | `loadChoice` só validava modelo e categoria; o cachorro inválido virava chave de sprite inexistente em `recolored()` | CS-RN-02, spec RN-47 | `corredor-sp/Game.tsx`: valida todos os campos da escolha |
| 7 | Corredor SP | A 390 px o botão de toque CAPACETE ficava cortado fora da tela | FREIO, GRAU e CAPACETE ficavam numa linha só ao lado das setas, sem quebra | CS-RN-07, spec RN-47 | `corredor-sp/styles.css` |
| 8 | Fuga da Rocam | Segurando a direção para dentro da garagem, o cachorro ficava escondido para sempre e o calor caía sem limite | A meia-volta imediata (`steerPlayer`) não conferia se o tile de destino podia ser ocupado; atravessava a garagem trancada | FR-RN-22, FR-RN-05 | `fuga-rocam/game/engine.ts` (`steerPlayer`): meia-volta só para tile em que `canPlayer` |
| 9 | Fuga da Rocam | Recorde batido por uma pizza não mostrava "Novo recorde!" | A marcação de novo recorde só era feita na entrega | FR-RN-29 | `fuga-rocam/game/engine.ts`: `checkRecord` na entrega e na pizza |
| 10 | Fuga da Rocam | Mesma semente do teste dava partidas diferentes | A semente vinha de `Date.now() ^ Math.random()` e o ruído do som consumia milhares de `Math.random` só quando o `AudioContext` abria | spec RN-11 | `fuga-rocam/components/GameScreen.tsx` (semente de `e2eSeed()` sob a flag), `game/sound.ts` (ruído com gerador próprio) |
| 11 | Sinuca de Bar | Numa falta que não encerra a partida, o aviso "FALTA: …" aparecia duas vezes na mesa | `resolveShot` já punha o aviso nas mensagens e o `endShot` do motor acrescentava o mesmo de novo | SB-RN-19 a SB-RN-24 | `sinuca-de-bar/game/engine.ts` (`endShot`) |
| 12 | Sinuca de Bar | Na vez do computador a barra Força continuava ativa e mudava a força da tacada dele | A barra não tinha `disabled` e `setPower` não conferia de quem era a vez | SB-RN-06, SB-RN-31 | `sinuca-de-bar/components/GameScreen.tsx`, `game/engine.ts` (`setPower`) |

Capacete Voador e Xadrez Paulistano: nenhum bug de jogo encontrado.

## 2. Defeitos da infraestrutura de testes corrigidos na entrega (6)

| # | Sintoma | Causa | Correção |
|---|---|---|---|
| 1 | A campanha completa do Pastel recarregava no meio de um dia | O Vite da raiz observava `.worktrees/`; arquivos novos lá (index.html das cópias) disparavam recarga da página | `vite.config.ts`: ignora a pasta `.worktrees` desta raiz |
| 2 | Dentro de um worktree o Vite servia módulos velhos depois de mudar o código de produção | O padrão `**/.worktrees/**` casava com o próprio caminho do worktree e escondia todo o código do watcher | `vite.config.ts`: caminho absoluto da pasta `.worktrees` da raiz |
| 3 | `expect(locator)` que falhava mostrava `out.then is not a function` em vez da mensagem real | O proxy de evidência tratava como ação assíncrona qualquer método com nome de ação | `e2e/support/evidence.ts`: só Promise vira evidência |
| 4 | `page.goto('about:blank')` derrubava o teste com `pageerror` | O init script do relógio lia o `sessionStorage`, que não existe em `about:blank` | `e2e/support/clock.ts`: acesso ao storage em `try/catch` |
| 5 | O `dt` variava nos últimos bits entre cargas e sementes derivadas de `Date.now` mudavam | O tempo virtual partia da hora real | `e2e/support/clock.ts`: `performance.now` parte de 1000 e `Date.now` de 01/01/2026 12:00 UTC |
| 6 | `waitHook` podia travar com o gancho publicado depois da primeira checagem | `waitForFunction` com polling `raf` nunca dispara com o relógio manual | `e2e/support/game-page.ts`: polling de 50 ms |

Também ajustado: um teste do Pinball (PP-RN-05) exigia exatamente 8 subpassos de 1/480 s num quadro de
1/60 s; o acumulador de ponto flutuante pode rodar 7 ou 9 na fronteira. O teste passou a aceitar 1
subpasso de diferença.

## 3. Decisões pendentes do utilizador (18)

Comportamento atual mantido e documentado no manual de cada jogo.

| # | Jogo | Ponto | Comportamento atual | RN |
|---|---|---|---|---|
| 1 | Cachorro Loko | Sair no meio da partida com placar acima do recorde | O recorde **não** é salvo (só o fim do turno grava), embora o HUD mostre "NOVO RECORDE!" | CL-RN-27, CL-RN-28 |
| 2 | Fuga da Rocam | Mesmo caso do item 1 | O recorde **é** salvo (o `dispose` do motor grava): diverge do Cachorro Loko | FR-RN-29 |
| 3 | Fuga da Rocam | Primeira partida de um mapa (recorde 0) | Nunca mostra "Novo recorde!" | FR-RN-29 |
| 4 | Fuga da Rocam | Turbo segurado com a moto parada na parede | O tanque gasta mesmo parado | FR-RN-09 |
| 5 | Capacete Voador | Ângulo vazio | Conta como 0° e lança; velocidade vazia mostra erro | CV-RN-10 |
| 6 | Capacete Voador | Letra digitada com o ângulo selecionado | Apaga a seleção; o Enter seguinte lança a 0° | CV-RN-10 |
| 7 | Capacete Voador | Mensagem "Ângulo entre 0 e 180" | Nunca aparece: a validação nativa do navegador barra antes (balão em inglês no Chromium); decimais também são recusados | CV-RN-09 |
| 8 | Capacete Voador | Gravidade apagada ou fora do passo de 0,1 | Campo mostra 0 e o Jogar é recusado; o fallback 9,8 do código nunca é alcançado (o README antigo dizia "número livre") | CV-RN-05 |
| 9 | Capacete Voador | Perda de foco | Não pausa (jogo por turnos) | CV-RN-34 |
| 10 | Corredor SP | Teto de vidas | `MAX_LIVES = 10` (o README antigo dizia 5) | CS-RN-14, CS-RN-15 |
| 11 | Corredor SP | Enter e Espaço nos diálogos de pausa e fim de turno | São teclas do jogo com o padrão cancelado: não acionam os botões em foco | CS-RN-28 |
| 12 | Corredor SP | Moto do trânsito que ultrapassa por trás e termina sobreposta à do jogador | Conta como batida | CS-RN-09 |
| 13 | Pinball Paulista | Passagem que completa as 3 raias | A mesma raia reacende em seguida e pontua de novo (a bola ainda está no sensor) | PP-RN-11 |
| 14 | Pinball Paulista | Tecla apertada e solta antes do próximo quadro | Não move o flipper nem gira as raias | PP-RN-05 |
| 15 | Xadrez Paulistano | Regra dos 50 lances | Empate automático aos 100 meios-lances (FIDE: reclamável aos 50, automático aos 75) | XP-RN-14 |
| 16 | Xadrez Paulistano | Repetição tripla | Empate automático na 3ª ocorrência (FIDE: reclamável; automático na 5ª) | XP-RN-15 |
| 17 | Xadrez Paulistano | Desfazer depois de desistir | Só cancela a desistência; não volta lance | XP-RN-19 |
| 18 | Xadrez Paulistano | Material insuficiente | Rei e bispo contra rei e cavalo, e rei e dois cavalos contra rei, não encerram a partida | XP-RN-16 |

## 4. Desvios do plan.md

- **Semente da IA do Xadrez:** em vez de `e2eSeed()` a cada pedido, uma base tirada quando o motor
  carrega, combinada com o número de meios-lances. O som consome um `Math.random` por amostra de áudio
  (44,1 ou 48 kHz conforme a máquina), o que mudaria as sementes entre máquinas.
- **`E2E_NODES_PER_MS` = 400:** medido 871 nós/ms (nível 60, 20 posições, mediana 958); adotada cerca da
  metade para o nível 100 caber em 5 s por lance com as suítes em paralelo.
- **Tempo virtual e `Date.now` (plan.md 3.3):** a hora real ainda entrava como base; corrigido no
  `clock.ts` (item 5 da seção 2) e, na Fuga, a semente passou a vir de `e2eSeed()`.
- **Quadro com `dt` negativo (spec RN-47):** com o tempo virtual o relógio nunca volta; os jogos limitam
  o `dt` a `[0, máximo]` no código (documentado nos manuais), sem teste que provoque o caso.
