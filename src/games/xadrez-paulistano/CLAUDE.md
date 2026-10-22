# CLAUDE.md — Xadrez Paulistano

Leia antes o `CLAUDE.md` da raiz (regras do hub: CSS escopado em `.xadrez-paulistano`, assets na
pasta, manifest leve). Regras de jogo, níveis e tabela de parâmetros: `README.md` desta pasta.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub (id `xadrez-paulistano`, capa `assets/capa.png`, `order: 5`) |
| `Game.tsx` | raiz: carrega os assets e as últimas escolhas, alterna entre `Menu` e `GameScreen` |
| `components/Menu.tsx` | modo, barra de nível 1–100 (com −/+), cor das peças, nomes, girar automático |
| `components/GameScreen.tsx` | canvas + laço `requestAnimationFrame`, ponteiro (clique/arrasto), teclado, promoção, fim de partida, botões e lista de lances |
| `game/chess.ts` | regras puras: `Position` (0x88, `make`/`unmake`, `genMoves`, `legalMoves`, `attacked`, repetição, material insuficiente), `gameOutcome`, `moveToSan` (português), UCI, Zobrist |
| `game/ai.ts` | `Searcher.choose(pos, nível)` e `evaluate(pos)` |
| `game/ai.worker.ts` | Web Worker: recebe FEN + lances UCI, devolve o lance do computador |
| `game/levels.ts` | `levelProfile(nível)` (tempo, profundidade, ruído, lance aleatório, quiescente) e `levelLabel` |
| `game/engine.ts` | `XadrezEngine`: estado da partida, entrada, vez do computador, animação, desenho, HUD |
| `game/constants.ts` | layout do canvas, animação e curvas de dificuldade |
| `game/config.ts` | `loadSettings`/`saveSettings` (`xadrez-paulistano:config`) |
| `game/assets.ts` | lista de PNGs, `assetUrl`, `pieceKey(cor, tipo, mini)`, `loadAssets` |
| `game/hires.ts` | `scale2x`, `upscaleAll`, `blit`, `SCALE` (igual ao `_modelo`) |
| `game/pixelFont.ts` | fonte 3×5 (sem acentos: o motor passa os nomes por `plain()`) |
| `game/sound.ts` | `sfx`: lance, captura, roque, xeque, vitória/derrota/empate (WebAudio; mute em `xadrez-paulistano:som`) |
| `game/types.ts` | `Settings`, `HudState` |

## Como o jogo funciona

- **Representação:** casa = `rank * 16 + file` (0x88); peça = `tipo | cor << 3`; lance = número
  com `from`, `to`, peça de promoção e flags (captura, en passant, roque, avanço duplo). `make`
  aceita lance pseudo-legal; quem chama confere `inCheck(cor que jogou)` e desfaz se for ilegal.
- **Hash:** Zobrist em 64 bits (dois `Int32`). A casa de en passant só entra no hash se houver peão
  inimigo ao lado, para a repetição tripla bater com a regra.
- **Estados no motor:** vez do humano (aceita entrada), animação (`anim`), promoção pendente
  (`promotion`, o React mostra a escolha), computador pensando (`thinking`) / lance pronto esperando
  `AI_MIN_DELAY_MS` (`aiMove`), fim (`outcome`). `isHumanTurn()` bloqueia a entrada fora da vez.
- **Computador:** no `update`, se é a vez dele e nada está pendente, `requestAi()` manda
  `{ id, fen inicial, lances UCI, nível }` ao worker (os lances vão completos para a IA enxergar
  repetições). Respostas com `id` antigo são descartadas. Desfazer/nova partida durante a busca
  **termina o worker e cria outro** (a busca não pode ser interrompida por mensagem). Sem worker,
  `Searcher` roda na thread principal (`fallback`).
- **IA (`ai.ts`):** aprofundamento iterativo, PVS, tabela de transposição, lance nulo (só com
  peças além de peões), redução de lances tardios, killers e história, extensão de xeque e busca
  quiescente (capturas e promoção a dama). Avaliação: material + tabelas de posição com
  interpolação abertura/final, peões dobrados/isolados/passados, torre em coluna aberta, par de
  bispos e, em final ganho, empurrar o rei perdedor para a borda (sem isso não sabe dar mate com
  dama ou torre).
- **Dificuldade:** `levelProfile` limita tempo e profundidade; com ruído, cada lance da raiz recebe
  uma nota até `melhor − 3·ruído` e a escolha soma ruído uniforme; `blunder` sorteia um lance legal
  qualquer. A ordem dos lances da raiz é embaralhada para variar as partidas.
- **HUD:** o motor chama `onHud` só quando o JSON do estado muda; o React não guarda estado do jogo.
- **Desenho:** fundo estático (`cenario/tabuleiro.png`, com casas, moldura e painéis já pintados),
  coordenadas (giram com o tabuleiro), destaques (último lance, seleção, xeque), peças, alvos
  (ponto = lance, cantos vermelhos = captura), cursor do teclado, peça animada/arrastada e painel.
  As peças pretas mini ganham uma placa clara para aparecer no fundo escuro.

## Receitas

- **Mudar a dificuldade:** ajuste as constantes `AI_*` (tabela no README) ou a fórmula em
  `levelProfile`. Valide com partidas computador × computador (abaixo).
- **Mudar o layout do canvas:** as posições em `constants.ts` precisam bater com as do topo de
  `tools/pixelart/xadrez_paulistano.py`; mude os dois e gere o fundo de novo.
- **Mudar o desenho das peças:** edite as máscaras 16×18 em `PECAS` no gerador (`x` corpo, `d`
  detalhe escuro, `g` enfeite); luz e sombra são automáticas. As mini saem da mesma máscara.

## Armadilhas conhecidas

- `make` sem conferir `inCheck` aceita lance ilegal; para a interface use sempre `legalMoves()`.
- `moveToSan` precisa ser chamado **antes** de `make` (usa a lista de lances legais da posição).
- Promoção gera 4 lances com o mesmo `from`/`to`: `tryMove` abre a escolha quando há mais de um.
- O worker é criado com `new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })`;
  não mude para caminho em string (quebra com hash de build e `base: './'`).
- `ctx.setTransform(SCALE, …)`: não use `drawImage(sprite, x, y)` direto em sprite em alta; use `blit`.

## Como verificar

1. `npm run typecheck` e `npm run build` (deve sair um `ai.worker-*.js` em `dist/assets/`).
2. Regras: perft com esbuild + node sobre `game/chess.ts` (posição inicial até profundidade 4 =
   197 281; "Kiwipete" `r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq -` até 3 =
   97 862).
3. IA: `Searcher.choose` em posições de mate em 1, final rei+dama × rei até o mate, e partidas
   nível alto × nível baixo alternando cores (o mais alto deve vencer).
4. Jogue: lance por clique e por arrasto, roque, en passant, promoção, xeque-mate, desfazer contra o
   computador jogando de pretas, girar, 2 jogadores com giro automático, tela de ≈390 px.
