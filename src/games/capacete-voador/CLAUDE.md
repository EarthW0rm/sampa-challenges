# CLAUDE.md — Capacete Voador

Leia antes o `CLAUDE.md` da raiz (regras do hub: CSS escopado, assets na pasta, manifest leve).
As regras do jogo e a tabela de parâmetros estão no `README.md` desta pasta.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub (id `capacete-voador`, capa `assets/cenario/cena_exemplo.png`) |
| `Game.tsx` | raiz: carrega os assets, alterna entre `Menu` e `GameScreen`, guarda as `Settings` |
| `components/Menu.tsx` | modo, dificuldade, nomes, pontos, gravidade, garoa |
| `components/GameScreen.tsx` | canvas + laço `requestAnimationFrame`, painéis dos jogadores (vida da moto, mira), placar, fim de jogo |
| `components/AimForm.tsx` | campos de ângulo e velocidade com validação |
| `game/types.ts` | `Settings`, `Shot`, `GameMode`, `Difficulty`, `Rect`, `Point` |
| `game/constants.ts` | todos os números de física, áreas de acerto e limites |
| `game/assets.ts` | lista de PNGs, `assetUrl`, `riderKey(jogador, dano, pose)`, `loadAssets` |
| `game/city.ts` | tipos de prédio, montagem da cidade, máscara de colisão, `applyCrater` |
| `game/physics.ts` | `launch`, `stepFlight` (passo determinístico), `simulate`, `riderBoxes` |
| `game/ai.ts` | `planComputerShot` por dificuldade |
| `game/engine.ts` | `CapaceteEngine`: turnos, dano, rodadas, partículas, desenho, estado do HUD |
| `game/sound.ts` | `sfx`: efeitos sonoros em WebAudio (arremesso, assobio do voo, explosões, jingles), mute persistido |
| `game/hires.ts` | `scale2x`, `upscaleAll` (sprites em alta, com cache), `blit`, `blitPart`, `SCALE` |
| `styles.css` | tudo prefixado com `.capacete-voador` |

## Como o motor funciona

- **Fases** (`Phase`): `aiming` (humano digitando) → `flying` → `exploding` → (`endTurn` ou
  `roundOver`) → `gameOver`. O computador passa por `thinking` (pensa `THINK_MS`, mostra o tiro por
  `ANNOUNCE_MS`, lança).
- O motor é uma classe TypeScript pura com `update(ms)`, `render(ctx)` e um callback `onHud`
  chamado só quando algo do HUD muda. O React não guarda estado do jogo, só o `HudState`.
- **Determinismo:** `stepFlight` calcula a posição pela fórmula fechada em `t = passo·DT` (não
  acumula velocidade) e o motor avança sempre um número inteiro de passos. A IA chama a mesma
  função via `simulate`. Não quebre isso: se o motor e a IA divergirem, o "difícil acerta em até 3
  tiros" deixa de valer. Mudanças na física vão em `physics.ts` e valem para os dois.
- **Ordem da colisão** em cada ponto do caminho: saiu da tela → sol (só marca) → motoboys
  (cabeça antes da moto; o próprio dono é ignorado até o capacete sair de perto dele) → prédio
  (máscara `city.mask`).
- **Dano:** `damage[i]` vai de 0 a 3. Acerto na cabeça marca `knockedOut[i]` e encerra a rodada.
  Quem leva o golpe perde a rodada, mesmo se o tiro for dele (`winner = outro jogador`).
- **Posição dos motoboys:** `layoutCity` (city.ts) devolve `slots`, os índices dos prédios que recebem
  os jogadores, sorteados a cada rodada dentro de `ZONE_P1`/`ZONE_P2` (ver README).
- **Som:** o motor chama `sfx.*` (sound.ts) nos pontos de `fire`, `update` (voo), `onRiderHit` e fim de
  rodada. `GameScreen` chama `sfx.unlock()` no 1º `pointerdown`/`keydown`; sem isso (ou com mute)
  tudo é no-op. Ao desmontar, `engine.dispose()` para o assobio do voo.
- O nome `city.riders` são as posições (canto superior esquerdo do quadro 40×40) dos dois
  motoboys; o jogador 2 é desenhado espelhado (`facingOf(1) = -1`).

## Visual em alta (campo 640×400, canvas 1280×800)

A lógica roda em 640×400 (posições, colisões, constantes; 1 unidade QBasic = 1 px) e o canvas tem
1280×800: cada pixel lógico vira 2×2 na tela e os PNGs (1×) passam pelo Scale2x:

- `game/hires.ts` faz o Scale2x dos PNGs do jogo (prédios, céu, sol) e só copia os da biblioteca
  (`isNativeHd`), com cache por conjunto de assets; `SCALE` = 2.
