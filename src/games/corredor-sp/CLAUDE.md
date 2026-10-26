# CLAUDE.md — Corredor SP

Leia antes o `CLAUDE.md` da raiz (regras do hub: CSS escopado, assets na pasta, manifest leve).
O `README.md` desta pasta é o **manual**: regras numeradas `CS-RN-NN`, tabelas de modelos, itens,
trânsito e todos os parâmetros. Mudou regra ou número? Atualize a seção do manual e o teste que cita a
regra no mesmo commit.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub (capa `assets/capa.png`, `getRecord: bestRecord`) |
| `Game.tsx` | raiz: carrega os assets, guarda a escolha (`corredor-sp:escolha`), alterna `SetupScreen` / `RaceScreen` |
| `components/SetupScreen.tsx` | pista, cachorro, categoria, modelo, cor e prévia da moto |
| `components/RaceScreen.tsx` | canvas + laço, teclado, botões de toque, pausa, fim de turno |
| `game/constants.ts` | câmera, pista, faixas, jogador, grau, itens, progressão |
| `game/data.ts` | pistas, raças, categorias, modelos, cores, lanternas, tamanho/velocidade/remoção por tipo de veículo |
| `game/road.ts` | montagem da pista em segmentos (curvas e subidas) e cenário fixo de cada avenida |
| `game/traffic.ts` | `Vehicle`, seguir o da frente, troca de faixa com seta/sem seta, motos, ônibus |
| `game/engine.ts` | `CorredorEngine`: física da moto, spawns, colisões, itens, capacetes, clima, desenho e HUD |
| `game/assets.ts` | `loadAssets` (também carrega os cachorros da biblioteca `src/shared/sprites` e cria os apelidos `motos/…`), `assetUrl`, `recolored` (troca da cor-chave magenta das motos), `isNativeHd` |
| `game/hires.ts` | `hires()` (Scale2x dos PNGs do jogo; os `motos/…` da biblioteca já são 2× e só são copiados; com cache), `mip()` (versões reduzidas para longe), `warmUp()` |
| `game/pixelFont.ts` | fonte 3×5 completa para o HUD no canvas |
| `game/input.ts` | teclado (setas/WASD/Espaço/X/Enter) e toque; `takeThrow()` consome o arremesso |
| `game/sound.ts` | `sfx`: sons em WebAudio (sem arquivos). Contínuos (`drive()` motor/terra/garoa/turbo, `siren()`) + eventos (itens, capacete, buraco, batida, ultrapassagem, contagem, fim de turno); `unlock()` no 1º gesto, `silence()`, mute persistido em `corredor-sp:som` |
| `game/record.ts` | recorde por pista (`corredor-sp:recorde:<pista>`) |
| `game/e2eHook.ts` | gancho dos testes de ponta a ponta (`exposeCorredor`): só existe com a flag de teste |

## Resolução

`W × H` = 640×400 (lógica e canvas iguais; é o tamanho lógico usado pelos testes). `K = W / 320`
converte medidas "de projeto" (as do jogo antigo em 320×200) para a tela. O HUD é desenhado em 320×200
dentro de `ctx.scale(K, K)` (`drawHudLayer`); qualquer novo desenho fora do HUD em pixels fixos deve
multiplicar por `K`. O CSS amplia o canvas com `image-rendering: pixelated`.

## Como o jogo funciona

`Game.tsx` carrega os assets e lê a escolha salva (`loadChoice` valida **todos** os campos; inválida →
padrão). `RaceScreen` cria o `CorredorEngine` dentro do `useEffect` (StrictMode: o 1º é descartado no
cleanup), roda o laço `update(dt)` + `render(ctx)` e liga teclado, toque, pausa por foco e os diálogos.
O motor emite `HudState` só quando muda a fase, a pausa ou (no fim) os pontos. Fases: `countdown` (3 s,
nada anda) → `racing` → `over` (o diálogo de fim aparece 1,5 s depois, por `setTimeout`).

### Pseudo-3D

Baseado no "Javascript Racer" (Jake Gordon), adaptado para pixel art:

