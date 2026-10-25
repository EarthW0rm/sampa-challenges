# Testes de ponta a ponta (Playwright)

Testes que abrem o jogo no navegador e jogam **pela tela**: cliques no canvas, teclado e as telas
React (título, Preparo, fechamento). Complementam os cenários sem tela de
`src/games/pastel-de-feira/sim/` (regras puras): aqui o que se valida é a integração entrada → painel →
simulação → HUD → fechamento → save.

```bash
npx playwright install chromium   # uma vez
npm run test:e2e                  # suíte rápida: desktop + celular (sobe o Vite na porta 5199)
npm run test:e2e:campanha         # campanha inteira pela tela (longa, ~15 min)
npm run test:e2e:tudo             # as duas
npm run test:e2e -- pastel-de-feira/fritura      # um arquivo
npm run test:e2e -- -g "RN-41"                   # pelo nome
npx playwright show-report playwright-report     # relatório HTML (traces das falhas)
npm run typecheck:e2e
PF_EVIDENCIAS=marcos npm run test:e2e             # evidências só dos marcos (ou `off`)
```

## Como funciona

| Peça | Arquivo | Papel |
|---|---|---|
| Config | `playwright.config.ts` | Vite em modo dev (StrictMode ligado); projetos `desktop` (1280×1000) e `celular` (390×844, só `responsivo.spec.ts`) |
| Gancho do jogo | `src/games/pastel-de-feira/game/e2eHook.ts` | `window.__pf` com o `DaySim`, a UI e os alvos de toque (controles do painel, clientes, funcionários). Só existe quando a página define `window.__PF_E2E__` |
| Relógio | `support/game.ts` | troca o `requestAnimationFrame` por uma fila manual: nada anda sozinho e `frames(n)` roda `n` quadros de 1/60 s (1 passo da simulação). Quando o jogo começa um laço (pedido de quadro fora de um quadro), o relógio parte de agora + meio quadro, para o acumulador do jogo ficar no meio do passo (sem isso, sob carga, quadros rodavam 0 passos). Os tempos (deslocamento, fritura, moenda) são medidos em passos, sem depender da máquina |
| Saves | `support/campaign.ts` | monta a campanha com as próprias ações do jogo (`newCampaign`, `buyIngredient`…) e injeta no `localStorage` antes de carregar; semente fixa |
| Ações | `support/flow.ts` | anotar, montar, fritar, moer, entregar, cobrar, atender um cliente inteiro, tudo por toques |
| Piloto | `support/pilot.ts`, `support/pilot.browser.ts` | joga um dia inteiro: o jogador automático de calibração (`sim/player.ts`) decide, e cada decisão vira toque, segurar ou soltar com o mouse real; gestos sem alvo são registrados e fazem o teste falhar |
| Evidências | `support/evidence.ts` | cada ação e cada marco vira um PNG em `evidencias/` com cabeçalho: teste, ação, passo do fluxo e o que a tela mostrava (veja abaixo) |
| Estratégia | `support/strategy.ts`, `support/prep.ts` | Preparo da campanha (parte do robô `equilibrado`, com receitas caras no cardápio para fechar os dias 16–20): compras, contratação, cardápio, preços e estoque viram cliques nas abas; o save resultante tem que ser idêntico ao das ações do jogo |

Regra dos testes: **comandos só por toque/teclado**. O gancho serve para ler o estado e localizar os
alvos; a única escrita direta no estado é a preparação de uma pré-condição rara (ex.: óleo em 68%,
sujeira em 60) e fica comentada no teste.

Os números esperados vêm de `game/constants.ts` e `game/data/*` (os valores (P) calibrados), com a RN
da spec no nome de cada teste.

## Evidências

Todo teste grava capturas de tela em `evidencias/<projeto>/pastel-de-feira/<arquivo>/<teste>/`
(na raiz do repositório, fora do git), numeradas na ordem: `001-marco-…png`, `002-acao-…png`, …,
e a última `NNN-fim-…png` ou `NNN-falha-…png`. A pasta de cada teste é apagada quando ele começa de novo.

Cada PNG tem um cabeçalho em cima da captura com:

| Campo | Conteúdo |
|---|---|
| Teste | describe › título, arquivo, projeto, número da evidência, data e hora |
| Ação / Marco / Fim / Falha | o que acabou de ser feito (ex.: `Toque no controle "FECHAR" do painel`, `Clique em botão "Abrir a feira"`, `Tecla "KeyP"`) |
| Passo do fluxo | os passos de `flow.ts` em andamento (ex.: `Atender o cliente #1 › Montar queijo na bancada`) |
| Tela | rota, tela (título, Preparo e aba, Dia de feira, fechamento), diálogo e mensagem visíveis |
| Dia | HUD (relógio, caixa, fila, reputação), passo da simulação e pausa, onde está o pasteleiro, painel aberto e seus controles, item selecionado, clientes, prontos |
| Falha | a mensagem de erro do teste |

O que vira evidência: cliques/teclas/preenchimentos feitos pela `page` (a fixture `page` é embrulhada),
toques e seguradas do `GamePage` (`tapControl`, `holdControl`, `goTo`, `tapStation`, `tapCustomer`,
`tapAt`, `holdAt`), os marcos (`boot`, `openFair`, `runToEnd`) e o fim do teste. Os gestos internos de
um gesto descrito ficam de fora (`ev.quiet`), para cada toque gerar uma evidência só. Para registrar um
momento à mão: `await game.evidence('descrição')`; para nomear um passo: `game.step('rótulo', fn)`.

Níveis: `acoes` (padrão), `marcos` (abertura, início e fim do dia, fim do teste e `game.evidence`) e
`off`, pela variável `PF_EVIDENCIAS` ou pela opção `evidencias` do projeto. A campanha completa usa
`marcos` (com o piloto seriam dezenas de milhares de gestos). Custo medido na suíte rápida: ~2.400
PNGs, ~190 MB, +35 s (2,4 → 3,0 min). Uma evidência que falha só gera aviso no console, nunca derruba o teste.

## Cobertura (por arquivo)

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
| `progressao` | dias 1–20 e modo livre: meta, reputação mínima, estação, balões e tema por dia; desbloqueios da aba Melhorias; dia repetido; validade da massa |
| `campanha-completa` | campanha inteira do "Nova campanha" ao dia 20, 2 dias de modo livre e "Passar o ponto"; por dia: Preparo pelas abas, dia pelo piloto, fechamento e save comparados com o `closeDay` do jogo, recarga no meio da campanha e saída no meio do dia |

## Campanha completa: diagnóstico

- Cada dia jogado grava `dia-cal<N>.json` (campanha do início do dia, comandos e `DayResult`) na pasta de
  saída do teste (`test-results/e2e/…`). Reproduzir os comandos sem tela dá o mesmo resultado (motor
  determinístico); comparar com o jogador automático no mesmo dia mostra onde a tela atrapalhou.
- `PF_PILOT_DEBUG=1 npm run test:e2e:campanha` imprime o ritmo dos gestos e qualquer gesto lento.
- No macOS rode com `caffeinate -dimsu` antes do comando: com a máquina ociosa o Chrome é suspenso e
  um dia de 12 s passa a levar minutos.
