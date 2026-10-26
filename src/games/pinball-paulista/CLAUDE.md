# CLAUDE.md — Pinball Paulista

Leia antes o `CLAUDE.md` da raiz (regras do hub: CSS escopado em `.pinball-paulista`, assets na pasta,
manifest leve). O `README.md` desta pasta é o manual: regras numeradas `PP-RN-NN`, parâmetros e a tabela
regra → teste. Mudou regra ou número? Atualize o README e o teste da regra no mesmo commit.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub (id `pinball-paulista`, capa `assets/capa.png`, `getRecord: loadRecord`) |
| `Game.tsx` | raiz: carrega os assets, alterna entre `TitleScreen` e `GameScreen` |
| `components/GameScreen.tsx` | canvas + laço `requestAnimationFrame`, teclado, foco (`blur` pausa), zonas de toque, botões Lançar/Sacudir, painéis, pausa e fim de jogo; publica o gancho de testes |
| `components/TitleScreen.tsx` | título, recorde, "Como jogar"; Enter/Espaço começam |
| `game/constants.ts` | todos os números: física, flippers, lançador, tranco, Minhocão, pontos (`PTS`), bônus (`BONUS_PTS`), ciclo de prêmios (`AWARDS`) |
| `game/geometry.ts` | paredes (`WALLS`), pinos, bumpers, estilingues, alvos, raias, spinners, portão |
| `game/engine.ts` | `PinballEngine`: física, regras, HUD (`onHud`), desenho e os métodos `e2e*` |
| `game/e2eHook.ts` | gancho dos testes (`exposePinball`), tipos `PinballE2EState`/`PinballTargets`/`PinballPrepare` |
| `game/types.ts` | `Phase`, `HudState`, `ScoreKind` (tipos de evento que pontuam) |
| `game/assets.ts` | lista de PNGs (do jogo + biblioteca `lib/…`), `assetUrl`, `loadAssets`, `isNativeHd` |
| `game/hires.ts` | `scale2x`, `upscaleAll`, `blit`, `SCALE` |
| `game/input.ts` | `Input`: teclado (setas, Z/A, `/`/D, Espaço/↓) + toque (esquerda, direita, lançador) |
| `game/pixelFont.ts` | fonte 3×5 para letras dos alvos e mensagens no canvas |
| `game/sound.ts` | `sfx`: efeitos em WebAudio (singleton; `unlock()` no 1º gesto; mudo em `pinball-paulista:som`) |
| `game/record.ts` | `loadRecord`/`saveRecord` (`pinball-paulista:recorde`, em `try/catch`) |

## Resolução

Mesa **vertical**: lógica em 240×400 (`W`, `H`), canvas em 480×800 (`SCALE` = 2), ampliado por CSS
(`.stage` com largura limitada pela altura da janela). `render()` desenha a camada estática (fundo,
trilhos, pinos) uma vez em `buildStatic()` e, por cima, flippers, bola, estilingues, placas e mola
rasterizados em meio pixel lógico (`raster`), sem antialias. Use `ctx.setTransform(SCALE, …)` + `blit()`;
nunca `drawImage(spriteEmAlta, x, y)` sem tamanho.

## Sprites

Do jogo (`assets/mesa/`): `fundo.png` e `bumper_0..3.png` (vermelho, amarelo, verde, aceso). Da biblioteca
compartilhada (`src/shared/sprites`, HD nativo, copiados pelo `upscaleAll` via `isNativeHd`): capacetes do
painel de bolas, cachorro do título, efeitos `brilho_*` e `explosao_*`. O resto (flippers, bola, placas
MOTOBOY, raias, spinner, estilingues) é desenhado em código.

## Como o jogo funciona

- **Laço:** `GameScreen` cria o motor no `useEffect`, roda `update(dt)` + `render(ctx)` a cada quadro e
  descarta no cleanup (cancela o rAF, `dispose()` do gancho e do motor). `update` limita `dt` a
  `[0, MAX_DT]`.
- **Física própria** (`stepBall`): passo fixo `STEP` = 1/480 s acumulado em `stepWorld` (no máximo
  `MAX_SUBSTEPS` por quadro). A cada passo: gravidade → movimento → **alvos MOTOBOY** → paredes
  (`segHit`) → pinos → portão → estilingues → bumpers → flippers → sensores (raias, spinners, Minhocão)
  → rampa → ralo. Colisão círculo × segmento/círculo/cápsula empurra a bola para fora e reflete a
  velocidade normal (`bounce`); abaixo de `REST_SPEED` o quique é zerado.
