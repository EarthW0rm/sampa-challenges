# CLAUDE.md — Fuga da Rocam

Leia antes o `CLAUDE.md` da raiz (CSS escopado em `.fuga-rocam`, assets dentro desta pasta, manifest
leve, StrictMode, `dt` do quadro). As regras (`FR-RN-NN`) e a tabela de parâmetros ficam no
`README.md` desta pasta, que é o manual do jogo: mudou regra ou número, atualize o README e o teste da
regra no mesmo commit.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub; `getRecord: bestRecord` (maior recorde entre os mapas) |
| `Game.tsx` | raiz: carrega os sprites, alterna `TitleScreen` ↔ `GameScreen` pelo mapa escolhido |
| `components/TitleScreen.tsx` | 3 cards de mapa (miniatura, recorde), teclas 1–3, "Como jogar" |
| `components/GameScreen.tsx` | cria o motor no `useEffect` (laço rAF, gancho e2e), teclado/foco, deslize e direcional, HUD, caixas de pausa e de fim |
| `game/constants.ts` | todos os números de equilíbrio (velocidades, turbo, calor, pedidos, itens, captura, `DT_MAX`) |
| `game/engine.ts` | `FugaEngine`: movimento por grade, viaturas, calor/estrelas, pedidos, itens, óleo, garagem, captura, desenho; `QUOTA` e `PERSONAS` no topo |
| `game/maps.ts` | os 3 mapas (`Builder`), tiles, `canEnter(map, classe, tx, ty)`, garagens automáticas (`autoGarages`) |
| `game/nav.ts` | `Nav`: campos de distância (BFS) por classe e alvo, cache limpo a cada ~2 s |
| `game/input.ts` | `Input`: direção guardada (`want`), turbo (teclas + botão), óleo (um por toque) |
| `game/mapArt.ts` | camada estática do mapa (cacheada por mapa) e miniaturas do título |
| `game/assets.ts`, `game/hires.ts`, `game/pixelFont.ts` | sprites (próprios + biblioteca), Scale2x/`blit`, texto em pixel |
| `game/sound.ts` | WebAudio sintetizado (sirene, hélice, eventos); chave `fuga-rocam:som` |
| `game/record.ts` | `fuga-rocam:recorde:<mapa>` e `bestRecord` |
| `game/e2eHook.ts` | gancho dos testes de ponta a ponta (inerte sem a flag da página de teste) |

## Resolução

Lógica 640×400 = grade de 40×25 tiles de 16 px (`W`, `H`, `TILE`); canvas 1280×800 (`SCALE` 2,
`game/hires.ts`). O `render` começa com `setTransform(SCALE, …)` e desenha sprites com `blit()`;
posições de veículo são `tx·TILE + TILE/2 + DX[dir]·off` (meio pixel lógico é permitido).

## Sprites

`tools/pixelart/fuga_rocam.py` gera os PNGs 1× (veículos desenhados virados para a direita e girados
em `r/d/l/u`, 2 quadros cada; helicóptero, itens, pinos) e a capa. Cachorro do título, corações e
capacete do HUD vêm da biblioteca compartilhada (`lib/…`, já HD: `isNativeHd` copia em vez de Scale2x).

## Como o jogo funciona

- **Fases** (`Phase`): `ready` (PRONTO, nada anda até uma direção) → `play` → `caught` (PEGO!,
  `CAUGHT_PAUSE`) → `ready` de novo ou `over`. `paused` guarda a fase anterior (`prevPhase`).
- **Movimento por grade** (`advance`): cada veículo tem `tx, ty, dir, off`; a cada centro de tile chama
  um `choose` (jogador: direção guardada → seguir → parar; viatura: vizinho de menor distância até o
  alvo, sem meia-volta, com um pouco de sorteio). O jogador ainda tem `steerPlayer`: meia-volta
  imediata (só para tile que pode ocupar) e curva antecipada/tardia com `TURN_TOLERANCE`.
- **Viaturas**: `manageQuota` mantém `QUOTA[estrelas]` (nasce uma a cada `SPAWN_INTERVAL`, longe;
  excedente sai). Persona escolhe o alvo (`copTarget`): perseguidor/rápida → última posição conhecida,
  bloqueador → à frente do cachorro, emboscada → pino do pedido. Visão = distância de caminho ≤
  `SIGHT_TILES`; a última posição vista vale `RADIO_MEMORY` s (dobro com 4+ estrelas).
- **Calor**: sobe à vista (`HEAT_SEEN`), cai fora (`HEAT_COOL`) e escondido (`HEAT_COOL_HIDDEN`),
  `+HEAT_DELIVERY` por entrega; estrelas = `1 + min(4, piso(calor / HEAT_PER_STAR))`.
- **Pedidos**: `newJob` sorteia coleta e entrega por distância de caminho; o tipo sai de
  `weightedKind` (liberado por `JOB_UNLOCK`). Pontos na entrega: `POINTS × (1 + STAR_POINTS ×
  (estrelas − 1))` + bônus do urgente.
- **HUD**: o motor chama `onHud(HudState)` só quando o JSON muda (ou com `force`); a tela é React.
- **Recorde**: `commitRecord` no fim de jogo, em `restart` e no `dispose` (sair no meio grava).

## Receitas

- **Mudar a dificuldade**: velocidades (`PLAYER_SPEED`, `CAR_SPEED`, `MOTO_SPEED`, `COP_STAR_BONUS`),
  `QUOTA`, `SIGHT_TILES`/`RADIO_MEMORY`, ritmo do calor. Atualize a tabela do README e rode o piloto
  (`npm run test:e2e:longa -- e2e/fuga-rocam/`) para ver se ainda dá para chegar a 3 estrelas.
