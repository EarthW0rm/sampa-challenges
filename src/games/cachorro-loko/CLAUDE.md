# CLAUDE.md — Cachorro Loko

Leia antes o `CLAUDE.md` da raiz (regras do hub: CSS escopado, assets na pasta, manifest leve).
Regras de jogo (numeradas `CL-RN-NN`), pacotes e a tabela completa de parâmetros estão no `README.md`
desta pasta, que é o manual do jogo: mudou regra ou número, atualize o README e o teste da regra juntos.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub (id `cachorro-loko`, capa `assets/cenario/cena_exemplo.png`, `getRecord: loadRecord`) |
| `Game.tsx` | raiz: carrega os assets e alterna entre `TitleScreen` e `GameScreen` |
| `components/TitleScreen.tsx` | título, recorde, como jogar, legenda dos pacotes; Enter/Espaço começa |
| `components/GameScreen.tsx` | canvas + laço `requestAnimationFrame`, teclado, zonas de toque, HUD (vidas, poderes, placar), pausa, fim de turno |
| `game/constants.ts` | medidas, esteiras, velocidades, poderes |
| `game/types.ts` | `Box`, `BoxKind`, `BoxState`, `PowerKind`, `HudState` |
| `game/engine.ts` | `CachorroLokoEngine`: dificuldade por nível, spawn, desvios, pacotes, poderes, efeitos, desenho |
| `game/input.ts` | estado esquerda/direita vindo do teclado e do toque |
| `game/pixelFont.ts` | fonte 3×5 para textos no canvas (`+1`, `TURBO!`, …) |
| `game/record.ts` | recorde no `localStorage` (`cachorro-loko:recorde`) |
| `game/assets.ts` | lista de PNGs, `assetUrl`, `loadAssets` |
| `game/hires.ts` | `scale2x`, `upscaleAll` (sprites em alta, com cache), `blit`, `blitPart`, `SCALE` |
| `game/e2eHook.ts` | gancho dos testes de ponta a ponta (`window.__e2e`), inerte sem a flag da página de teste |
| `styles.css` | tudo prefixado com `.cachorro-loko` |

## Como o jogo funciona

- `update(segundos)` / `render(ctx)` / callback `onHud` (só quando o HUD muda, comparando JSON).
  Fases: `playing`, `paused`, `over`. O React espera 1,2 s depois de `over` para mostrar a tela de
  fim (o cachorro fica tonto nesse tempo).
- **Ciclo de um pacote** (`BoxState`): `chute` (cai do restaurante na esteira 1) → `belt` (anda na
  esteira) → no fim da esteira: `drop` (desce para a próxima, se o desvio estiver em "desce") ou
  `street` (arremessado para a rua). Só pacotes em `street` podem ser pegos ou se perder.
  Pacotes em `street` são desenhados na frente do cachorro.
- **Desvios:** cada um tem `state` (destino do PRÓXIMO pacote) e `flash` (pisca de 0,5 s). Não há
  relógio: em `updateBoxes`, quando um pacote chega ao fim da esteira ele usa o `state` atual e o
  desvio troca para o outro (`desce` ↔ `rua`). Assim o que a placa mostra é sempre o que vai
  acontecer com o próximo pacote, e a sequência é previsível (desce, rua, desce, rua…). Os desvios
  eram por tempo (a cada 3–6 s, depois 7–12 s com trava) e isso era o ponto mais difícil do jogo.
  Se quiser variar, mexa na regra de troca ali; não crie temporizadores sem aviso e sem trava.
- **Pega:** interseção do pacote (12×12) com `catchRect()`, que espelha `CATCH_RECT` conforme o lado
  para onde o cachorro olha e sobe `GRAU_LIFT` com o grau ativo.
- **Spawn:** só sai pacote novo se a boca da esteira 1 estiver livre; senão tenta de novo em 0,25 s.
  `pickKind()` decide bomba / especial / comum.
- **Poderes** ficam em `powers` (segundos restantes); o HUD recebe os segundos arredondados para
  cima.
- **Efeitos:** `fx` (brilho, poeira, explosão, caixa amassada) e `popups` (texto que sobe).
- Camada estática (fundo, pés das esteiras, restaurante) é desenhada uma vez em `staticLayer`.

## Resolução e visual em alta (640×400)

A lógica continua toda em 320×200 (posições, colisões, constantes), mas o canvas tem 640×400:

- `game/hires.ts` faz o Scale2x dos PNGs do jogo (cenário, esteiras) e só copia os da biblioteca
  (`isNativeHd`), com cache por conjunto de assets; `SCALE` = 2.