- A pista é uma lista de **segmentos** de `SEG_LEN` unidades, cada um com `curve` e alturas
  `y1/y2`. `road.ts` monta os trechos com `road(entrada, miolo, saída, curva, subida)` e fecha o
  laço voltando à altura zero. A pista se repete; posições são **z absolutos** (sempre crescendo) e
  `segmentAt()` usa o módulo.
- A câmera fica em `pos` e o jogador em `pos + PLAYER_Z`, sempre no centro da tela; quem se mexe é
  a pista (`camX = player.x · ROAD_W`). A curva acumula `x += dx; dx += curve` a cada segmento.
- **A pista é desenhada por linhas de 1 px** (`fillRect`), da frente para trás, com `maxy` para
  esconder o que fica atrás de uma lombada. Não troque por polígonos: o canvas suaviza as bordas e
  some o visual de pixel art.
- **Objetos** (cenário, veículos, itens, buracos, capacetes) são desenhados de trás para frente.
  Cada um vai para o "balde" do segmento em que está; a escala vem da projeção do segmento e o
  recorte (`clip`) esconde a parte que fica atrás do relevo. Um sprite sai no tamanho nativo na
  distância do jogador (`SPRITE_UNITS`).
- **Sprites:** os PNGs do jogo são 1× e os cachorros/motos da biblioteca são 2× nativos. O motor desenha `hires(key)` (Scale2x, `SPRITE_SCALE` = 2) e escolhe
  o nível de `mip(key, larguraNaTela)`. `sprite()` devolve `f` = pixels de tela **por pixel do PNG
  original**, então as coordenadas de `LIGHTS` e do poste continuam no original. Não use
  `this.assets[key]` direto na corrida (sai na metade do tamanho); no HUD, sim.
- **Névoa:** `fogAt(n)` dá a névoa do segmento `n` (0 até `FOG_START`, depois sobe até 0,85). A pista
  mistura as cores com a cor do horizonte (`fogRgb`, vinda do céu) e os objetos usam `globalAlpha`.
  `drawn[].alpha` guarda isso para as luzes, que somam +0,3/+0,4 e aparecem antes do carro.
- **Tamanho mínimo:** veículos, itens e perigos passam `minW` para `sprite()`. Cenário não, para não
  distorcer a perspectiva.
- Ordem do quadro: céu e horizonte → pista → objetos → escurecimento da noite e luzes → setas e
  luzes de freio → jogador → garoa → HUD.

### Trânsito

- Veículos de quatro rodas têm `lane` (0–3) e ficam no centro dela; motos têm `lane = −1` e `x`
  livre (corredores e faixas). A contramão tem velocidade negativa.
- Troca de faixa: `normal` → `signal` (seta pelo tempo da tabela) → `moving` (interpolação
  suave) → `normal`. Sem seta pula direto para `moving` com 0,7 s.
- As lanternas de cada sprite estão em `LIGHTS` (`data.ts`), em pixels do sprite. Seta, pisca-alerta,
  freio e lanternas noturnas são desenhados por cima, com a mesma escala do sprite. Se redesenhar um
  veículo, atualize `LIGHTS`.
- Colisão: |dz| < (comprimento do veículo + `PLAYER_LEN`)/2 e |dx| < meia largura + `PLAYER_HALF_W`.
  Motos que vêm por trás não batem (desviam). A meia largura do veículo é 72% da desenhada; foi isso
  que tornou o corredor jogável (com 86% quase toda passagem entre dois carros batia).
- **Faixa azul mais larga:** a faixa 0 fica em −0,85 (encostada na borda) e a faixa azul em −0,55,
  para sobrar 0,35 entre um carro na faixa 0 e outro na 1. Ao mexer em `LANES`, mantenha esse vão
  maior que 2 × `PLAYER_HALF_W` + folga, e a pintura (`BLUE_HALF`) dentro dele.
- Ultrapassagem = um veículo passou de "à frente" para "atrás" desde o quadro anterior (`prevDz`).

## Sprites

