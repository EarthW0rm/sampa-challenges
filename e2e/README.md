# Testes de ponta a ponta (Playwright)

Testes que abrem os jogos no navegador e jogam **pela tela**: cliques e toques no canvas, teclado,
arrastes e as telas React. Todo jogo do hub e o próprio hub têm suíte aqui; cada regra numerada do
manual de um jogo (`src/games/<id>/README.md`, IDs `<SIGLA>-RN-NN`) tem pelo menos um teste que cita o
número no nome.

```bash
npx playwright install chromium   # uma vez
npm run test:e2e                  # suíte rápida: todos os jogos + hub, desktop e celular (Vite na porta 5199)
npm run test:e2e:longa            # pilotos: partidas inteiras de cada jogo (evidências só dos marcos)
npm run test:e2e:campanha         # campanha inteira do Pastel de Feira pela tela
npm run test:e2e:tudo             # as quatro
npm run test:e2e -- cachorro-loko/                # um jogo
npx playwright test -c e2e/playwright.config.ts --project=celular e2e/hub/  # só o celular (o script test:e2e já fixa desktop + celular)
npm run test:e2e -- -g "CL-RN-07"                 # uma regra pelo número
npm run test:e2e:cobertura                        # regra do manual × testes (exit 1 se faltar)
npx playwright show-report playwright-report      # relatório HTML (traces das falhas)
npm run typecheck:e2e
E2E_EVIDENCIAS=marcos npm run test:e2e            # evidências só dos marcos (ou `off`; `PF_EVIDENCIAS` também vale)
```

No macOS rode as suítes longas com `caffeinate -dimsu` antes do comando: com a máquina ociosa o
Chrome é suspenso. `E2E_PORT=<porta>` troca a porta do Vite (duas cópias do repositório rodando ao
mesmo tempo, como em worktrees, precisam de portas diferentes). Dentro de um worktree em
`.worktrees/<id>/`, filtre por `e2e/<id>/` (o filtro `<id>/` casa com o caminho absoluto de todos os testes). O Vite da raiz
ignora `.worktrees/` (`vite.config.ts`), então mudanças lá não recarregam a página de quem roda na raiz.

## Projetos

| Projeto | O que roda | Viewport | Evidências | Script |
|---|---|---|---|---|
| `desktop` | todos os `*.spec.ts`, menos `responsivo`, `piloto` e `campanha-completa` | 1280×1000 | `acoes` | `test:e2e` |
| `celular` | `**/responsivo.spec.ts` (todos os jogos e o hub) | 390×844, toque | `acoes` | `test:e2e` |
| `longa` | `**/piloto.spec.ts` (saída em `test-results/e2e-longa`) | 1280×1000 | `marcos` | `test:e2e:longa` |
| `campanha` | `pastel-de-feira/campanha-completa.spec.ts` (saída em `test-results/e2e-campanha`) | 1280×1000 | `marcos` | `test:e2e:campanha` |

O esqueleto `_modelo/` (copiado por `npm run novo-jogo`) não roda em nenhum projeto.

## Base comum (`support/`)

