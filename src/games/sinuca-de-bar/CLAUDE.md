# CLAUDE.md — Sinuca de Bar

Leia antes o `CLAUDE.md` da raiz (regras do hub: CSS escopado em `.sinuca-de-bar`, assets na pasta,
manifest leve). Regras de jogo, níveis e tabela de parâmetros: `README.md` desta pasta.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub (id `sinuca-de-bar`, capa `assets/capa.png`, `order: 6`) |
| `Game.tsx` | raiz: carrega os assets e as últimas escolhas, alterna entre `Menu` e `GameScreen` |
| `components/Menu.tsx` | modo, regra da casa, nível do computador, nomes, quem dá a saída |
| `components/GameScreen.tsx` | canvas + laço `requestAnimationFrame`, ponteiro, teclado, mira/força/tacada, fim de partida |
| `game/physics.ts` | física pura: `step`, `simulate`, `canPlaceCue`, `castRay` (linha de mira), `ShotEvents` |
| `game/rules.ts` | regras puras: `RULES` (castigo e nomes dos grupos), `groupOf`, `legalTargets`, `resolveShot`, `rack`, `footSpot` |
| `game/ai.ts` | `chooseShot(bolas, estado, nível)` e `LEVELS` |
| `game/ai.worker.ts` | Web Worker: recebe a mesa, o estado, o nível e (nos testes) a `seed`; devolve a tacada do computador |
| `game/random.ts` | `mulberry32(seed)`: sorteio com semente da IA quando o pedido traz `seed` |
| `game/e2eHook.ts` | gancho dos testes de ponta a ponta (`window.__e2e`), inerte sem a flag da página de teste |
| `game/engine.ts` | `SinucaEngine`: partida, entrada, vez do computador, animações, desenho e HUD |
| `game/constants.ts` | mesa, física, interface e tempos do computador |
| `game/config.ts` | `loadSettings`/`saveSettings` (`sinuca-de-bar:config`) |
| `game/assets.ts` | lista de PNGs, `assetUrl`, `isNativeHd` (bolas), `loadAssets` |
| `game/hires.ts` | `scale2x`, `upscaleAll` (copia as bolas, que já são 2×), `blit`, `SCALE` |
| `game/pixelFont.ts` | fonte 3×5 (sem acentos: o motor passa os textos por `plain()`) |
| `game/sound.ts` | `sfx`: taco, choque, tabela, caçapa, falta, vez, vitória/derrota (WebAudio; mute em `sinuca-de-bar:som`) |
| `game/types.ts` | `Settings`, `HudState` |

## Resolução

Lógica em **320×200** (`W`, `H`): posições, colisões e a física ficam nessa grade. O canvas tem
**640×400** (`SCALE` = 2): `render()` começa com `setTransform(SCALE, …)` e desenha com `blit()`; o
fundo passa por Scale2x e as bolas já são 2× nativo. Posições de bola usam `snap()` (meio pixel
lógico = 1 pixel de tela). O CSS estica o canvas à largura do palco (`aspect-ratio: 640 / 400`).

## Sprites

`tools/pixelart/sinuca_de_bar.py` gera `cenario/mesa.png` e `capa.png` em 1× (Scale2x no
jogo) e `bolas/b0..b15.png`, `sombra.png`, `mira.png` em 16×16 **2× nativo** (8 px lógicos de
diâmetro: em 1× o número não seria legível). A capa usa o cachorro caramelo da biblioteca.

```bash
cd tools/pixelart && python3 sinuca_de_bar.py ../../src/games/sinuca-de-bar/assets
```

## Como o jogo funciona

- **Física (`physics.ts`):** bolas de massa igual, sem efeito (spin). Passo fixo `PHYS_DT` dividido
  em subpassos para nenhuma bola andar mais que `MAX_SUBSTEP_MOVE`. Atrito = desaceleração constante
  + arrasto linear. Choques elásticos com restituição; as tabelas são 6 segmentos e as pontas deles
  são as bocas das caçapas, com quinas cortadas (`facings()`, 45° nos cantos) que guiam para dentro
  a bola que chega em ângulo. Uma bola cai quando o
  centro entra no raio de captura da caçapa; se escapar da mesa sem cair, vai para a caçapa mais
  perto. `ShotEvents` registra a primeira bola tocada pela branca e as encaçapadas, na ordem.
- **Regras (`rules.ts`):** `resolveShot(estado, bolas antes, eventos)` decide falta, vitória/derrota
  pela castigo, grupo (mesa aberta), se continua e a bola na mão. "Na castigo" = grupo já vazio
  **antes** da tacada; por isso derrubar a última do grupo e a castigo juntas perde.