- Motos: vêm da **biblioteca única de sprites** (`src/shared/sprites/assets/caes_costas/<raça>_<cat>_<quadro>.png`,
  80×88 reais = 40×44 lógicos; `queda` é 96×88), gerados por `tools/pixelart/biblioteca/caes_costas.py`.
  `loadAssets` os expõe com as chaves `motos/<raça>_<cat>_<quadro>` e eles pulam o Scale2x
  (`isNativeHd`). Desenhadas com
  magenta `#ff00ff` / `#b000b0` / `#ff9cff` que `recolored()` troca pela cor escolhida (com cache).
  As motos do trânsito usam os mesmos sprites com raça, categoria e cor sorteadas.
- Trânsito (vista de trás), cenário, itens e horizontes (dia e noite por pista) vêm de
  `tools/pixelart/corredor_sp.py` (as motos desse script não são mais usadas). A capa (`capa.png`) é uma cena montada pelo script de prévia.

## Receitas

- **Equilíbrio:** densidade (rampa `TRAFFIC_*` em `constants.ts`) e perigos por nível em `updateSpawns` (`engine.ts`); velocidade do
  trânsito em `VEHICLE_SPEED` (`data.ts`) e `trafficFactor`; fechadas em `updateTraffic`. Atualize o
  README.
- **Nova pista:** acrescente o id em `TrackId` e `TRACKS` (`data.ts`), o traçado em `layout()` e o
  cenário em `decorate()` (`road.ts`), os horizontes `horizonte/<id>_{dia,noite}.png` e a placa.
- **Novo veículo:** tipo em `VehicleKind`, entradas em `LIGHTS`, `VEHICLE_LENGTH`,
  `VEHICLE_SPEED`, `REMOVABLE`, peso nas pistas, sprite em `assets/transito/` e, se precisar,
  regra própria em `traffic.ts`.
- **Novo item:** `ItemKind`, `ITEM_WEIGHTS` e `collect()` em `engine.ts`, sprite 16×16 em
  `assets/itens/`.

## Som

- O motor chama `sfx.*` nos pontos de evento (`collect`, `crash`, `endRace`, `updateHelmets`, `checkCollisions`,
  ultrapassagem em `updateTraffic`, nível, garoa) e `audio()` todo quadro (contagem e corrida) para o
  motor/sirene. Tom do motor = `48 + 95·(velocidade/vmax atual)` Hz (+ grau/turbo), sempre grave e macio; ao chegar a 98,5% da velocidade máxima acelerando (fora da terra) `drive({limiter})` liga o **corte de giro** (LFO quadrado ~11 Hz que abre/fecha o ganho e derruba o tom); a sirene toca quando há
  ambulância a menos de 22000 unidades (volume cai com a distância).
- `RaceScreen` chama `sfx.unlock()` no 1º `pointerdown`/`keydown` e tem o botão "Som"; `engine.dispose()`
  e `setPaused(true)` chamam `sfx.silence()`. Sem gesto ou com mute, tudo é no-op.

## Armadilhas conhecidas

- `dt` limitado a 0–0,05 s (o 1º quadro do `requestAnimationFrame` pode vir negativo).
- Na contagem regressiva o trânsito fica parado, senão a pista começa vazia.
- `recolored()` usa `getImageData`: os PNGs precisam vir da mesma origem (é o caso com o Vite).
- Texto do HUD só usa os caracteres de `pixelFont.ts`; acentos viram a letra sem acento e
  caracteres desconhecidos viram espaço.
- Enter e Espaço são teclas do jogo com o padrão cancelado: não acionam os botões em foco dos diálogos.
- Escolha salva com um cachorro/pista/cor desconhecido derrubava a prévia da moto (`recolored` de chave
  inexistente): por isso `loadChoice` valida todos os campos.
- Botões de toque a 390 px: os de ação quebram em duas linhas (`flex-wrap`); sem isso o CAPACETE ficava
  fora da tela.

## Como verificar

1. `npm run typecheck` na raiz.
2. Jogue as três pistas: confira trânsito, setas, faixa azul, grau, capacete (remove carro, quica no
   ônibus), noite, garoa, batida com volta piscando e o fim de turno com recorde.
3. No celular (ou com emulação de toque): a moto acelera sozinha e os botões ficam abaixo da pista.
4. Para mexer no equilíbrio, use um piloto automático: crie o motor com um `Input` controlado por
   código, chame `update(1/60)` em laço e escolha a posição lateral com mais espaço livre à frente.