| Peça | Arquivo | Papel |
|---|---|---|
| Relógio | `clock.ts` | init script injetado antes do jogo: troca o `requestAnimationFrame` por uma fila manual (nada anda sozinho; `__e2eFrames(n)` roda `n` quadros de 1/60 s, `__e2eJump(ms)` salta o relógio), semeia o `Math.random` (mulberry32), prepara o `localStorage` uma vez por teste (som desligado, chaves do teste, dado cru ou storage bloqueado) e, com `virtualTime` (padrão nos jogos; desligado no Pastel), faz `performance.now()` e `Date.now()` só andarem com os quadros. `setTimeout` continua real (Vite e React dependem dele) |
| Página base | `game-page.ts` | `BaseGamePage`: `boot`, `frames`, `jump`, `hook`/`lastHook` (gancho do jogo), `advanceUntil`, `toClient` (lógico → página), gestos `tapAt`, `holdAt`, `dragFromTo`, `holdKey`, `pressKey`, `rafPending`. Cada jogo estende em `<id>/support/page.ts` |
| Fixtures | `fixtures.ts` | `makeTest(factory, descritores)`: `page` registra evidência a cada ação, `composer` monta os PNGs, `game` é a página do jogo e falha o teste se houver erro no console |
| Evidências | `evidence.ts`, `describe.ts` | PNG por ação e por marco com cabeçalho (ver abaixo); `screenDescriber(root)` é a parte genérica, cada jogo acrescenta a dele |
| Piloto | `pilot.ts` | `runPilot(game, estratégia, { seed, variant, maxFrames })`: lê o estado, pede a decisão e executa gestos reais até o fim de jogo; estoura `maxFrames` como `travou`; gesto sem alvo falha o teste |
| Diagnóstico | `diagnostics.ts` | `partida-<n>.json` (jogo, variante, semente, status, quadros, comandos, resultado, erros) na saída do teste |
| Hub | `hub.ts` | `HubPage` (home, cards, abrir jogo, barra de volta) e descritor do hub |
| Storage | `storage.ts` | `readStorage`, `expectStored` |
| Autoverificação | `base.spec.ts` | prova o relógio, as evidências, a página base, o piloto e o gancho numa página de brinquedo, sem depender de jogo |

**Gancho dos jogos.** Cada jogo publica, no efeito que cria o motor, `window.__e2e = { id, api }` por
`exposeE2E` (`src/shared/e2e/hook.ts`) e chama o `dispose` no cleanup. Só existe quando a página de
teste liga a flag (`window.__E2E__`, posta pelo `clock.ts`); para o jogador é inerte. A `api` é só
leitura (`state()`, `targets()`); pré-condição rara vai por `prepare.*`, comentada no teste. O Pastel
mantém o gancho próprio `window.__pf`. Para sorteios fora da página (worker de IA), `e2eSeed()` manda
a semente no pedido.

**Regras dos testes.** Comandos só pela tela (toque, clique, arraste, teclado). Números esperados vêm
das constantes do jogo. O nome de cada teste começa pelo ID da regra. Erro no console falha o teste.

## Evidências

Todo teste grava capturas em `evidencias/<projeto>/<pasta do jogo>/<arquivo>/<teste>/` (na raiz do
repositório, fora do git), numeradas na ordem: `001-marco-…png`, `002-acao-…png`, …, e a última
`NNN-fim-…png` ou `NNN-falha-…png`. A pasta de cada teste é apagada quando ele começa de novo.

| Campo do cabeçalho | Conteúdo |
|---|---|
| Teste | describe › título, arquivo, projeto, número da evidência, data e hora |
| Ação / Marco / Fim / Falha | o que acabou de ser feito (ex.: `Segurar ArrowRight por 30 quadros (0.5 s) e soltar`, `Clique em botão "Jogar"`) |
| Passo do fluxo | os `game.step(...)` em andamento |
| Tela | rota, tela (título visível ou "Partida"), diálogo e mensagem visíveis |
| Estado do jogo | campos próprios de cada jogo (spec 3.4: placar, vidas, nível, vez, mira…), lidos do gancho |
| Falha | a mensagem de erro do teste |

Níveis: `acoes` (padrão), `marcos` (abertura do jogo, início e fim de partida/dia, fim do teste e
`game.evidence(...)`) e `off`, por `E2E_EVIDENCIAS` (ou `PF_EVIDENCIAS`) ou pela opção `evidencias` do
projeto. Uma evidência que falha só gera aviso no console; nunca derruba o teste.

## Pilotos (`<id>/piloto.spec.ts`)

Cada jogo tem um jogador automático que joga partidas inteiras só por gestos de tela
(`<id>/support/pilot.ts`). Ao fim de cada partida o teste confere o resultado exibido contra o
recalculado, o recorde salvo e mostrado no card do hub e o console limpo, e grava `partida-<n>.json`
em `test-results/e2e-longa/`. Mesma semente, mesmo arquivo. `E2E_PILOT_DEBUG=1` imprime o ritmo dos gestos.