- `render()` começa com `ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)` e desenha os sprites com
  `blit(ctx, img, x, y)` (tamanho lógico) ou `blitPart` (recortes, origem em pixels lógicos).
  **Não use `ctx.drawImage(sprite, x, y)` direto num sprite em alta:** ele sai com o dobro do tamanho.
- Posições de quem se move podem usar meio pixel lógico (`Math.round(x * SCALE) / SCALE`), que vira
  um pixel de tela e deixa o movimento mais suave.
- `fillRect` e a fonte de pixels continuam em coordenadas lógicas (saem com 2×2 px de tela).
- **Cidade:** `generateCity` desenha os prédios duas vezes com os mesmos andares sorteados: em alta
  (1280×800, o que aparece) e com os PNGs originais em 640×400, só para tirar a **máscara de
  colisão**. `applyCrater` apaga a máscara em 640×400 e o visual com um círculo em resolução dobrada
  (borda mais redonda). A física e a IA só leem a máscara, então continuam iguais.

## Sprites

- **Motoboys, capacetes e explosões vêm da biblioteca única** (`src/shared/sprites`, HD 2× nativo,
  ver o `README.md` de lá); `game/assets.ts` mapeia as chaves do jogo para `lib/…`:
  `p{1,2}_dano{0,1,2}{,_arremesso,_ko,_grau}` e `p{1,2}_destruida{,_ko}` → `lib/caes/…` (80×80 =
  40×40 lógicos, virados para a direita; use `riderKey()`), `capacete_p{1,2}_{0..3}` →
  `lib/capacete/…` (16×16 = 8×8 lógicos), `explosao_{0,1,2}` → `lib/fx/…`. O `p1` é o mesmo cachorro
  do Cachorro Loko; o jogador 2 é a versão branquinha com moto verde. `isNativeHd(key)` faz o
  `upscaleAll` copiar esses sprites em vez de aplicar Scale2x.
- Sol, vento, prédios, céu e garoa ficam em `assets/` (1×; céu e garoa em 640×400, gerados por
  `cenario_predios.py` com `sky(2)`/`garoa(2)`).
- Se mudar o desenho do motoboy em `tools/pixelart/biblioteca/caes_lado.py`, revise `PILOT_BOX` e
  `MOTO_BOX` (coordenadas lógicas no quadro virado para a direita; no PNG de 80×80, multiplique por 2).
- `assets/sprites/` pode ainda ter `cratera_mascara.png` e outros arquivos sem uso.

## Receitas

- **Mudar quantos acertos a moto aguenta:** `MOTO_HP`. Os sprites cobrem dano 0, 1, 2 e destruída,
  e `riderKey` (assets.ts) trata dano ≥ 3 como destruída: com `MOTO_HP` maior, passe a usar
  `dano >= MOTO_HP` ali e repita o sprite `dano2` nos danos intermediários. Ajuste também
  `PART_NAMES` em `engine.ts` (mensagem de cada acerto) e os 3 quadradinhos fixos (`[0, 1, 2]` e
  `3 - damage`) em `GameScreen.tsx`.
- **Deixar a cabeça mais fácil/difícil de acertar:** `PILOT_BOX`. Com a caixa maior que a atual
  quase todo tiro vindo de cima pega a cabeça e a vida da moto deixa de importar (foi medido).
- **Mudar a IA:** `ai.ts`. A função `survey` testa todos os ângulos 15–88 × velocidades 10–160
  (≈11 mil simulações, ~260 ms com o campo 640×400). Se aumentar os intervalos, fica mais lento; o cálculo roda durante
  a fase `thinking`.
- **Novo tipo de prédio:** adicione em `BUILDING_TYPES` (`city.ts`), gere `topo/andares/base` em
  `assets/predios/<key>/` (andares = tira com 12 variações empilhadas) e liste em `assets.ts`.
  `flat: true` e largura ≥ 36 para poder receber um motoboy.
- **Nova opção de menu:** campo em `Settings` (`types.ts`), valor padrão em `Game.tsx`, controle em
  `Menu.tsx`, uso no `engine.ts`.

## Armadilhas conhecidas

- O `update` limita `ms` a 0–100: o 1º quadro do `requestAnimationFrame` pode vir negativo e uma aba
  em segundo plano pode voltar com um salto enorme.
- `GameScreen` cria o motor dentro do `useEffect` (StrictMode roda duas vezes em desenvolvimento).
- A cratera de destruição pode deixar a moto "flutuando" sobre o buraco: é visual, como no original.
- Não há persistência: placar e nomes somem ao sair do jogo.

## Como verificar

1. `npm run typecheck` na raiz.
2. Jogue no modo treino: 3 acertos na moto do alvo devem destruí-la; um acerto na cabeça encerra a
   rodada.
3. Contra o computador no difícil: ele deve acertar você (moto ou cabeça) em até 3 tiros por rodada.
   No fácil, nunca.