- `render()` começa com `ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)` e desenha os sprites com
  `blit(ctx, img, x, y)` (tamanho lógico) ou `blitPart` (recortes, origem em pixels lógicos).
  **Não use `ctx.drawImage(sprite, x, y)` direto num sprite em alta:** ele sai com o dobro do tamanho.
- Posições de quem se move podem usar meio pixel lógico (`Math.round(x * SCALE) / SCALE`), que vira
  um pixel de tela e deixa o movimento mais suave.
- `fillRect` e a fonte de pixels continuam em coordenadas lógicas (saem com 2×2 px de tela).
- A camada fixa (rua, pés das esteiras, restaurante) é montada uma vez em 640×400 e desenhada com
  `drawImage(staticLayer, 0, 0, W, H)`. O motor guarda os sprites em alta em `this.hi`.

## Sprites

- **Cachorro, caixas, HUD e efeitos vêm da biblioteca única** (`src/shared/sprites`, HD 2× nativo,
  ver o `README.md` de lá). `game/assets.ts` mapeia as chaves do motor para `lib/…`:
  `cachorro_{0,1}`/`_turbo_`/`_grau_`/`_tonto` → `lib/caes/p1_*` (80×80, viram 40×40 lógicos, virados
  para a direita; o motor espelha; os quadros 0/1 alternam os raios das rodas), caixas →
  `lib/itens/…` (24×24 = 12×12 lógicos, bomba com 2 quadros de pavio), `brilho/poeira/explosao/
  caixa_amassada` → `lib/fx/…`, corações → `lib/hud/…`. `isNativeHd(key)` (assets.ts) faz o
  `upscaleAll` copiar esses sprites em vez de aplicar Scale2x.
- `assets/esteira/`: ladrilho 16×8 em 4 quadros de animação, pontas, pé e as duas placas de desvio.
- `assets/cenario/`: fundo da rua (320×200), restaurante (112×52), chapeiro (2 quadros), capa.
- Esteira, restaurante, chapeiro e fundo: `tools/pixelart/cachorro_loko.py`. Cachorro, caixas e efeitos:
  `tools/pixelart/biblioteca/`. A cena de exemplo/capa ainda mostra as esteiras
  antigas, mais compridas que as de `BELTS`.

## Receitas

- **Deixar mais fácil ou mais difícil:** comece por `beltSpeed` e `spawnEvery`
  em `engine.ts`, depois `DOG_SPEED` e `CATCH_RECT`. Atualize a tabela do README.
- **Mudar as esteiras:** edite `BELTS`. Regra: a ponta de saída de cada esteira (x1 se `dir = 1`,
  x0 se `dir = −1`) precisa estar dentro do intervalo da esteira de baixo, senão o pacote em `drop`
  é encaixado na ponta mais próxima. Os pés e as placas de desvio se reposicionam sozinhos.
- **Novo poder:** acrescente em `PowerKind` (types.ts), `POWER_DURATION`, `POWER_LABEL` e no `pool`
  de `pickKind()` (engine.ts), aplique o efeito onde fizer sentido (`updateDog`, `updateBoxes`,
  `catchRect`), crie a caixa em `tools/pixelart/biblioteca/itens.py` (gere a biblioteca), mapeie em `assets.ts` e em `POWER_INFO`
  (GameScreen) e `BOXES` (TitleScreen).
- **Novo tipo de pacote ruim:** siga o caminho da `bomba` em `pickKind`, `onCatch` e `onLand`.

## Armadilhas conhecidas

- O `dt` é limitado a 0–0,05 s: o 1º quadro do `requestAnimationFrame` pode vir negativo (já causou
  índice de animação negativo e travou o jogo) e uma aba em segundo plano volta com saltos grandes.
- `GameScreen` pausa no `blur` da janela e limpa as teclas ao pausar, para a moto não "andar
  sozinha" ao voltar.
- As zonas de toque cobrem o canvas inteiro; os botões de seta só aparecem com `pointer: coarse`.
- O ímã também puxa bombas, de propósito.
- `gameOverReady` no motor não é usado pela interface (o atraso de 1,2 s é feito no React).
- Em `updateBoxes`, o laço para assim que a fase vira `over`: sem isso um pacote pego no mesmo quadro
  em que outro tocava o asfalto pontuava depois do fim (bug corrigido na US-127, CL-RN-26).
- O recorde só é gravado em `loseLife` (fim do turno). Sair no meio não salva (comportamento atual,
  decisão pendente em `docs/specs/e2e-jogos/bugs/cachorro-loko.md`).
- Os poderes terminam por subtração de `dt` em ponto flutuante: depois de exatamente `POWER_DURATION`
  segundos sobra ~1e-13 (o HUD mostra `1s` por um quadro). Nos testes, avance 1 quadro a mais.

