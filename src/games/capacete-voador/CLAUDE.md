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
| `game/constants.ts` | todos os números de física, áreas de acerto, limites, tempos do motor (`THINK_MS`, `ANNOUNCE_MS`, `ROUND_OVER_MS`, `EXPLOSION_FRAME_MS`) e zonas da cidade (`ZONE_P1/P2`, `MIN_RIDER_GAP`, `MAX_NEIGHBOR_RISE`) |
| `game/assets.ts` | lista de PNGs, `assetUrl`, `riderKey(jogador, dano, pose)`, `loadAssets` |
| `game/city.ts` | tipos de prédio, montagem da cidade, máscara de colisão, `applyCrater` |
| `game/physics.ts` | `launch`, `stepFlight` (passo determinístico), `simulate`, `riderBoxes` |
| `game/ai.ts` | `planComputerShot` por dificuldade |
| `game/engine.ts` | `CapaceteEngine`: turnos, dano, rodadas, partículas, desenho, estado do HUD |
| `game/sound.ts` | `sfx`: efeitos sonoros em WebAudio (arremesso, assobio do voo, explosões, jingles), mute persistido |
| `game/hires.ts` | `scale2x`, `upscaleAll` (sprites em alta, com cache), `blit`, `blitPart`, `SCALE` |
| `game/e2eHook.ts` | gancho dos testes de ponta a ponta (`window.__e2e`), inerte sem a flag da página de teste |
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

## Resolução e visual em alta (campo 640×400, canvas 1280×800)

A lógica roda em 640×400 (posições, colisões, constantes; 1 unidade de física = 1 px) e o canvas tem
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
- Não há persistência: placar e nomes somem ao sair do jogo (só `capacete-voador:som` é gravado).
- `game/constants.ts` não pode importar nada com DOM ou `import.meta.glob`: os testes (Node) importam
  dele os números esperados. Por isso os tempos do motor e as zonas da cidade moram lá, não em
  `engine.ts`/`city.ts` (que puxam `assets.ts`).
- Os campos numéricos do `AimForm` e da gravidade usam a validação nativa do navegador (`min`, `max`,
  `step`): fora do limite o envio é barrado antes do `onSubmit`. Ângulo vazio vira 0 (manual, CV-RN-10).

## Como verificar

1. `npm run typecheck`, `npm run typecheck:e2e` e `npm run test:e2e -- capacete-voador/` na raiz.
2. Jogue no modo treino: 3 acertos na moto do alvo devem destruí-la; um acerto na cabeça encerra a
   rodada.
3. Contra o computador no difícil: ele deve acertar você (moto ou cabeça) em até 3 tiros por rodada.
   No fácil, nunca.

## Testes de ponta a ponta

Base comum em `e2e/support/` (guia em `e2e/README.md`); a camada deste jogo fica em
`e2e/capacete-voador/`. Manual com as regras `CV-RN-NN` e a tabela regra → teste: `README.md`, seção 12.

- **Gancho** (`game/e2eHook.ts`): `exposeCapacete(engine)` é chamado no efeito do `GameScreen` que cria
  o motor e o `dispose` no cleanup. Publica `window.__e2e = { id: 'capacete-voador', api }` só com a flag
  da página de teste (`src/shared/e2e/hook.ts`). Só existe durante a partida (no menu não há gancho).
  - `state()`: retrato de `CapaceteEngine.e2eState()` — opções (modo, dificuldade, nomes, pontos,
    gravidade, garoa), fase, vez, quem começa, rodada, placar, vento, dano, nocaute, vencedor da rodada,
    mensagem, tiro do computador e quantos ele deu na rodada, últimos tiros, treino (tiros/acertos),
    susto do sol, `shotsFired`, `outcomes` (registro do fim de cada voo: tiro, rodada, quem, tipo,
    motoboy atingido, ponto, sol), capacete em voo (`x0`, `vx`, `vy`, `step`…), explosão, motoboys e
    prédios (chave, x, largura, altura, telhado reto, MASP, `roof`).
  - `targets()`: cabeça, moto e ponto de lançamento de cada motoboy (pixels lógicos) e os seletores do
    formulário de cada lado.
  - `simulateShot(ângulo, velocidade, jogador?)`: roda `launch` + `stepFlight` (a mesma física do jogo e
    da IA) sobre a máscara atual, sem disparar nem mudar nada; devolve tipo, motoboy, ponto, passos, sol e
    a menor distância ao adversário. Os testes e o piloto acham tiros de acerto conhecidos com ele.
  - `solid(x, y)`: o pixel lógico é prédio na máscara (crateras).
  - `prepare.wind(v)` e `prepare.city(semente)`: só para pré-condições raras (vento conhecido, cidade
    com MASP para cavar até o chão), sempre comentadas no teste.
- **Página** (`e2e/capacete-voador/support/page.ts`, `CapacetePage`): `cfg.logical` 640×400; gestos
  `menu(opções)`, `start()`, `play()`, `aim(a, v, jogador)`, `fire('enter' | 'botao')`, `waitShot()`,
  `shoot()`, `waitAim()`, `waitRound()`, `restart()`, `backToMenu()`, `passTurn()`; busca
  `findShot(...)`/`findShotOrRestart(...)` (grade inteira numa chamada do navegador; sem tiro na cidade,
  clica em **Reiniciar** para sortear outra).
- **Cabeçalho das evidências** (`support/describe.ts`): modo, rodada/fase, placar (ou tiros/acertos),
  vez, vento, mira digitada (e o tiro do computador), vida das motos, capacete em voo.
- **Determinismo**: o relógio dos testes controla quadros, `performance.now`/`Date.now` e a semente do
  `Math.random`; a cidade, o vento e a IA (que roda na página) seguem a semente. O voo anda em passos
  inteiros (2 por quadro), então mesma semente + mesmos gestos = mesma partida.
- **Piloto** (`support/pilot.ts` + `piloto.spec.ts`, projeto `longa`): na vez de um humano varre ângulos
  15–88 × velocidades 10–160 com `simulateShot`, escolhe um tiro que acerte o adversário (o mais perto
  de 45°) ou, sem caminho, o que passa mais perto (abre cratera), e executa pela tela: preenche os dois
  campos e aperta Enter. Joga 2 jogadores (piloto dos dois lados), contra o computador fácil, médio e
  difícil, e treino (3 rodadas). Ao fim confere placar exibido = recalculado pelos `outcomes`, vencedor
  no diálogo, card do hub sem recorde e console limpo; a mesma semente 2 vezes dá o mesmo
  `partida-<n>.json`. Teto de 15 min de jogo por partida.

```bash
npm run test:e2e -- capacete-voador/
npm run test:e2e -- --project=celular capacete-voador/
caffeinate -dimsu npm run test:e2e:longa -- capacete-voador/
npm run test:e2e:cobertura -- --jogo capacete-voador
```

Com outra cópia do repositório rodando ao mesmo tempo, use `E2E_PORT=<porta>` (veja
`e2e/playwright.config.ts`).
