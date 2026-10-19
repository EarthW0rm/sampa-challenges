# CLAUDE.md — Pinball Paulista

Leia antes o `CLAUDE.md` da raiz (regras do hub: CSS escopado, assets na pasta, manifest leve).
Regras de jogo e tabela de parâmetros: `README.md` desta pasta.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub (id `pinball-paulista`, capa `assets/capa.png`, `getRecord: loadRecord`) |
| `Game.tsx` | raiz: carrega os assets, alterna entre `TitleScreen` e `GameScreen` |
| `components/GameScreen.tsx` | canvas + laço `requestAnimationFrame`, teclado, zonas de toque, botões Lançar/Sacudir, painéis laterais, pausa e fim de jogo |
| `components/TitleScreen.tsx` | título, instruções |
| `game/constants.ts` | todos os números de física e regras |
| `game/geometry.ts` | paredes (`WALLS`), pinos, bumpers, estilingues, alvos, raias, spinners, portão |
| `game/engine.ts` | `PinballEngine`: física, regras, HUD (`onHud`) e desenho |
| `game/assets.ts` | lista de PNGs (do jogo + biblioteca `lib/…`), `assetUrl`, `loadAssets`, `isNativeHd` |
| `game/hires.ts` | `scale2x`, `upscaleAll`, `blit`, `SCALE` (igual aos outros jogos) |
| `game/input.ts` | `Input`: teclado + toque (esquerda, direita, lançador) |
| `game/pixelFont.ts` | fonte 3×5 A–Z/0–9 para letras dos alvos e mensagens no canvas |
| `game/sound.ts` | `sfx`: efeitos em WebAudio (singleton; `unlock()` no 1º gesto; mute persistido) |
| `game/record.ts` | `loadRecord`/`saveRecord` (`pinball-paulista:recorde`) |

## Como o motor funciona

- **Física própria** (`stepBall`): passo fixo `STEP` = 1/480 s acumulado em `stepWorld`. A cada passo:
  gravidade → movimento → paredes (`segHit`) → pinos → portão → estilingues → alvos → bumpers →
  flippers → sensores (raias, spinners, Minhocão) → ralo. Colisão círculo × segmento/círculo/cápsula
  empurra a bola para fora e reflete a velocidade normal (`bounce`) com elasticidade `e`; abaixo de
  `REST_SPEED` o quique é zerado.
- **Flipper:** cápsula que afina; a velocidade da superfície no ponto de contato (ω × r, com sinal
  do lado) entra na velocidade relativa, por isso o flipper "bate" e não só empurra. `omega` é
  derivado da variação de ângulo por passo.
- **Estados:** `ready` (bola na rampa), `play`, `bonus` (contagem 3,4 s), `over`, `paused`.
  Sempre que a bola assenta na rampa (`rest`) o lançador volta a funcionar.
- **Bola presa no Minhocão:** `held > 0`, fora da física; ao fim aplica o prêmio (`applyAward`) e solta.
- **Multiball:** `startMultiball` cria 2 bolas; `liveBalls() > 1` dobra o bumper. Só vira "bola perdida"
  quando não resta nenhuma (com segura-bola ativo e sem tilt a bola volta à rampa).
- **HUD:** o motor chama `onHud(HudState)` só quando o JSON do estado muda; o React não guarda estado
  do jogo.
- **Desenho:** uma camada estática (fundo + trilhos + pinos) é montada uma vez em `buildStatic()`;
  o resto (flippers, bola, estilingues, plaquinhas, mola) é rasterizado em meio pixel lógico
  (`raster`) para ficar nítido a 2×, sem antialias. Bumpers usam os `bumper_0..3.png`.

## Armadilhas conhecidas (já aconteceram)

- **Bola travada** entre a guia e o pivô do flipper: a guia termina na altura do topo da cápsula
  (`(22,330)→(70,345)`). Se mexer em guias/flippers, rode o teste de robô (abaixo) e procure bola
  parada fora da rampa/Minhocão.
- **Estilingues em ping-pong:** sem sorteio no chute, a bola ficava rebatendo para sempre entre os dois.
- **Minhocão + bumper do meio:** o buraco está logo abaixo do bumper central; ejetar na vertical
  voltava sempre ao buraco. A ejeção é diagonal (±25–55°) e há um tempo de "entupido" (`kickCd` 4 s).
- **Corredores laterais:** o fundo inclinado (`(8,194)→(34,206)`) leva a bola para dentro da mesa; sem
  ele o orbit terminava direto na canaleta.
- `ctx.setTransform(SCALE, …)`: não use `drawImage(sprite, x, y)` direto em sprite em alta.

## Como verificar

1. `npm run typecheck`.
2. Teste de robô (headless): rodar o motor com `update(1/60)` por vários minutos simulados, com um
   robô que aperta flippers perto da bola e segura Espaço na rampa; checar que a bola nunca sai do
   campo (x ∈ [0,240], y ≥ −5), que não fica parada fora de `rest`/`held`, e que os 3 jogos terminam.
3. Jogue: lançar, flippers, bumpers mudando de cor, Minhocão, 7 letras = multiball, 4 trancos seguidos = tilt.