## Como verificar

1. `npm run typecheck`, `npm run typecheck:e2e` e `npm run build` na raiz.
2. `npm run test:e2e -- e2e/cachorro-loko/` e `npm run test:e2e:cobertura -- --jogo cachorro-loko`.
3. Jogue: confira que o desvio alterna a cada pacote (desce, rua, desce…), que cada poder aparece no HUD com o
   tempo, que a bomba tira vida e deixa tonto, e que o recorde aparece no card do hub.
4. Para mexer no equilíbrio sem jogar horas, use o piloto (`npm run test:e2e:longa -- e2e/cachorro-loko/`):
   ele joga partidas inteiras pela tela e grava placar, nível e quadros em `partida-<n>.json`.

## Testes de ponta a ponta

Base comum em `e2e/support/` (guia em `e2e/README.md`); a camada deste jogo fica em `e2e/cachorro-loko/`.

- **Gancho** (`game/e2eHook.ts`): `exposeCachorroLoko(engine, stage)` é chamado no efeito do motor em
  `GameScreen` e o `dispose` no cleanup. Publica `window.__e2e = { id: 'cachorro-loko', api }` só com a
  flag da página de teste (`src/shared/e2e/hook.ts`). O motor não tem campos públicos novos: o gancho
  usa os métodos `e2eState()`, `e2eEvents()`, `e2eTargets()` e `e2eSpawn/e2eSetLives/e2eSetScore/e2eChef`.
- **O que expõe:** `state()` (fase, placar, entregas, vidas, nível, recorde, tempo de jogo, velocidade
  das esteiras, intervalo e cronômetro do próximo pedido, contador de especiais, poderes em segundos,
  cachorro x/lado/tonto, área de pega, pacotes com tipo/x/y/vx/vy/estado/esteira, os 3 desvios com
  destino e pisca, nº de eventos); `events(from)` (registro da partida: `spawn`, `desce`, `rua`,
  `catch` com pontos e dobro, `land`, com placar e vidas depois de cada um; só existe sob a flag);
  `targets()` (zonas de toque em coordenadas da página e a área de pega lógica).
- **`prepare`** (pré-condição rara, sempre comentada no teste): `spawn(tipo, onde?)` põe um pacote (na
  boca ou na rua/esteira), `lives(n)`, `score(n)` e `chef(on)` (liga/desliga os pedidos automáticos).
- **Página** (`e2e/cachorro-loko/support/page.ts`): `play`, `openTitle`, `start(Enter|Space|click)`,
  `walk(lado, quadros, setas|ad)`, `walkTo(x)`, `touch(lado, quadros)` (toque real por CDP em tela de
  toque, mouse no desktop), `pause(P|Esc)`, `blurWindow`, `dropAt`/`dropOnDog`/`settle` (pacote posto
  na rua e o evento final dele), `waitGameOver`. Lógico 320×200.
- **Cabeçalho das evidências** (`support/describe.ts`): partida (fase, placar, entregas, vidas, nível),
  poderes, cachorro, pacotes (tipo@esteira) e desvios.
- **Piloto** (`support/pilot.ts` + `piloto.spec.ts`, projeto `longa`): prevê quando e onde cada pacote
  que vai para a rua chega à altura do baú (esteiras na ordem de chegada, desvios alternando, gravidade,
  vx médio de 23 px/s) e segura ←/→ por até 6 quadros para ficar embaixo do primeiro alcançável; desvia
  de bomba que chega antes. Ao fim, `recalc(events)` refaz placar (×2 dentro de 10 s da caixa de dobro)
  e vidas só pelos eventos e compara com o jogo, o diálogo, o `localStorage` e o card do hub.
  Teto: 20 min de jogo por partida. Sementes 11, 23 e 37 (≈ 23–39 entregas, nível 3–4).
- **Determinismo:** o relógio dos testes controla quadros, `performance.now`/`Date.now` e a semente do
  `Math.random` (o motor usa `Math.random` como `rng`). Só o atraso de 1,2 s do diálogo de fim é
  `setTimeout` real (os testes esperam com `expect`). Mesma semente + mesmos gestos = mesmo
  `partida-<n>.json` (conferido no piloto).

```bash
npm run test:e2e -- e2e/cachorro-loko/                          # desktop + 390 px
npm run test:e2e -- -g "CL-RN-13"                               # uma regra
caffeinate -dimsu npm run test:e2e:longa -- e2e/cachorro-loko/  # piloto
```

Filtre sempre com `e2e/cachorro-loko/`: `cachorro-loko/` sozinho casa com o caminho do worktree
`.worktrees/cachorro-loko/` e roda a suíte inteira.
