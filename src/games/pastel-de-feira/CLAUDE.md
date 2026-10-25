# CLAUDE.md — Pastel de Feira

Leia antes o `CLAUDE.md` da raiz (CSS escopado em `.pastel-de-feira`, assets dentro desta pasta,
manifest leve). Regras e parâmetros: `README.md` desta pasta. Spec, plano e tarefas:
`docs/specs/pastel-de-feira/` (os diagramas C4 e de sequência estão em `plan.md`, em PlantUML).

## README é o manual do jogo (obrigatório)

O [`README.md`](./README.md) desta pasta é o **manual completo** do jogo: como jogar, controles, todas
as regras com os valores atuais, campanha, parâmetros, arquitetura, como contribuir e como testar.
**Toda alteração de regra ou de mecânica — adição, mudança ou remoção — atualiza o README no mesmo
commit/PR**, além da spec (`docs/specs/pastel-de-feira/spec.md`). Vale também para valor (P),
preço, catálogo (receita, insumo, equipamento, evento, desafio), controle, tela, desbloqueio e
mensagem do fechamento. Mudança sem README atualizado está incompleta.

## Visual em alta e resolução (exceção à regra 7 da raiz)

O jogo tem **lógica e canvas em 640×480** (`W`, `H` em `game/constants.ts`); o canvas é 1280×960
(`SCALE` = 2) porque a barraca cheia mais o painel retrátil não cabem em 320×200. O `render` começa com
`ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)` e `imageSmoothingEnabled = false`. Sprites do jogo (`assets/`)
são 1× e passam por `scale2x` (`game/art.ts`); sprites da biblioteca (`caes_pe`) já são 2× nativos e são
desenhados com `blitFeet` (largura do PNG ÷ 2). Nunca `ctx.drawImage(spriteEmAlta, x, y)` sem tamanho.

Ajudantes de desenho (`game/render/draw.ts`): `drawArt` (sprite no tamanho lógico), `drawThree` (peça
3-slice `<nome>_esq|_meio|_dir`: bordas de 8 px — 10 no tacho —, meio de 16 px repetido até a largura),
`drawNine` (9-slice esticado: cantos de 8 em `ui/moldura`, 4 em `ui/aba` e `ui/slot_*`, 3 em `ui/balao`) e
`drawPlaque` (placa de madeira com o nome da zona), `drawFlavor`/`drawPastelFlavor` (selo do sabor
`icones/sabor_<base>` com os pontinhos da versão `ui/selo_versao`; o `flavor` de `Control` põe o selo no ícone do painel). Texto escuro (`PAL.ink`, `PAL.ink2`) vai sem sombra
(`shadow = null`); `PAL.text` é claro, para faixas vermelhas e fogo. O `icon` de `Control` (`render/panel.ts`)
é só apresentação. No DOM, os ícones do HUD e dos insumos vêm de `components/icons.ts` e a moldura de
madeira é a classe `.moldura` (`border-image` com `--pf-moldura`, definida na raiz em `Game.tsx`).

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
| `game/e2eHook.ts` | gancho dos testes E2E (`window.__pf`), só existe com `window.__PF_E2E__` definido pela página de teste |
| `sim/run.ts` | `--scenario`, `--replay`, `--bots`, `--list` |
| `sim/scenarios/*` | um grupo por conjunto de RN (290 cenários; `combinacoes` cruza as regras novas entre si e com as antigas) |
| `sim/player.ts`, `sim/bots.ts`, `sim/report.ts` | jogador automático e robôs de calibração |

Arte: `tools/pixelart/pastel_de_feira.py`, script único (cenário, móveis 3-slice, equipamentos, enfeites,
pastéis, insumos, ícones do painel/evento/perfil, interface 9-slice, HUD, capa; `--previa` gera prévias) e
`tools/pixelart/biblioteca/caes_pe.py` (cachorros de pé, compartilhados). Nunca edite PNG à mão.

## Armadilhas conhecidas

- A simulação não pode usar `Math.random`, `Date` nem o relógio do navegador: só o `Rng` semeado. Aparência e som ficam fora.
- Todo comando de gesto leva `g` (id): o mesmo id é processado uma vez (toque duplo).
- `game/assets.ts` importa `shared/sprites` e `game/art.ts` de forma dinâmica: `import.meta.glob` quebra a simulação em node.
- Mudou o formato do save? Aumente a versão em `save.ts` e escreva a migração.
- Mudou um valor (P)? Rode `--bots all --seeds 50` e atualize `docs/specs/pastel-de-feira/calibracao.md` e a tabela do `README.md`.
- Mudou, acrescentou ou removeu regra/mecânica? Atualize a seção correspondente do `README.md` (manual) e a spec.
- O primeiro `dt` do `requestAnimationFrame` pode ser negativo: o laço limita com `Math.max(0, Math.min(dt, MAX_FRAME_DT))`.
- StrictMode roda efeitos duas vezes: o `DaySim` nasce dentro do `useEffect` e o cleanup remove listeners e cancela o `requestAnimationFrame`.

## Como verificar

1. `npm run typecheck && npm run build`.
2. `node /tmp/pf-sim.mjs --scenario all` (esbuild de `sim/run.ts`, veja o `README.md`): todos os cenários devem passar.
3. Replay: grave um dia (`startLog` + `recordReplay`), rode `--replay` duas vezes: o hash é idêntico.
4. `--bots all --seeds 50`: os 4 robôs passam em ≥ 80% das sementes (ver `calibracao.md`).
5. Navegador: `#/jogos/pastel-de-feira` em desktop e a ≈ 390 px; a barra "← Sampa Challenges" volta ao hub.
6. `npm run test:e2e`: suíte de ponta a ponta em `e2e/pastel-de-feira/` (Playwright, cliques no canvas, relógio de quadros controlado). Veja `e2e/README.md`.