## Cobertura por jogo

`npm run test:e2e:cobertura` compara os IDs `<SIGLA>-RN-NN` do manual de cada jogo com os títulos dos
testes; `-- --md <id>` imprime a tabela regra → arquivo para a seção "Testes" do manual.

| Jogo | Sigla | Pasta | Manual (seção Testes) |
|---|---|---|---|
| Cachorro Loko | CL | `cachorro-loko/` | [`src/games/cachorro-loko/README.md`](../src/games/cachorro-loko/README.md) |
| Pinball Paulista | PP | `pinball-paulista/` | [`src/games/pinball-paulista/README.md`](../src/games/pinball-paulista/README.md) |
| Capacete Voador | CV | `capacete-voador/` | [`src/games/capacete-voador/README.md`](../src/games/capacete-voador/README.md) |
| Corredor SP | CS | `corredor-sp/` | [`src/games/corredor-sp/README.md`](../src/games/corredor-sp/README.md) |
| Fuga da Rocam | FR | `fuga-rocam/` | [`src/games/fuga-rocam/README.md`](../src/games/fuga-rocam/README.md) |
| Sinuca de Bar | SB | `sinuca-de-bar/` | [`src/games/sinuca-de-bar/README.md`](../src/games/sinuca-de-bar/README.md) |
| Xadrez Paulistano | XP | `xadrez-paulistano/` | [`src/games/xadrez-paulistano/README.md`](../src/games/xadrez-paulistano/README.md) |
| Pastel de Feira | RN-NN | `pastel-de-feira/` | [`src/games/pastel-de-feira/README.md`](../src/games/pastel-de-feira/README.md) (seção 15) e abaixo |
| Hub | HUB | `hub/` | seção Hub abaixo |

## Jogo novo

`npm run novo-jogo -- <id> "<Título>"` cria também `e2e/<id>/` (página, descritor, navegação e
responsivo) e o gancho em `src/games/<id>/game/e2eHook.ts`. Siga a seção "Testes de ponta a ponta" do
`CLAUDE.md` do jogo gerado.

## Tempos

Medidos em 26/10/2026 num Mac de 12 núcleos (evidências em `acoes` na suíte rápida, `marcos` nas
longas), com `caffeinate -dimsu`:

| Suíte | Testes | Tempo de parede | Orçamento | Estabilidade |
|---|---|---|---|---|
| `test:e2e` (rápida: 8 jogos + hub + base, desktop e celular) | 510 | 6,5–6,6 min | ≤ 10 min | 3 execuções seguidas verdes, sem repetição automática |
| `test:e2e:longa` (pilotos dos 7 jogos) | 27 | 3,3 min | ≤ 30 min | 2 execuções verdes; os 36 `partida-*.json` idênticos entre elas |
| `test:e2e:campanha` (Pastel de Feira) | 1 | 12,3 min (25 dias de jogo) | — | verde |

## Pastel de Feira (`pastel-de-feira/`)

### Como funciona