- **Flipper:** cápsula que afina; a velocidade da superfície (ω × r) entra na velocidade relativa, então
  o flipper "bate". `omega` vem da variação de ângulo por passo.
- **Estados:** `ready` (bola na rampa), `play`, `bonus` (`BONUS_SECONDS`), `over`, `paused`
  (`prevPhase` guarda a anterior). Bola que assenta na rampa (`rest`) libera o lançador.
- **Pontos:** todo ponto passa por `addScore(n, kind)`, que soma no placar, grava o recorde na hora se o
  placar passou (`saveRecord`) e conta no `tally` por tipo (lido pelos testes). O bônus de cada bola fica
  em `bonusLog`.
- **Minhocão:** `held > 0` tira a bola da física; ao soltar aplica o próximo prêmio de `AWARDS`
  (`applyAward`, pulando `extra` se já saiu) e ejeta em diagonal alternando o lado.
- **Multiball:** `startMultiball` cria 2 bolas; `liveBalls() > 1` dobra o bumper. "Bola perdida" só
  quando não resta nenhuma (com segura-bola e sem tilt a bola volta à rampa).
- **HUD:** o motor chama `onHud(HudState)` só quando o JSON do estado muda; o React não guarda estado do
  jogo. O overlay de fim de jogo aparece 1 s depois (`setTimeout` real).

## Receitas

- **Mudar pontuação:** só em `PTS`/`BONUS_PTS` (`constants.ts`); atualize a tabela "Pontos" do README.
  Os testes leem os valores das constantes.
- **Novo prêmio do Minhocão:** acrescente em `AWARDS` (o tipo `Award` deriva dele), trate no `switch` de
  `applyAward`, documente em PP-RN-15 e cubra em `minhocao.spec.ts`.
- **Novo elemento que pontua:** novo `ScoreKind` em `types.ts`, `addScore(n, 'tipo')` no motor, e se
  entra no bônus, `BONUS_PTS` + `expectedBase` em `e2e/pinball-paulista/support/rules.ts`.
- **Mexer em guia, parede ou flipper:** rode o piloto (`npm run test:e2e:longa -- e2e/pinball-paulista/`) e
  procure bola parada fora da rampa/Minhocão (partida que não termina estoura `MAX_FRAMES`).

## Armadilhas conhecidas (já aconteceram)

- **Alvo sobre parede:** as placas MOTOBOY ficam sobre a guia do corredor. Se a parede for tratada antes do
  alvo no mesmo subpasso, ela rebate a bola e o alvo nunca vê o impacto (as letras não acendiam). Os alvos
  vêm antes de `WALLS` em `stepBall`.
- **Contador que decai:** a conta de trancos cai continuamente; comparação `>=` com inteiro nunca bate
  (o aviso CUIDADO! não aparecia). Use `>`.
- **Recorde lido ao renderizar:** o título e a home do hub leem o recorde no render, antes do cleanup do
  motor; por isso o recorde é gravado na hora em `addScore`, não só no `dispose`.
- **Spinner depois do fim:** a roda continua girando; ela não pontua em `over` e `restart()` a zera.
- **Bola travada** entre a guia e o pivô do flipper: a guia termina na altura do topo da cápsula
  (`(22,330)→(70,345)`). Com o flipper levantado a bola pode descansar no pivô (o piloto solta o flipper
  nesse caso).
- **Estilingues em ping-pong:** sem sorteio no chute, a bola rebatia para sempre entre os dois.
- **Minhocão + bumper do meio:** ejetar na vertical voltava ao buraco; a ejeção é diagonal e há o
  "entupido" (`KICKOUT_COOLDOWN`).
- **Corredores laterais:** o fundo inclinado (`(8,194)→(34,206)`) leva a bola para dentro da mesa.
- **Tecla mais curta que 1 quadro** (abaixa e solta antes do próximo quadro) não conta: o jogo lê o estado
  das teclas a cada quadro. Nos testes, use `keyDown`/`keyUp` com quadros no meio, não `keyboard.press`.

## Como verificar

