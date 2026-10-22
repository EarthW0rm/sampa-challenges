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
| `game/ai.worker.ts` | Web Worker: recebe a mesa e o estado, devolve a tacada do computador |
| `game/engine.ts` | `SinucaEngine`: partida, entrada, vez do computador, animações, desenho e HUD |
| `game/constants.ts` | mesa, física, interface e tempos do computador |
| `game/config.ts` | `loadSettings`/`saveSettings` (`sinuca-de-bar:config`) |
| `game/assets.ts` | lista de PNGs, `assetUrl`, `isNativeHd` (bolas), `loadAssets` |
| `game/hires.ts` | `scale2x`, `upscaleAll` (copia as bolas, que já são 2×), `blit`, `SCALE` |
| `game/pixelFont.ts` | fonte 3×5 (sem acentos: o motor passa os textos por `plain()`) |
| `game/sound.ts` | `sfx`: taco, choque, tabela, caçapa, falta, vez, vitória/derrota (WebAudio; mute em `sinuca-de-bar:som`) |
| `game/types.ts` | `Settings`, `HudState` |

Sprites: `tools/pixelart/sinuca_de_bar.py` gera `cenario/mesa.png` e `capa.png` em 1× (Scale2x no
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
  descartadas (nova partida no meio). Sem worker, `chooseShot` roda na thread principal.
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

## Como verificar

1. `npm run typecheck` e `npm run build` (deve sair um `ai.worker-*.js` em `dist/assets/`).
2. Regras e IA headless com esbuild + node: cenários de `resolveShot` (8 antes da hora, branca
   junto com a 8, falta por tocar primeiro na do adversário, grupo na mesa aberta, castigo na
   saída) e partidas `chooseShot` nível 3 × nível 1 alternando quem começa, conferindo que não há
   bolas sobrepostas e que a branca nunca é posta em lugar inválido.
3. Jogue: saída com a branca atrás da linha, mira por toque/arrasto e teclado, bola na mão depois
   de falta, fim pela castigo, nova partida (alterna a saída), tela de ≈390 px.