| Peça | Arquivo | Papel |
|---|---|---|
| Gancho do jogo | `src/games/pastel-de-feira/game/e2eHook.ts` | `window.__pf` com o `DaySim`, a UI e os alvos de toque (controles do painel, clientes, funcionários). Só existe quando a página define `window.__PF_E2E__` |
| Relógio | `support/game.ts` (sobre `e2e/support/clock.ts`) | `GamePage` estende a página base com o gancho `window.__pf`, sem tempo virtual: `frames(n)` roda `n` quadros de 1/60 s (1 passo da simulação). Quando o jogo começa um laço (pedido de quadro fora de um quadro), o relógio parte de agora + meio quadro, para o acumulador do jogo ficar no meio do passo (sem isso, sob carga, quadros rodavam 0 passos). Os tempos (deslocamento, fritura, moenda) são medidos em passos, sem depender da máquina |
| Saves | `support/campaign.ts` | monta a campanha com as próprias ações do jogo (`newCampaign`, `buyIngredient`…) e injeta no `localStorage` antes de carregar; semente fixa |
| Ações | `support/flow.ts` | anotar, montar, fritar, moer, entregar, cobrar, atender um cliente inteiro, tudo por toques |
| Piloto | `support/pilot.ts`, `support/pilot.browser.ts` | joga um dia inteiro: o jogador automático de calibração (`sim/player.ts`) decide, e cada decisão vira toque, segurar ou soltar com o mouse real; gestos sem alvo são registrados e fazem o teste falhar |
| Evidências | `support/describe.ts` | cabeçalho do dia (HUD, passo da simulação e pausa, pasteleiro, painel e controles, selecionado, clientes, prontos) sobre a evidência comum |
| Estratégia | `support/strategy.ts`, `support/prep.ts` | Preparo da campanha (parte do robô `equilibrado`, com receitas caras no cardápio para fechar os dias 16–20): compras, contratação, cardápio, preços e estoque viram cliques nas abas; o save resultante tem que ser idêntico ao das ações do jogo |

Regra dos testes: **comandos só por toque/teclado**. O gancho serve para ler o estado e localizar os
alvos; a única escrita direta no estado é a preparação de uma pré-condição rara (ex.: óleo em 68%,
sujeira em 60) e fica comentada no teste.

Os números esperados vêm de `game/constants.ts` e `game/data/*` (os valores (P) calibrados), com a RN
da spec no nome de cada teste.

### Cobertura (por arquivo)

| Arquivo | Regras |
|---|---|
| `navegacao` | hub, título, nova campanha, perfis, save/continuar, save corrompido, modo privado |
| `preparo` | abas por dia, compra, capacidade, caixa, sugestão, preço, aviso antes de abrir |
| `relogio` | 07h–14h em 240 s, corte seco, pausa (botão, P, foco), 2×, quadro gigante |
| `deslocamento` | tempos de deslocamento, destino substituído, painel abre/recolhe |
| `pedido` | anotar, montar, colocar, moenda, fluxo completo, valor pago, saquinho, item errado, cobrar 2× |
| `fritura` | cru/ponto/passado/queimado, óleo sujo, trava em 100%, troca de óleo |
| `limpeza-moenda` | vassoura, moenda, chorinho, sem copo, sem cana |
| `clientes` | chegada, pedido, paciência por perfil e por posição, sujeira, fila cheia, toque no cliente |
| `teclado` | números, Esc, setas, Enter/Espaço, auto-repeat, M, Ctrl |
| `tutorial` | dicas, relógio parado, 2× bloqueado, primeiro pedido guiado |
| `melhorias` | cesto extra, tacho extra, termostato, alarme, escorredor, algodão, moenda motorizada, estufa, mesa, m² |
| `equipe` | contratação, tipos, Fritador, energia, descanso, JA-01, salário |
| `mesas-delivery` | grupo de mesa até o pagamento e a limpeza; oferta, expiração, cancelamento e retirada do app |
| `escritorio` | escritório, encomenda completa/incompleta, caixa de encomenda |
| `eventos` | fiscal, queda de energia, excursão, fogo, 1 surpresa por dia |
| `promocoes` | brinde, chorinho, xepa |
| `associacao` | desafios oferecidos, prêmio, expiração |
| `campanha` | falência, passar o ponto, modo livre, tema, reivindicação, estação, recorde |
| `fechamento` | balanço, meta, reputação, estoque que estraga, save |
| `dia-completo` | um dia inteiro jogado pela tela e a conta do caixa fechando |
| `responsivo` | 390 px: sem rolagem lateral, toque mapeado, HUD |
| `bancada` | rótulos dos ingredientes do painel da bancada distinguíveis |
| `tachos-equipe` | Montagem coloca em qualquer tacho (tacho 1 cheio → tacho 2), Fritador assume o tacho livre (pasteleiro no tacho 1 → tacho 2), Fritador não monta e coloca o montado, troca o óleo do tacho dele, Troca de óleo em qualquer tacho, sem cansaço |
| `receitas-selos` | recheios de Queijo, Pizza e Bauru (consumo do estoque), bancada sem orégano, selo do sabor nos controles do painel e no Cardápio |
| `opcoes-save` | melhorias liberadas (delivery no dia 1) e travadas, cestos extras em ordem entre os tachos, save v1 com Colocador migrado para Montagem |
| `combinacoes` | tutorial do dia 1 com equipe (relógio anda, 2× bloqueado), começar no dia 10 (balões em ordem), selo de todo sabor, selo da versão +1 e ícone do caldo, balão de 4 itens dentro da fila, save com opções corrompidas |
| `jornada-equipe` | dia inteiro com Balcão, Montagem e Fritador atendendo sozinhos e o fechamento batendo; fila cheia sem ninguém anotar e sem desistência por paciência |
| `progressao` | dias 1–20 e modo livre: meta, reputação mínima, estação, balões e tema por dia; desbloqueios da aba Melhorias; dia repetido; validade da massa |
| `campanha-completa` | campanha inteira do "Nova campanha" ao dia 20, 2 dias de modo livre e "Passar o ponto"; por dia: Preparo pelas abas, dia pelo piloto, fechamento e save comparados com o `closeDay` do jogo, recarga no meio da campanha e saída no meio do dia |