1. `npm run typecheck`, `npm run typecheck:e2e` e `npm run build`.
2. `npm run test:e2e -- e2e/pinball-paulista/` (desktop + celular) e `npm run test:e2e:cobertura -- --jogo pinball-paulista`.
3. Mexeu em física ou regras: `caffeinate -dimsu npm run test:e2e:longa -- e2e/pinball-paulista/` (piloto).
4. Jogue: lançar, flippers, bumpers mudando de cor, Minhocão, 7 letras = multiball, 4 trancos = tilt.

## Testes de ponta a ponta

Base comum em `e2e/support/` (guia em `e2e/README.md`); a camada deste jogo fica em `e2e/pinball-paulista/`.

- **Gancho** (`game/e2eHook.ts`): `exposePinball(engine)` é chamado no efeito que cria o motor e o
  `dispose` no cleanup. Publica `window.__e2e = { id: 'pinball-paulista', api }` só quando a página de
  teste liga a flag (`src/shared/e2e/hook.ts`). A `api` lê o motor por métodos (`e2eState()`,
  `e2eTargets()`), sem tornar campos públicos:
  - `state()`: fase, placar, recorde, bola atual, multiplicador, letras, raias, batidas nos bumpers,
    verdes, onda, segura-bola, tilt e conta de trancos, bola extra, entupido e lado da ejeção, próximo
    prêmio, base e tela de bônus, `bonusLog`, carga do lançador, mensagem, bolas (x, y, vx, vy, rampa,
    presa), flippers (ângulo), spinners, `tally` (pontos por tipo de evento) e tempo de jogo.
  - `targets()`: metades da mesa (toque dos flippers), seletores de Lançar e Sacudir, e posições lógicas
    de flippers, bumpers, raias, placas, spinners, estilingues, Minhocão e portão.
  - `prepare` (pré-condição rara, sempre comentada no teste): `ball(x, y, vx, vy, i?)` coloca uma bola
    livre; `lights({ letters, rolls, bumperHits, mult, nextAward, kickCd, saver })` ajusta luzes e
    contadores.
- **Página** (`support/page.ts`): `PinballPage` (lógico 240×400) com `open`, `flipper`, `flipperDown/Up`,
  `keyDown/keyUp`, `launch`, `launchIntoPlay`, `nudge`, `touchFlipper` (mouse), `touchLaunch`,
  `touchHoldAt`/`touchHoldClient` (toque real via CDP, projeto `celular`), `placeBall`, `drainBall`,
  `lights`, `shownScore`, `waitPhase`.
- **Cabeçalho das evidências** (`support/describe.ts`): fase, bola, placar e multiplicador, MOTOBOY,
  semáforos/onda, bolas na mesa, segura-bola e tilt (spec RN-34).
- **Regras de conta** (`support/rules.ts`): `tallyTotal` (soma dos eventos = placar), `expectedBase`
  (base do bônus a partir dos eventos), `delta`.
- **Piloto** (`support/pilot.ts` + `piloto.spec.ts`, projeto `longa`): bola descendo (vy > 20) na zona de
  um flipper e fora do pivô → segura Z ou `/` por 8 quadros; bola na rampa → segura Espaço
  `PLUNGER_CHARGE_TIME`; carga pendente → espera 2 quadros. Joga as sementes 1, 2 e 3 até o fim e confere
  placar exibido = `tallyTotal`, bônus = base × mult, recorde salvo e no card do hub; repete a semente 1
  na mesma aba e compara os `partida-<n>.json`. Teto `MAX_FRAMES` = 30 min de jogo. ~3 min com 2 workers.
- **Determinismo:** o relógio dos testes controla os quadros, `performance.now`/`Date.now` e a semente do
  `Math.random`; a física roda sempre os mesmos subpassos. Para repetir uma partida na mesma aba, saia da
  página (`about:blank`) antes do `boot`: trocar só o hash não recarrega nem ressemeia.

```bash
npm run test:e2e -- e2e/pinball-paulista/                    # suíte rápida (desktop + celular), ~40 s
npm run test:e2e -- -g "PP-RN-15"                             # uma regra
caffeinate -dimsu npm run test:e2e:longa -- e2e/pinball-paulista/  # piloto
npm run test:e2e:cobertura -- --jogo pinball-paulista
```

Num worktree em `.worktrees/<nome>/`, filtre por `e2e/pinball-paulista/` (o filtro `pinball-paulista/`
casa com o caminho do worktree e roda tudo) e use uma porta própria (`E2E_PORT`).