## Testes de ponta a ponta

Base comum em `e2e/support/` (guia em `e2e/README.md`); a camada deste jogo fica em `e2e/corredor-sp/`.
Cobertura por arquivo e a tabela regra → teste na seção "Testes" do `README.md`.

- **Gancho** (`game/e2eHook.ts`): `exposeCorredor(engine, canvas)` é chamado no efeito do
  `RaceScreen` que cria o motor e o `dispose` no cleanup. Publica `window.__e2e = { id: 'corredor-sp', api }`
  só com a flag de teste (`src/shared/e2e/hook.ts`); na tela de escolha não há gancho (não há motor).
  - `state()` = `engine.e2eState()`: fase, pausa, contagem, pista, modelo, tempo, pontos, metros, pacotes,
    nível, recorde, ultrapassagens, moto (x, vx, velocidade/km/h, vidas, capacetes, grau, grau ligado,
    caído, invulnerável, turbo, balanço), entradas vistas pelo motor (inclusive `autoAccel`), garoa,
    escuridão, veículos/itens/perigos/capacetes em voo com `dz` relativo à moto, veículos surgidos por tipo,
    faixa e textos curtos.
  - `targets()`: retângulos (página) do canvas e dos botões de toque (`null` quando escondidos).
  - `prepare` (só pré-condição rara, comentada no teste): `spawn(tipo, {lane|x}, dz, kmh?)`,
    `thing(item|buraco|cone, x, dz)`, `calm(on)` (pista vazia e sem surgimentos: `e2eCalm` faz o
    `updateSpawns` sair cedo), `time(s)`, `level(n)`, `toggleRain()`, `lives(n)`. São métodos `e2e*` do
    motor; nenhum campo virou público.
- **Página** (`e2e/corredor-sp/support/page.ts`): `CorredorPage` (lógico 640×400, som `off`) com
  `open`, `choose`, `start`, `race(escolha, { calm })`, `accelerate`, `brake`, `steer`, `grau`, `helmet`,
  `holdKeys`, `steerTo`, `drive` (↑ segurado corrigindo a posição lateral, com condição de parada) e
  `touchBtn` (eventos de toque reais via CDP). `support/physics.ts` refaz as contas de aceleração e
  direção do motor para comparar.
- **Cabeçalho das evidências** (`support/describe.ts`): pista, modelo, fase, pontos, metros, segundos,
  multiplicador, vidas, nível, km/h, x e faixa/corredor/faixa azul/terra, grau, capacetes, turbo,
  caído/invulnerável, garoa (spec RN-32).
- **Determinismo**: relógio dos testes (quadros de 1/60 s, `performance.now`/`Date.now` virtuais) e
  `Math.random` semeado; o jogo não usa outra fonte de sorteio. Diálogo de fim por `setTimeout` real
  (os testes esperam com `expect`).
- **Piloto** (`support/pilot.ts` + `piloto.spec.ts`, projeto `longa`): ↑ segurado o turno inteiro; a
  cada 6 quadros escolhe entre as 4 faixas e os 3 corredores a posição com mais pista livre à frente
  (9 000 unidades), penalizando atravessar quem está ao lado e premiando item na linha; freia quando
  tudo fecha perto, arremessa capacete em bloqueio removível a menos de 5 000 e dá grau na faixa azul
  livre. Um turno por pista (sementes 23, 31, 47), teto de 15 min de jogo; confere pontos = fórmula,
  diálogo, recorde gravado, card da pista e do hub; na 23 de Maio joga duas vezes com a mesma semente e
  compara os `partida-<n>.json`.

```bash
npm run test:e2e -- e2e/corredor-sp/
npm run test:e2e -- --project=celular e2e/corredor-sp/
caffeinate -dimsu npm run test:e2e:longa -- e2e/corredor-sp/
npm run test:e2e:cobertura -- --jogo corredor-sp
```

Num worktree (`.worktrees/<nome>/`) use `E2E_PORT` próprio e filtre por `e2e/corredor-sp/` (o filtro
`corredor-sp/` casa com o caminho do worktree e roda a suíte inteira).
