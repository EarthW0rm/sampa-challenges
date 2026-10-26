# Xadrez Paulistano

Xadrez completo num tabuleiro de calçada paulistana (pedra portuguesa clara e basalto), com a
Catedral da Sé ao fundo. Duas pessoas no mesmo aparelho ou uma pessoa contra o computador, com a
força do computador escolhida numa barra de 1 a 100 (100 = mestre). Desktop ou celular (≈ 390 px).

Rota no hub: `#/jogos/xadrez-paulistano`.

Este README é o **manual** do jogo: toda regra ou mecânica tem um número `XP-RN-NN`, e cada número
tem pelo menos um teste de ponta a ponta que o cita no nome (seção 16). Mudou uma regra? Atualize a
seção dela, a tabela de parâmetros e o teste no mesmo commit. Quem vai mexer no código lê também o
[`CLAUDE.md`](./CLAUDE.md) desta pasta.

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Controles](#2-controles)
3. [Telas e fluxo de uma partida](#3-telas-e-fluxo-de-uma-partida)
4. [Lances: clique, arraste e teclado](#4-lances-clique-arraste-e-teclado)
5. [Regras do xadrez](#5-regras-do-xadrez)
6. [Notação e lista de lances](#6-notação-e-lista-de-lances)
7. [Painel do tabuleiro](#7-painel-do-tabuleiro)
8. [Botões da partida](#8-botões-da-partida)
9. [Modos e o computador](#9-modos-e-o-computador)
10. [Resultado e recorde](#10-resultado-e-recorde)
11. [Opções do menu](#11-opções-do-menu)
12. [Robustez: foco, tempo, armazenamento e celular](#12-robustez-foco-tempo-armazenamento-e-celular)
13. [Parâmetros](#13-parâmetros)
14. [Arquitetura](#14-arquitetura)
15. [Como contribuir](#15-como-contribuir)
16. [Testes](#16-testes)

---

## 1. Início rápido

1. `npm run dev` na raiz e abra `#/jogos/xadrez-paulistano` (ou clique no card no hub).
2. No menu, escolha **Contra o computador** (cor e nível) ou **2 jogadores** (nomes e giro
   automático) e toque em **Jogar**.
3. Para jogar um lance: clique (ou toque) numa peça sua e depois na casa de destino; ou arraste a
   peça; ou use as setas e Enter.
4. A partida termina em xeque-mate, desistência ou empate. A janela de fim mostra o resultado e
   oferece **Jogar de novo**, **Ver tabuleiro** e **Menu**.

---

## 2. Controles

| Entrada | Controle | Ação | Regra |
|---|---|---|---|
| Mouse / toque | clique na peça e depois na casa | joga o lance | XP-RN-02 |
| Mouse / toque | arrastar a peça até a casa | joga o lance; soltar fora de uma casa válida devolve a peça | XP-RN-03 |
| Teclado | setas | movem o cursor amarelo pelo tabuleiro | XP-RN-04 |
| Teclado | Enter / Espaço | seleciona a peça ou joga na casa do cursor | XP-RN-04 |
| Teclado | Esc | solta a peça selecionada | XP-RN-04 |
| Mouse / toque | **Desfazer**, **Desistir**, **Nova partida** (abaixo do tabuleiro) | ver seção 8 | XP-RN-19 a XP-RN-21 |
| Mouse / toque | **Som**, **Girar**, **← Menu** (barra de cima) | ver seções 3 e 8 | XP-RN-01, XP-RN-22, XP-RN-23 |
| Teclado | Enter / Espaço com o foco num botão | aciona o botão (não o tabuleiro) | XP-RN-04 |

O toque é o controle completo: o tabuleiro trata toque como clique e como arraste (o canvas tem
`touch-action: none`, então arrastar uma peça não rola a página).

---

## 3. Telas e fluxo de uma partida

### XP-RN-01 Telas

```
Carregando ("Arrumando as peças…") → Menu → Partida ─┬─ fim: janela "Fim de partida"
                                     ▲                │    Jogar de novo → nova partida, mesmas escolhas
                                     │                │    Ver tabuleiro → fecha a janela
                                     └── ← Menu ──────┴─── Menu → volta ao menu
```

- **Carregando:** enquanto os PNGs carregam aparece "Arrumando as peças…"; erro de carga mostra
  "Erro: <mensagem>".
- **Menu** (seção 11): título "XADREZ PAULISTANO", opções e o botão **Jogar**, que grava as escolhas
  e abre a partida.
- **Partida:** barra de cima (← Menu, modo/nível, Som, Girar), o tabuleiro com o painel (seção 7),
  os botões Desfazer/Desistir/Nova partida, a lista de lances e uma dica de controles.
- **← Menu** (barra de cima) e **Menu** (janela de fim) voltam ao menu com as últimas escolhas já
  marcadas. A partida em andamento é descartada: não há salvamento de partida.
- **Fim de partida:** a janela (diálogo "Fim de partida") aparece quando o resultado muda (seção
  10). **Ver tabuleiro** fecha a janela até o próximo resultado; o tabuleiro continua parado.

---

## 4. Lances: clique, arraste e teclado

### XP-RN-02 Lance por clique ou toque

- Clicar numa peça **da cor que tem a vez** seleciona a peça (casa verde) e marca os destinos legais:
  ponto escuro = casa livre, cantos vermelhos = captura. Na promoção só aparece uma marca por casa.
- Clicar num destino marcado joga o lance (a peça desliza em `MOVE_ANIM_S`).
- Clicar em outra peça própria troca a seleção; clicar de novo na peça selecionada solta a seleção;
  clicar numa casa que não é destino legal solta a seleção sem jogar.
- Clicar numa casa vazia sem nada selecionado, numa peça do adversário sem seleção ou fora do
  tabuleiro não faz nada.
- Passar o ponteiro sobre uma peça própria ou um destino legal desenha uma moldura clara.

### XP-RN-03 Lance por arraste

- Apertar numa peça própria já a seleciona. Ela vira arraste quando o ponteiro se afasta mais de
  `DRAG_THRESHOLD + SQ/2` (14 pixels lógicos) do centro da casa; a peça acompanha o ponteiro e a casa
  de origem fica com a peça apagada.
- Soltar num destino legal joga o lance sem animação.
- Soltar fora do tabuleiro, na própria casa ou numa casa ilegal devolve a peça (som de lance
  inválido na casa ilegal). A peça **continua selecionada**.
- Apertar e soltar sem passar do limiar é um clique (XP-RN-02).

### XP-RN-04 Lance pelo teclado

- A primeira seta mostra o cursor amarelo (piscando) na peça selecionada ou, sem seleção, no rei de
  quem tem a vez. As setas seguintes andam uma casa, **no sentido da tela** (com as pretas embaixo, ↑
  anda para a 1ª fileira), e param na borda.
- Enter ou Espaço no cursor fazem o mesmo que um clique naquela casa (selecionar, jogar, soltar).
- Esc solta a peça selecionada (sem seleção, Esc não faz nada).
- Um clique ou toque no tabuleiro esconde o cursor; a próxima seta o mostra de novo.
- Com o foco num botão (por exemplo, logo depois de clicar em **Girar**), Enter e Espaço acionam o
  botão, não o tabuleiro. As setas sempre movem o cursor. Na janela de promoção o foco começa em
  **Dama** e na de fim em **Jogar de novo**, então Enter escolhe essas opções.

### XP-RN-05 De quem é a vez

- Só a cor que tem a vez move. Contra o computador, só a sua cor; na vez do computador o tabuleiro
  ignora clique, arraste e Enter (o cursor ainda anda).
- A entrada também fica parada enquanto uma peça desliza (`MOVE_ANIM_S`), enquanto a janela de
  promoção está aberta e depois do fim de partida.

---

## 5. Regras do xadrez

Todas as regras oficiais, aplicadas em `game/chess.ts`. Lance que deixa o próprio rei em xeque não
aparece como destino e não é aceito.

### XP-RN-06 Movimento das peças

Rei uma casa; dama, torre e bispo em linha até a primeira peça; cavalo em L (pula peças); peão uma
casa para a frente, duas na primeira jogada (se as duas casas estiverem livres) e captura na
diagonal. Ninguém captura peça da própria cor. A partida começa com as brancas.

### XP-RN-07 Roque curto e longo

O rei anda duas casas na direção da torre e a torre passa para o outro lado dele (`O-O` para o lado
do rei, `O-O-O` para o lado da dama); na tela as duas peças deslizam juntas. Para clicar ou arrastar,
o destino é a casa final do rei (g1/c1 nas brancas, g8/c8 nas pretas). Condições:

- nem o rei nem aquela torre se moveram (o direito some quando um deles se move ou quando a torre é
  capturada na casa de origem);
- as casas entre os dois estão vazias (no roque longo, inclusive a casa b).

### XP-RN-08 Roque proibido por xeque ou casa atacada

Não há roque com o rei em xeque, nem passando ou chegando numa casa atacada (f1/g1 no curto, d1/c1
no longo, e as equivalentes das pretas). A casa b1/b8 do roque longo pode estar atacada.

### XP-RN-09 En passant

Quando um peão anda duas casas e para ao lado de um peão adversário, este pode capturá-lo como se
ele tivesse andado uma só, **apenas no lance seguinte**. O peão capturado sai da casa ao lado (não
da casa de destino).

### XP-RN-10 Promoção com escolha

O peão que chega à última fileira (andando ou capturando) vira dama, torre, bispo ou cavalo. Abre a
janela "Promover a…" (diálogo "Promoção do peão") com as quatro peças da cor de quem joga; o status
do painel mostra "ESCOLHA A PECA". **Cancelar** desfaz a tentativa: o peão fica onde estava e a
seleção some.

### XP-RN-11 Xeque

Rei atacado: a casa dele fica vermelha com moldura, o status pisca "XEQUE!" e o lance recebe `+`
na lista. Quem está em xeque só pode jogar lances que tirem o rei do xeque.

### XP-RN-12 Xeque-mate

Em xeque e sem lance legal: a partida acaba e vence quem deu o mate. Status "XEQUE-MATE!", o lance
recebe `#`, a caixa do vencedor fica destacada e a janela de fim diz "<nome> venceu!" e
"Xeque-mate das brancas/pretas.".

### XP-RN-13 Afogamento

Quem tem a vez não está em xeque e não tem lance legal: empate. Status "AFOGADO - EMPATE"; janela
"Empate" / "Afogamento: quem tem a vez não tem lance legal e não está em xeque.".

### XP-RN-14 Regra dos 50 lances

Empate **automático** quando se completam 50 lances de cada lado (100 meios-lances) sem captura nem
movimento de peão. Se o lance que completa a contagem dá mate, vale o mate. Status
"50 LANCES - EMPATE"; janela "50 lances de cada lado sem captura nem movimento de peão.".

### XP-RN-15 Repetição tripla

Empate **automático** quando a mesma posição aparece pela terceira vez com o mesmo lado a jogar,
os mesmos direitos de roque e a mesma possibilidade de en passant (a casa de en passant só conta se
houver peão adversário ao lado do peão que andou duas). Captura ou lance de peão zera a contagem.
Status "REPETICAO - EMPATE"; janela "A mesma posição se repetiu três vezes.".

### XP-RN-16 Material insuficiente

Empate **automático** quando ninguém tem material para dar mate:

- rei contra rei;
- rei e um cavalo ou um bispo contra rei (no tabuleiro inteiro há no máximo uma peça menor);
- só reis e bispos, todos em casas da mesma cor (por exemplo, rei e bispo contra rei e bispo com
  os bispos na mesma cor).

Rei e dois cavalos contra rei, rei e bispo contra rei e cavalo e bispos de cores diferentes **não**
encerram a partida. Status "SEM MATE - EMPATE"; janela "Material insuficiente: ninguém consegue dar
xeque-mate.".

A ordem de conferência depois de cada lance é: mate/afogamento, 50 lances, repetição, material.

---

## 6. Notação e lista de lances

### XP-RN-17 Notação algébrica em português

A lista "Lances" (abaixo do tabuleiro) numera os lances em pares (`1. e4 e5`, `2. Cf3 Cc6`); antes
do primeiro lance mostra "As brancas começam.". A lista rola sozinha até o último lance.

| Lance | Notação | Exemplo |
|---|---|---|
| peças | **R** rei, **D** dama, **T** torre, **B** bispo, **C** cavalo + casa | `Cf3`, `Bb5` |
| captura | `x` antes da casa; peão usa a coluna de saída | `Bxc6`, `exd5` |
| en passant | como captura de peão, sem sufixo | `exf6` |
| roque | curto / longo | `O-O`, `O-O-O` |
| promoção | `=` e a letra da peça | `e8=D`, `bxa1=C` |
| xeque / mate | sufixo | `Dh5+`, `Dxf7#` |
| desambiguação | coluna de saída; se não basta, a fileira; se não basta, a casa | `Cbd2`, `T1e2`, `Dh4e1` |

---

## 7. Painel do tabuleiro

### XP-RN-18 Painel

À direita do tabuleiro (desenhado no canvas, fonte sem acentos e em maiúsculas):

- **Caixa de cima e de baixo:** um lado cada (o de baixo é a cor que está embaixo no tabuleiro).
  Mostram o rei mini da cor, o nome (até 17 letras), as peças adversárias que aquele lado capturou
  (dama, torres, bispos, cavalos, peões, até 2 linhas de `CAPTURED_PER_ROW`) e a vantagem de material
  `+N` (peão 1, cavalo 3, bispo 3, torre 5, dama 9). A caixa de quem tem a vez fica com moldura
  amarela; depois de mate ou desistência, a do vencedor.
- **Status** (entre as caixas), em ordem de prioridade: resultado (seção 5 e XP-RN-20); "ESCOLHA A
  PECA" (promoção); "PENSANDO", "PENSANDO.", ... (computador); "XEQUE!" piscando; "VEZ DAS BRANCAS" /
  "VEZ DAS PRETAS".
- **No tabuleiro:** coordenadas (letras embaixo, números à esquerda, giram com o tabuleiro), último
  lance em amarelo (origem e destino), peça selecionada em verde, rei em xeque ou mateado em vermelho.

---

## 8. Botões da partida

### XP-RN-19 Desfazer

- **2 jogadores:** volta o último lance. Habilitado a partir do primeiro lance.
- **Contra o computador:** volta até ser a sua vez de novo (o lance do computador e o seu).
  Habilitado depois que você jogou ao menos um lance (com as pretas, depois do 2º meio-lance).
  Durante "PENSANDO", Desfazer cancela a busca do computador e volta o seu lance.
- Depois de um fim de partida, Desfazer reabre a partida (a janela de fim some). Depois de uma
  **desistência**, Desfazer só cancela a desistência: o tabuleiro fica como estava.
- Desfazer solta a seleção, fecha a promoção pendente e interrompe a animação.
- Com o giro automático ligado (2 jogadores), o tabuleiro fica do lado de quem passa a ter a vez.

### XP-RN-20 Desistir (com confirmação)

O primeiro clique troca o botão por **Confirmar desistência** (vermelho); o segundo, dentro de 3 s,
encerra a partida. Sem o segundo clique, o botão volta ao normal em 3 s. Contra o computador quem
desiste é você (mesmo na vez do computador, cuja busca é cancelada); a dois, quem tem a vez. Status
"DESISTENCIA"; janela "<vencedor> venceu!" / "<quem desistiu> desistiu.". Desabilitado depois do fim
de partida.

### XP-RN-21 Nova partida (com confirmação)

Com uma partida em andamento (há lances e não acabou), o primeiro clique troca o botão por
**Abandonar esta partida?** e o segundo, dentro de 3 s, recomeça; sem o segundo clique ele volta ao
normal em 3 s. Sem lances, ou depois do fim, recomeça no primeiro clique. Recomeçar usa as mesmas
escolhas do menu (no **Sorteio** a cor é sorteada de novo) e cancela a busca do computador. Os dois
botões de confirmação não ficam ativos ao mesmo tempo, e um resultado novo desarma a confirmação.

### XP-RN-22 Girar

Vira o tabuleiro (a cor de baixo passa para cima), com coordenadas, caixas do painel e sentido das
setas. Não muda a partida nem a vez; cancela um giro automático pendente.

### XP-RN-23 Som

O botão mostra **Som: ligado** / **Som: desligado** e alterna os efeitos (lance, captura, roque,
xeque, seleção, lance inválido, vitória/derrota/empate). A escolha fica gravada em
`xadrez-paulistano:som` (`on`/`off`) e vale nas próximas partidas e visitas. Sem nada gravado, o som
começa ligado. O áudio só começa depois do primeiro toque ou tecla (regra dos navegadores).

---

## 9. Modos e o computador

### XP-RN-24 Contra o computador

Você escolhe **Brancas**, **Pretas** ou **Sorteio** (a cor é sorteada a cada partida). O tabuleiro
começa com a sua cor embaixo. Os nomes são o seu (do menu) e "Computador N" (N = nível). A barra de
cima mostra "Contra o computador · nível N (faixa)". Com as pretas, o computador abre a partida.

### XP-RN-25 2 jogadores e giro automático

Duas pessoas jogam no mesmo aparelho, cada uma na sua vez; os nomes são os das brancas e das pretas
do menu e a barra mostra "2 jogadores". O tabuleiro começa com as brancas embaixo. Com **Girar o
tabuleiro para quem vai jogar** ligado, depois de cada lance (se a partida não acabou) o tabuleiro
gira para quem tem a vez, `MOVE_ANIM_S + 0,35 s` depois do lance.

### XP-RN-26 A vez do computador

- Na vez dele, o status mostra "PENSANDO…" e a busca roda num Web Worker (a tela não trava).
- O lance só aparece depois de `AI_MIN_DELAY_MS` desde o pedido (para dar para ver), mesmo que a
  busca termine antes, e desliza como um lance normal.
- Desfazer, Desistir, Nova partida e ← Menu durante a busca a cancelam; uma resposta que chega
  depois disso é descartada (cada pedido tem um número e só o último vale).
- Se o worker não puder ser criado ou falhar, o computador passa a pensar na própria página
  (`Searcher` na thread principal) e a partida continua; a tela pode travar durante o lance.

### XP-RN-27 Níveis do computador

A força vai de `LEVEL_MIN` a `LEVEL_MAX`. `levelProfile(nível)` (`game/levels.ts`) define, com
`t = (nível − 1) / 99`:

| Item | Fórmula | Nível 1 | 30 | 50 | 85 | 100 |
|---|---|---|---|---|---|---|
| tempo máximo por lance | `AI_TIME_MIN_MS + (AI_TIME_MAX_MS − AI_TIME_MIN_MS)·t²` | 200 ms | 440 ms | 886 ms | 2216 ms | 3000 ms |
| profundidade | `1 + ⌊7t⌋`; no 100, `AI_DEPTH_MAX` | 1 | 3 | 4 | 6 | 64 |
| ruído na nota | `AI_NOISE_MAX·(1 − t)²`; abaixo de `AI_NOISE_MIN`, 0 | 250 | 125 | 64 | 6 | 0 |
| lance aleatório | `AI_BLUNDER_MAX·(1 − t)³` | 35% | 12,4% | 4,5% | 0,1% | 0 |
| busca quiescente (trocas até o fim) | nível ≥ `AI_QUIESCENCE_FROM` | não | sim | sim | sim | sim |

A profundidade sobe em 16, 30, 44, 58, 72 e 86; o ruído some a partir do 86. A busca para no que
vier primeiro: a profundidade do nível, o tempo do nível ou um mate encontrado.

| Faixa | Nome (menu e barra) | Como joga |
|---|---|---|
| 1–20 | Iniciante | 1–2 lances à frente, erra a avaliação e às vezes joga um lance qualquer |
| 21–40 | Casual | 2–3 lances, ainda com bastante erro |
| 41–60 | Clube | 3–5 lances, enxerga as trocas até o fim |
| 61–80 | Avançado | 5–6 lances, pouco erro |
| 81–99 | Especialista | 6–7 lances, praticamente sem erro a partir do 86 |
| 100 | Mestre | sem limite de profundidade: pensa até 3 s por lance, sem erro proposital |

Em partidas automáticas computador × computador (4 partidas por par, alternando as cores), o nível
mais alto venceu todas: 30 × 1, 60 × 30, 85 × 60 e 100 × 85. A ordem dos lances da raiz é
embaralhada a cada busca, então o computador varia entre lances de mesma nota.

---

## 10. Resultado e recorde

### XP-RN-28 Resultado, sem pontuação nem recorde

O jogo não tem pontos nem recorde: o resultado de cada partida (vitória por mate ou desistência, ou
um dos 4 empates) aparece no status do painel e na janela de fim, e não é gravado. O card do hub não
mostra recorde. Textos da janela:

| Resultado | Título | Detalhe |
|---|---|---|
| xeque-mate | `<vencedor> venceu!` | `Xeque-mate das brancas.` / `das pretas.` |
| desistência | `<vencedor> venceu!` | `<quem desistiu> desistiu.` |
| afogamento, 50 lances, repetição, material | `Empate` | frase da regra (XP-RN-13 a XP-RN-16) |

---

## 11. Opções do menu

### XP-RN-29 Opções

| Opção | Valores | Padrão | Observação |
|---|---|---|---|
| Modo de jogo | Contra o computador · 2 jogadores | Contra o computador | cartões de rádio |
| Força do computador | 1 a 100 | `DEFAULT_LEVEL` (30) | barra, botões − e + (param em 1 e 100); mostra o número, a faixa e uma dica ("Pensa até 0,4 s, 3 lances à frente; erra a avaliação de propósito, 12% de lances sem pensar.") |
| Suas peças | Brancas · Pretas · Sorteio | Brancas | só contra o computador |
| Seu nome / Brancas | texto até 14 caracteres | "Jogador 1" | vazio ou só espaços vira "Jogador 1"; espaços nas pontas são cortados |
| Pretas | texto até 14 caracteres | "Jogador 2" | só a 2 jogadores; vazio vira "Jogador 2" |
| Girar o tabuleiro para quem vai jogar | sim/não | não | só a 2 jogadores |

As opções de um modo ficam guardadas quando se troca para o outro (o nível continua o mesmo ao
voltar para "Contra o computador").

### XP-RN-30 Escolhas guardadas e dado corrompido

**Jogar** grava todas as escolhas em `xadrez-paulistano:config` (JSON); o menu abre com elas na
próxima vez. Ao ler: JSON inválido → padrões; `mode` diferente de `pvp` → contra o computador;
nível não numérico ou 0 → `DEFAULT_LEVEL`; fora de 1–100 → o limite mais próximo (arredondado);
cor desconhecida → brancas; nomes ausentes → padrões; `autoFlip` vale como verdadeiro/falso.

---

## 12. Robustez: foco, tempo, armazenamento e celular

### XP-RN-31 Foco e tempo de quadro

O jogo não tem pausa: perder o foco da janela não muda nada (o computador continua pensando e o
lance dele aparece quando a página volta a desenhar). O passo de cada quadro é limitado a
0–0,05 s, então um quadro com tempo negativo ou um salto grande (aba em segundo plano) não pula a
animação de forma inválida nem quebra o jogo. Na montagem dupla do modo de desenvolvimento
(StrictMode) só um laço de desenho e um conjunto de listeners ficam vivos.

### XP-RN-32 Armazenamento bloqueado

Sem `localStorage` (modo privado ou bloqueado), o jogo abre e joga normalmente: o menu usa os
padrões, o som começa ligado e nem as escolhas nem o som são gravados. Nenhum erro aparece.

### XP-RN-33 Sair e voltar

Sair pelo "← Sampa Challenges" (barra do hub) no meio da partida desmonta o jogo e encerra o worker
do computador; ao voltar, o jogo abre no menu com as escolhas gravadas e uma partida nova.

### XP-RN-34 Celular (≈ 390 px)

A 390 px a página não rola na horizontal, o tabuleiro ocupa a largura e continua legível, o painel e
os botões ficam visíveis, e toque e arraste por toque jogam lances como o mouse.

---

## 13. Parâmetros

`game/constants.ts` (a curva de cada nível é calculada em `game/levels.ts`; `t` vai de 0 no nível 1
a 1 no 100):

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 320 × 200 | grade lógica (posições e cliques) |
| `SCALE` (`game/hires.ts`) | 2 | canvas de 640×400; os PNGs ganham o dobro de detalhe (Scale2x) |
| `BOARD_X`, `BOARD_Y`, `SQ` | 14, 12, 22 | posição do tabuleiro e lado da casa (iguais no gerador do fundo) |
| `PANEL_X`, `PANEL_W` | 204, 110 | painel da direita |
| `BOX_TOP_Y`, `BOX_BOTTOM_Y`, `BOX_H` | 6, 156, 38 | caixas dos dois lados (nome, vez, capturadas, vantagem) |
| `STATUS_Y`, `STATUS_H` | 132, 20 | caixa de status (vez, xeque, pensando, resultado) |
| `CAPTURED_PER_ROW` | 9 | peças capturadas por linha na caixa de cada lado (até 2 linhas) |
| `MOVE_ANIM_S` | 0,18 | duração da peça deslizando |
| `DRAG_THRESHOLD` | 3 | quanto o ponteiro anda além da meia casa para virar arrasto |
| `AI_MIN_DELAY_MS` | 450 | espera mínima entre o pedido e o lance do computador |
| `LEVEL_MIN`, `LEVEL_MAX` | 1, 100 | limites da barra de nível |
| `DEFAULT_LEVEL` | 30 | nível inicial da barra (e o usado quando o gravado é inválido) |
| `AI_TIME_MIN_MS`, `AI_TIME_MAX_MS` | 200, 3000 | tempo de busca por lance: `MIN + (MAX − MIN)·t²` |
| `AI_DEPTH_MAX` | 64 | profundidade do mestre (quem limita é o tempo); nos outros níveis `1 + ⌊7t⌋` |
| `AI_NOISE_MAX` | 250 | ruído em centipeões na nota dos lances no nível 1: `MAX·(1 − t)²` |
| `AI_NOISE_MIN` | 5 | abaixo disso o ruído é desligado (a partir do nível 86) |
| `AI_BLUNDER_MAX` | 0,35 | chance de lance aleatório no nível 1: `MAX·(1 − t)³` |
| `AI_QUIESCENCE_FROM` | 15 | a partir deste nível a busca segue as trocas até o fim |
| `AI_TT_SIZE` | 2¹⁹ | entradas da tabela de transposição (~7 MB no worker) |
| `E2E_NODES_PER_MS` | 400 | **só nos testes**: a busca para em `tempo do nível × 400` nós em vez de pelo relógio (seção 16) |

Números fixos no código (fora de `constants.ts`):

| Onde | Valor | Efeito |
|---|---|---|
| `engine.ts` `POINTS` | peão 1, cavalo 3, bispo 3, torre 5, dama 9 | vantagem `+N` do painel |
| `engine.ts` `CAPTURE_ORDER` | dama, torre, bispo, cavalo, peão | ordem das capturadas no painel |
| `engine.ts` giro automático | `MOVE_ANIM_S + 0,35 s` | atraso do giro para quem vai jogar |
| `engine.ts` reserva sem worker | 30 ms | espera antes de pensar na thread principal |
| `GameScreen.tsx` laço | passo limitado a 0–0,05 s | quadro negativo ou gigante (XP-RN-31) |
| `GameScreen.tsx` confirmação | 3 s | Desistir / Nova partida voltam ao normal |
| `Menu.tsx` nomes | 14 caracteres | `maxLength` dos campos de nome |
| `ai.ts` `VALUE` | 100, 320, 330, 500, 900 | valor das peças na avaliação (centipeões) |
| `ai.ts` peões e torres | dobrado −10, isolado −12, passado 5–100, torre em coluna aberta +15 (semiaberta +7), par de bispos +30 | estrutura na avaliação |
| `ai.ts` `MAX_PLY` | 96 | profundidade máxima de uma linha da busca |

---

## 14. Arquitetura

- **React só para menus e HUD.** `Game.tsx` alterna entre `Menu` e `GameScreen`; o `GameScreen`
  cria o `XadrezEngine` no `useEffect` (descartado no cleanup), roda o laço de
  `requestAnimationFrame` e repassa ponteiro e teclado ao motor. O motor chama `onHud` só quando o
  estado visível muda.
- **Regras puras** em `game/chess.ts` (tabuleiro 0x88, lances legais, resultado, notação, UCI, hash
  Zobrist); **IA** em `game/ai.ts` (`Searcher`), rodando em `game/ai.worker.ts`.
- **Pedido ao worker:** `{ id, fen inicial, lances UCI, nível }` (mais `seed` e `nodeBudget` nos
  testes, ver seção 16); respostas com `id` antigo são descartadas; cancelar troca o worker por outro.
- **Desenho:** fundo estático com tabuleiro e painéis (`assets/cenario/tabuleiro.png`), peças 20×20
  e minis 10×11, todos ampliados por Scale2x (`game/hires.ts`).
- Mapa completo dos arquivos, armadilhas e receitas: [`CLAUDE.md`](./CLAUDE.md).

### Arte

Gerada por `tools/pixelart/xadrez_paulistano.py` (fundo com tabuleiro e painéis, 12 peças 20×20,
12 peças mini 10×11 e a capa):

```bash
cd tools/pixelart && python3 xadrez_paulistano.py /tmp/xadrez
# copie cenario/, pecas/ e capa.png para src/games/xadrez-paulistano/assets/
```

---

## 15. Como contribuir

1. Leia o `CLAUDE.md` da raiz e o desta pasta.
2. Mudou uma regra ou mecânica? Atualize a seção `XP-RN-NN` dela neste manual, a tabela de
   parâmetros (se mudou um número) e o teste que cita a regra, no mesmo commit.
3. Regra nova ganha o próximo número livre; número de regra removida não é reaproveitado.
4. Antes de entregar: `npm run typecheck`, `npm run typecheck:e2e`, `npm run build` e a suíte do
   jogo (seção 16).

---

## 16. Testes

Preenchida na entrega dos testes de ponta a ponta (cobertura por arquivo e tabela regra → teste).