### Campanha completa: diagnóstico

- Cada dia jogado grava `dia-cal<N>.json` (campanha do início do dia, comandos e `DayResult`) na pasta de
  saída do teste (`test-results/e2e/…`). Reproduzir os comandos sem tela dá o mesmo resultado (motor
  determinístico); comparar com o jogador automático no mesmo dia mostra onde a tela atrapalhou.
- `PF_PILOT_DEBUG=1 npm run test:e2e:campanha` imprime o ritmo dos gestos e qualquer gesto lento.
- No macOS rode com `caffeinate -dimsu` antes do comando: com a máquina ociosa o Chrome é suspenso e
  um dia de 12 s passa a levar minutos.

## Hub (`hub/`)

Regras do hub, com o comportamento atual (`src/hub/`). Cada uma tem teste em `e2e/hub/` com o número no nome.

| Regra | Comportamento | Teste |
|---|---|---|
| HUB-RN-50 | A home lista um card por jogo (pastas de `src/games/` sem `_`), na ordem do `registry.ts` (`order`, depois o título), com título e capa; o rodapé conta os jogos. O card mostra "Recorde N" quando o jogo tem `getRecord` e o recorde é maior que 0 | `home.spec.ts` |
| HUB-RN-51 | `#/jogos/<id>` abre o jogo, com a barra "← Sampa Challenges" e o título do jogo (e o título da aba `<Jogo> · Sampa Challenges`). Id no padrão mas inexistente: mensagem "Jogo “<id>” não encontrado." com o link "Voltar para os jogos". Rota fora do padrão (`[a-z0-9-]+`, maiúsculas, barra extra, outra rota): mostra a home. Voltar do navegador e a barra retornam à home | `rotas.spec.ts` |
| HUB-RN-52 | Trocar de jogo desmonta o anterior: depois de voltar à home não sobra pedido de quadro (`requestAnimationFrame`) nem listener de teclado do jogo; abrir A, voltar e abrir B deixa só os laços de B | `troca.spec.ts` |
| HUB-RN-53 | Estilo não vaza: `body`, a home e os cards têm os mesmos estilos computados antes e depois de abrir cada jogo, e a raiz de cada jogo é igual antes e depois de abrir os outros | `isolamento.spec.ts` |
| HUB-RN-54 | Falha ao carregar o módulo do jogo ou erro de execução dele cai no error boundary do hub ("O jogo travou: <mensagem>" e o link "Voltar para os jogos"), com a barra de volta visível, sem tela branca | `erro.spec.ts` |
| HUB-RN-55 | Em 390 px a home não rola para o lado, o toque no card abre o jogo e a barra de volta cabe na largura com qualquer jogo aberto | `responsivo.spec.ts` (projeto `celular`) |