- **Estados no motor:** `aim` (vez de mirar; humano ou computador), `stroke` (animação do taco),
  `rolling` (física rodando com acumulador de `PHYS_DT`), `over` (alguém venceu). Quando tudo para,
  `endShot()` aplica `resolveShot`, recoloca a castigo (saída) ou a branca (caiu), mostra avisos e
  passa a vez.
- **Computador:** na vez dele (`updateCpu`), pede a tacada ao worker, espera `AI_THINK_S`, põe a
  branca (bola na mão), gira o taco até a mira em `AI_AIM_S` e bate. Respostas com `id` antigo são
  descartadas (nova partida no meio). Sem worker (falha na carga = `onerror`), `chooseShot` roda na
  thread principal depois de 30 ms. Na vez dele a barra de força fica desligada e `setPower` ignora.
- **Semente da IA (`AiRequest.seed`):** `requestAi` preenche `seed: e2eSeed()` (de
  `src/shared/e2e/hook.ts`): `undefined` para o jogador, um número tirado do `Math.random` semeado nos
  testes. Com `seed`, o worker (e a reserva na thread principal) usa `mulberry32(seed)` como `rnd` do
  `chooseShot`; sem ela, `Math.random`. O relógio dos testes não roda dentro do worker, por isso a
  semente vai no pedido.
- **IA (`ai.ts`):** para cada bola permitida × caçapa, calcula a bola-fantasma; descarta corte acima
  de ~75° e caminhos bloqueados; simula cada linha em algumas forças com a mesma física e dá nota
  pelo resultado das regras (vitória, falta, continua, bolas do grupo, posição da branca no nível
  3). Com bola na mão, testa posições da branca atrás da bola-fantasma. Sem linha limpa, mira
  direto numa bola permitida e escolhe a que não faz falta. O erro do nível entra no fim (mira e
  força com ruído gaussiano). Pior caso medido ≈ 2 s no nível 3 (por isso o worker).
- **HUD:** caixas do placar desenhadas no canvas (nome, vitórias, grupo com as bolas que faltam,
  "MATA A 8"); o React recebe `HudState` só quando o JSON muda e mostra força, botões e o fim.

## Receitas

- **Mudar a dificuldade:** `LEVELS` em `ai.ts` (erro de mira/força, forças testadas, posição).
  Valide com partidas computador × computador (abaixo); o nível mais alto deve vencer.
- **Mudar a sensação da mesa:** `ROLL_DECEL`, `LINEAR_DRAG`, `MAX_SPEED`, restituições. A IA usa a
  mesma física, então se ajusta sozinha.
- **Mudar a mesa (tamanho, caçapas):** `constants.ts` e o topo de `tools/pixelart/sinuca_de_bar.py`
  juntos; gere o fundo de novo.
- **Nova regra da casa:** acrescente em `RuleSet`/`RULES`/`groupOf` (`rules.ts`) e no menu.

## Armadilhas conhecidas

- As bolas já são 2× nativo: `isNativeHd` faz o `upscaleAll` copiar em vez de aplicar Scale2x
  (senão saem com o dobro do tamanho).
- O worker é criado com `new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })`;
  não troque por caminho em string (quebra com hash de build e `base: './'`).
- `resolveShot` precisa das bolas **antes** da tacada (`this.before`), não das de depois.
- A física é determinística só com passo fixo: não chame `step` com `dt` variável.
- `resolveShot` já devolve "Falta: …" em `messages` (menos quando a tacada encerra a partida): o
  `endShot` só acrescenta o aviso nesse caso (antes saía duplicado).
- Ponteiro: as coordenadas do canvas viram lógicas por `getBoundingClientRect` (o canvas é esticado
  por CSS); `setPointerCapture` mantém o arraste da branca mesmo fora do canvas.

## Como verificar

1. `npm run typecheck` e `npm run build` (deve sair um `ai.worker-*.js` em `dist/assets/`).
2. Regras e IA headless com esbuild + node: cenários de `resolveShot` (8 antes da hora, branca
   junto com a 8, falta por tocar primeiro na do adversário, grupo na mesa aberta, castigo na
   saída) e partidas `chooseShot` nível 3 × nível 1 alternando quem começa, conferindo que não há
   bolas sobrepostas e que a branca nunca é posta em lugar inválido.
3. `npm run test:e2e -- e2e/sinuca-de-bar/` e `npm run test:e2e:cobertura -- --jogo sinuca-de-bar`.
4. Jogue: saída com a branca atrás da linha, mira por toque/arrasto e teclado, bola na mão depois
   de falta, fim pela castigo, nova partida (alterna a saída), tela de ≈390 px.

