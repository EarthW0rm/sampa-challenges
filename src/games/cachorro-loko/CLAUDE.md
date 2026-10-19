# CLAUDE.md — Cachorro Loko

Leia antes o `CLAUDE.md` da raiz (regras do hub: CSS escopado, assets na pasta, manifest leve).
Regras de jogo, pacotes e a tabela completa de parâmetros estão no `README.md` desta pasta.

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
| `styles.css` | tudo prefixado com `.cachorro-loko` |

## Como o motor funciona

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

## Visual em alta (640×400)

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

## Como verificar

1. `npm run typecheck` na raiz.
2. Jogue: confira que o desvio alterna a cada pacote (desce, rua, desce…), que cada poder aparece no HUD com o
   tempo, que a bomba tira vida e deixa tonto, e que o recorde aparece no card do hub.
3. Para mexer no equilíbrio sem jogar horas, dá para escrever um robô: crie o motor com um `Input`
   controlado por código, chame `update(1/60)` em laço e mova o cachorro até o ponto de queda
   previsto dos pacotes em `street`. Foi assim que a curva atual foi ajustada.