- **Mapa novo ou alterado**: em `maps.ts`, use o `Builder` (ruas `h`/`v`, fechamentos com `'#'`,
  becos `'b'`, praças `'o'`) e `autoGarages`. Confira que é conexo para as três classes e acrescente o
  mapa em `MAPS` (o título e o recorde por mapa vêm dali; `bestRecord` lista os ids).
- **Tipo de pedido ou item novo**: tipo em `types.ts`, pontos em `POINTS`, peso em `weightedKind`/
  `updateItems`, sprite em `assets.ts`, regra numerada no README e teste.

## Armadilhas conhecidas

- O passo do motor é limitado a `DT_MAX`; o laço da tela já corta em 0,1 s (aba em segundo plano).
- Motor criado dentro do `useEffect` e descartado no cleanup (StrictMode cria dois): o `dispose` grava
  o recorde e silencia o som.
- A direção guardada (`Input.want`) é "pegajosa": pedir uma direção que não existe agora faz a moto
  virar na primeira esquina em que ela existir. A meia-volta não pode entrar em tile proibido (já foi
  bug: a garagem trancada era atravessada pela meia-volta e o cachorro se escondia para sempre).
- `checkRecord` marca o novo recorde na entrega **e** na pizza.
- Nada de `Math.random` no motor: ele usa `mulberry32(seed)`. O som tem gerador próprio para o ruído
  (não consumir o `Math.random` da página, que os testes semeiam).

## Como verificar

1. `npm run typecheck`, `npm run typecheck:e2e` e `npm run build` na raiz.
2. `npm run test:e2e -- e2e/fuga-rocam/` (desktop e 390 px) e `npm run test:e2e:cobertura -- --jogo fuga-rocam`.
3. Mudou equilíbrio? `caffeinate -dimsu npm run test:e2e:longa -- e2e/fuga-rocam/`.
4. Abra `#/jogos/fuga-rocam`, jogue os 3 mapas, volte ao hub pela barra e confira o recorde no card.

## Testes de ponta a ponta

Base comum em `e2e/support/` (guia em `e2e/README.md`); a camada deste jogo fica em `e2e/fuga-rocam/`.

- **Gancho** (`game/e2eHook.ts`): `exposeFuga(engine)` é chamado no efeito que cria o motor
  (`GameScreen`) e o `dispose` no cleanup. Publica `window.__e2e = { id: 'fuga-rocam', api }` só quando a
  página de teste liga a flag (`src/shared/e2e/hook.ts`). A `api`:
  - `state()` = `FugaEngine.e2eState()`: o `snapshot()` do motor mais mapa, fase, `want`, turbo
    (tanque, trava, ligado), invulnerabilidade, garagem (`hidden`, `hideT`, `garageCd`), recorde,
    mensagem, tempo, pedido (tipo, pinos, prazo), itens (tipo, tile, vida), manchas de óleo,
    viaturas (classe, persona, tile, `off`, visível, parada, saindo, vendo, distância de caminho) e
    helicóptero;
  - `targets()` = `e2eTargets()`: centro do jogador, dos pinos, dos itens e das garagens (lógico 640×400);
  - `tiles()`: o mapa como texto;
  - `prepare` (sobre o `cheat` do motor; só para pré-condição rara, comentada no teste): `heat(v)`,
    `item(tipo, tx, ty)`, `cop(classe, tx, ty, dir)`, `jobKind(tipo)`, `lives(n)`.
- **Determinismo**: sob a flag, a semente do motor vem de `e2eSeed()` (o `Math.random` semeado pelo
  teste); fora dela continua `Date.now() ^ Math.random()`. O relógio dos testes controla quadros e
  `performance.now`/`Date.now`; só os últimos bits do `dt` variam entre cargas (a base do relógio é a
  hora real), por isso a comparação de estado arredonda em 1e-6.
- **Página** (`e2e/fuga-rocam/support/page.ts`): `FugaPage` estende `BaseGamePage` (`logical` 640×400):
  `open`, `chooseMap` (clique ou tecla), `start`, `turn`, `turbo`, `oil`, `dpad`, `swipe` e `holdTouch`
  (toque real via CDP), `goToTile` (dirige pelas setas usando `support/route.ts`, opcionalmente
  desviando de viaturas/itens), `pickup`/`drop`/`deliver`, `waitCaught`. O `waitHook` daqui usa polling
  por tempo (o da base usa `raf`, que não anda com o relógio manual).
- **Rota** (`support/route.ts`): Dijkstra na grade com os mapas do próprio jogo; aperta a seta só fora
  da folga de curva tardia e pula os quadros de reta até perto da próxima curva.
- **Cabeçalho das evidências** (`support/describe.ts`): partida, procurado, pedido, jogador, recursos,
  itens e viaturas (spec RN-33).
- **Piloto** (`support/pilot.ts` + `piloto.spec.ts`, projeto `longa`): vai ao pino do pedido desviando
  das viaturas (custo extra perto delas), esconde na garagem com 4+ estrelas, solta óleo com viatura
  colada atrás e liga o turbo com viatura perto (nunca com frágil). Perto do pino anda quadro a quadro
  para recalcular cada entrega pelo estado do quadro anterior. Ao fim confere placar exibido =
  recalculado, capturas = 3 + vidas ganhas, ≥ 3 estrelas, recorde gravado e card do hub; a mesma
  semente repete a partida (`partida-<n>.json` idênticos). Teto: 20 min de jogo por mapa.

```bash
npm run test:e2e -- e2e/fuga-rocam/          # dentro de um worktree, filtre por e2e/fuga-rocam/
npm run test:e2e -- -g "FR-RN-22"
caffeinate -dimsu npm run test:e2e:longa -- e2e/fuga-rocam/
```
