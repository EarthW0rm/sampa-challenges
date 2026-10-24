# CLAUDE.md — Pastel de Feira

Leia antes o `CLAUDE.md` da raiz (CSS escopado em `.pastel-de-feira`, assets dentro desta pasta,
manifest leve). Regras e parâmetros: `README.md` desta pasta. Spec, plano e tarefas:
`docs/specs/pastel-de-feira/` (os diagramas C4 e de sequência estão em `plan.md`, em PlantUML).

## Visual em alta e resolução (exceção à regra 7 da raiz)

O jogo tem **lógica e canvas em 640×480** (`W`, `H` em `game/constants.ts`); o canvas é 1280×960
(`SCALE` = 2) porque a barraca cheia mais o painel retrátil não cabem em 320×200. O `render` começa com
`ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)` e `imageSmoothingEnabled = false`. Sprites do jogo (`assets/`)
são 1× e passam por `scale2x` (`game/art.ts`); sprites da biblioteca (`caes_pe`) já são 2× nativos e são
desenhados com `blitFeet` (largura do PNG ÷ 2). Nunca `ctx.drawImage(spriteEmAlta, x, y)` sem tamanho.

## Arquitetura

| Camada | Pasta | Regra |
|---|---|---|
| Simulação do dia | `game/sim/` | TypeScript puro, determinístico: passo fixo 1/60 s, semente (`game/rng.ts`, `fork(label)`), entrada só por `Command` (`game/types.ts`) |
| Campanha | `game/campaign/` | imutável e serializável: ações devolvem `{ ok, campaign }` ou `{ ok: false, motivo }`; `closeDay` fecha o dia; `save.ts` versiona e valida o save |
| Catálogos | `game/data/` | receitas, insumos, equipamentos, equipe, eventos, desafios, escritório |
| Apresentação do dia | `game/render/`, `game/input.ts`, `game/ui.ts` | lê o estado da simulação; só `UiState` é da apresentação |
| Telas | `Game.tsx`, `components/` | máquina de telas (título, nova, preparo, dia, fechamento, fim); Preparo e menus em React DOM |
| Sem tela | `sim/` | cenários, replay, jogador automático, robôs e relatório (não entram no bundle) |

Fluxo: `Campaign` → `toDayConfig` → `DaySim(config, seed)` → `DayResult` → `closeDay` → `Campaign`.
`DaySim.step()` roda: comandos, pasteleiro, equipe, fritura, moenda, limpeza, clientes, mesas, delivery,
encomendas, mundo (eventos) e automação. O tutorial (`game/tutorial.ts`) só observa o estado e liga
`DaySim.setHold` (relógio parado, interação livre).

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card do hub (capa, recorde via `loadHubRecord`) |
| `game/constants.ts` | números de equilíbrio (cita a RN de cada bloco) |
| `game/assets.ts`, `game/art.ts` | carga, recolor dos cachorros (cores-chave magenta) e cache; aparência por `aparenciaDe(seed, id)`, sem usar o `rng` das regras |
| `game/sim/day.ts` | `DaySim`: `step`, `dispatch`, `setHold`, `startLog`, `result` |
| `game/sim/state.ts` | `DayState` e `createState` |
| `game/sim/customers.ts` | chegadas, perfis, pedidos, paciência, trocas de sabor |
| `game/sim/stations/*` | bancada, tacho, moenda, balcão, mesas, estufa |
| `game/sim/staff.ts` | equipe: posições, prioridades, energia, descanso |
| `game/campaign/closing.ts` | balanço do dia, meta, falência, modo livre |
| `game/campaign/shop.ts` | ofertas de compra (a UI e os robôs usam a mesma lista) |
| `game/sound.ts` | WebAudio sintetizado; `pastel-de-feira:som` e `:musica` |
| `game/unlocks.ts` | balões de desbloqueio (`pastel-de-feira:visto`) |
| `sim/run.ts` | `--scenario`, `--replay`, `--bots`, `--list` |
| `sim/scenarios/*` | um grupo por conjunto de RN (262 cenários) |
| `sim/player.ts`, `sim/bots.ts`, `sim/report.ts` | jogador automático e robôs de calibração |

Arte: `tools/pixelart/pastel_de_feira.py` (cenário, pisos, equipamentos, pastéis, ícones, capa) e
`tools/pixelart/biblioteca/caes_pe.py` (cachorros de pé, compartilhados). Nunca edite PNG à mão.

## Armadilhas conhecidas

- A simulação não pode usar `Math.random`, `Date` nem o relógio do navegador: só o `Rng` semeado. Aparência e som ficam fora.
- Todo comando de gesto leva `g` (id): o mesmo id é processado uma vez (toque duplo).
- `game/assets.ts` importa `shared/sprites` e `game/art.ts` de forma dinâmica: `import.meta.glob` quebra a simulação em node.
- Mudou o formato do save? Aumente a versão em `save.ts` e escreva a migração.
- Mudou um valor (P)? Rode `--bots all --seeds 50` e atualize `docs/specs/pastel-de-feira/calibracao.md` e a tabela do `README.md`.
- O primeiro `dt` do `requestAnimationFrame` pode ser negativo: o laço limita com `Math.max(0, Math.min(dt, MAX_FRAME_DT))`.
- StrictMode roda efeitos duas vezes: o `DaySim` nasce dentro do `useEffect` e o cleanup remove listeners e cancela o `requestAnimationFrame`.

## Como verificar

1. `npm run typecheck && npm run build`.
2. `node /tmp/pf-sim.mjs --scenario all` (esbuild de `sim/run.ts`, veja o `README.md`): todos os cenários devem passar.
3. Replay: grave um dia (`startLog` + `recordReplay`), rode `--replay` duas vezes: o hash é idêntico.
4. `--bots all --seeds 50`: `solo` e `equilibrado` passam; `armadilha` e `brinde-max` estão pendentes (ver `calibracao.md`).
5. Navegador: `#/jogos/pastel-de-feira` em desktop e a ≈ 390 px; a barra "← Sampa Challenges" volta ao hub.