## Testes de ponta a ponta

Base comum em `e2e/support/` (guia em `e2e/README.md`); a camada deste jogo fica em `e2e/sinuca-de-bar/`.

- **Gancho** (`game/e2eHook.ts`): `exposeSinuca(engine)` é chamado no efeito do `GameScreen` que cria
  o motor, e o `dispose` no cleanup. Publica `window.__e2e = { id: 'sinuca-de-bar', api }` só com a
  flag da página de teste. O motor tem métodos próprios para isso (campos continuam `private`):
  - `state()` (`e2eState()`): modalidade, modo, nível, castigo, nomes, fase (`aim`/`stroke`/
    `rolling`/`over`), vez, grupos, saída, bola na mão, `onCastigo`, bolas permitidas (`legal`),
    vencedor e motivo, vitórias, quem saiu, bolas (n, x, y, na mesa, rolando), mira (rad), força,
    linha de mira (`guide`: bola atingida e se é permitida), arraste da branca, `canPlace`, vez do
    computador (`cpu`: estágio, tempo, tacada pronta), `thinking`, nº de tacadas, a última tacada
    (`lastShot`: quem, 1ª bola, encaçapadas, falta, continua, grupo, recolocações), avisos na mesa e a
    IA (`ai`: worker vivo, pedidos, respostas, descartadas, reservas, última tacada do computador).
  - `targets()`: bolas, caçapas, linha de cabeceira e pano (lógico) e os retângulos (página) de
    ◀ ‹ › ▶, Força e Tacar!.
  - `prepare.balls(lista)` (bolas fora da lista saem da mesa) e `prepare.turn(p, { groups, isBreak,
    ballInHand })`: só para montar a mesa de uma falta ou da castigo; cada uso é comentado no teste.
- **Página** (`e2e/sinuca-de-bar/support/page.ts`, `SinucaPage`): `open`, `menu(opções)`, `start`,
  `aimAt`/`aimToward` (toque na mesa), `nudgeAim` (◀ ‹ › ▶), `power(%)` (barra), `shoot`/
  `shootAndSettle`/`shotAt`, `placeCue` (arraste) e `placeCueKeys` (W A S D), `touchTap`/`touchDrag`
  (dedo, via CDP) e `setTable` (pré-condição pelo `prepare`). Lógico 320×200.
- **Cabeçalho das evidências** (`support/describe.ts`): modalidade, vez, grupos, bolas na mesa, mira e
  força, bola na mão, última tacada e resultado.
- **Determinismo:** relógio manual (quadros de 1/60 s; `performance.now`/`Date.now` virtuais),
  `Math.random` semeado (triângulo, Sorteio) e a semente no pedido ao worker (acima). A física usa
  passo fixo, então a mesma semente e os mesmos gestos dão a mesma partida. A resposta do worker
  chega em tempo real: os testes esperam com `expect.poll` e o piloto espera sem rodar quadros.
- **Piloto** (`support/pilot.ts` + `piloto.spec.ts`, projeto `longa`): na vez de uma pessoa usa o
  `chooseShot` do jogo no nível Tubarão (sorteio `mulberry32` da semente da partida) e executa pela
  tela: arrasta a branca, toca na direção da mira, ajusta a Força e toca em Tacar!. Na vez do
  computador espera a resposta do worker sem rodar quadros. Cada tacada é recalculada com
  `resolveShot` sobre os eventos lidos (`lastShot`) e comparada com o jogo; no fim confere o diálogo
  (vencedor, motivo, placar) e que o card do hub não mostra recorde. Partidas: lisas e ímpares × pares
  contra o Pato e uma de 2 jogadores; a mesma semente jogada 2 vezes dá o mesmo `partida-<n>.json`.

```bash
npm run test:e2e -- e2e/sinuca-de-bar/                                       # desktop + celular
npx playwright test -c e2e/playwright.config.ts --project=desktop e2e/sinuca-de-bar/faltas-bola-na-mao
npm run test:e2e -- -g "SB-RN-26"                                            # uma regra
caffeinate -dimsu npm run test:e2e:longa -- e2e/sinuca-de-bar/              # piloto
npm run test:e2e:cobertura -- --jogo sinuca-de-bar
```

Num worktree em `.worktrees/sinuca-de-bar/`, filtre por `e2e/sinuca-de-bar/` (o filtro
`sinuca-de-bar/` casa com o caminho de todos os arquivos) e use `E2E_PORT` próprio.
