# Pinball Paulista

Mesa de pinball vertical em pixel art, no clima da Avenida Paulista: bumpers-semáforo, corredores
azuis (faixa de ônibus), o **Minhocão** que prende a bola, o MASP ao fundo e o cachorro motoboy
na capa. Uma mesa completa, 3 bolas por jogo, 1 jogador, desktop ou celular (≈ 390 px), recorde
salvo no navegador.

Rota no hub: `#/jogos/pinball-paulista`. Este README é o **manual** do jogo: toda regra ou mecânica
tem um número `PP-RN-NN`, e cada número tem pelo menos um teste de ponta a ponta que o cita no nome
(seção 12). Mudou uma regra? Atualize a seção dela, a tabela de parâmetros e o teste no mesmo commit.

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Controles](#2-controles)
3. [Telas e fluxo de uma partida](#3-telas-e-fluxo-de-uma-partida)
4. [A mesa e a física](#4-a-mesa-e-a-física)
5. [Flippers, lançador e sacudir](#5-flippers-lançador-e-sacudir)
6. [Semáforos, raias e MOTOBOY](#6-semáforos-raias-e-motoboy)
7. [Minhocão, spinner, estilingues e segura-bola](#7-minhocão-spinner-estilingues-e-segura-bola)
8. [Bolas, bônus, fim de jogo e recorde](#8-bolas-bônus-fim-de-jogo-e-recorde)
9. [Pausa, som, foco e celular](#9-pausa-som-foco-e-celular)
10. [Parâmetros](#10-parâmetros)
11. [Arquitetura](#11-arquitetura)
12. [Testes](#12-testes)
13. [Como contribuir](#13-como-contribuir)

---

## 1. Início rápido

1. No hub, abra **Pinball Paulista** e toque em **Jogar** (ou Enter/Espaço).
2. **Segure Espaço** (ou o botão **Lançar**) e solte: quanto mais tempo segurado, mais forte a bola sai.
   Segure perto de 1 s para a bola subir a rampa e entrar na mesa.
3. Use **Z** / **←** para o flipper esquerdo e **/** / **→** para o direito. No celular, toque na metade
   esquerda ou direita da mesa.
4. Bata nos semáforos, acenda as raias do topo e as letras **MOTOBOY**, acerte o Minhocão. Cada bola que
   cai rende o **bônus** acumulado × multiplicador. Depois da 3ª bola, fim de jogo.

---

## 2. Controles

| Entrada | Controle | Ação |
|---|---|---|
| Teclado | ← , Z ou A | flipper esquerdo (enquanto segurado) |
| Teclado | → , / ou D | flipper direito (enquanto segurado) |
| Teclado | Espaço ou ↓ (segurar e soltar) | lançador: a força cresce com o tempo segurado |
| Teclado | N | sacudir a mesa (um tranco por aperto; segurar não repete) |
| Teclado | P ou Esc | pausar / continuar |
| Teclado | Enter ou Espaço (título) | começar o jogo |
| Mouse / toque | metade esquerda / direita da mesa (segurar) | flipper esquerdo / direito |
| Mouse / toque | botão **Lançar (segure e solte)** | lançador |
| Mouse / toque | botão **Sacudir** | sacudir a mesa |
| Mouse / toque | **Pausar**/**Continuar**, **Som: sim/não**, **← Menu** | barra de cima |

As teclas de jogo (setas, Z, /, A, D, Espaço) não rolam a página. O primeiro gesto (tecla ou toque)
libera o som do navegador.

---

## 3. Telas e fluxo de uma partida

### PP-RN-01 Tela de título

Mostra o nome, a mesa, o botão **Jogar** (com foco) e o quadro "Como jogar". Se houver recorde salvo
maior que 0, aparece **Recorde: N**. **Jogar**, Enter ou Espaço começam o jogo.

### PP-RN-02 Tela da partida e HUD

- **Barra de cima:** **← Menu** (volta ao título), **Bola n/3**, **Som: sim/não**, **Pausar**.
- **Painel esquerdo:** bolas (capacetes; os já usados ficam apagados), **Multiplicador** ×n com 5
  marcas, **Motoboy** (7 letras, acesas em amarelo), **Semáforos** (quantos estão verdes, de 3).
- **Painel direito:** **Pontos**, **Recorde** (vira **NOVO!** quando o placar passa o recorde),
  **Status** (Segura-bola, Onda verde, Multiball, Bola extra, Tilt; "–" sem nenhum) e as teclas.
- Com a bola na rampa aparece a dica **"Segure ESPAÇO ou LANÇAR e solte"**; mensagens curtas
  (ex.: `MULTIBALL!`, `TILT!`) aparecem no meio da mesa.
- Fluxo: título → partida (bola 1 na rampa, fase `ready`) → lançamento (`play`) → bola perdida
  (`bonus`, 3,4 s) → próxima bola … → fim de jogo (`over`). A pausa (`paused`) pode entrar em
  qualquer fase, menos no fim de jogo.

---

## 4. A mesa e a física

### PP-RN-03 Campo, subpassos e ralo

- Campo lógico de `W` × `H` = 240 × 400 (canvas 480×800). A física roda em subpassos fixos de `STEP`
  = 1/480 s: o quadro é cortado em `MAX_DT` = 0,05 s e cada quadro roda no máximo `MAX_SUBSTEPS` = 40
  subpassos (o que sobrar é descartado). Por isso um quadro gigante (aba voltando de segundo plano)
  avança só 0,05 s e a bola não atravessa paredes.
- Gravidade `GRAVITY` ao longo da mesa; velocidade limitada a `MAX_SPEED`. Paredes devolvem a
  velocidade normal com elasticidade `E_WALL` (flippers `E_FLIPPER`); abaixo de `REST_SPEED` o quique é
  zerado e a bola assenta.
- A bola que passa de `DRAIN_Y` (abaixo da tela) é perdida (ralo).
- Pinos redondos nas pontas das guias e os separadores das raias também rebatem a bola.

### PP-RN-04 Portão de mão única

A saída da rampa de lançamento (x = 214, entre y 66 e 100) tem um portão: a bola vinda da rampa entra
na mesa, mas a bola vinda da mesa rebate e não volta para a rampa.

---

## 5. Flippers, lançador e sacudir

### PP-RN-05 Flippers

Cada flipper é uma cápsula de `FLIPPER_LEN` com raio de `FLIPPER_R0` (base) a `FLIPPER_R1` (ponta),
pivô em `FLIPPER_PIVOT_L`/`FLIPPER_PIVOT_R`. Enquanto a tecla (ou a metade da mesa) está apertada, ele
sobe de `FLIPPER_REST` (+30°) até `FLIPPER_UP` (−26°) a `FLIPPER_OMEGA_UP`; solto, desce a
`FLIPPER_OMEGA_DOWN`. A velocidade da superfície entra no rebote, então o flipper "bate" na bola.
Os flippers só funcionam com a bola na rampa ou em jogo (fases `ready` e `play`); no bônus, no fim de
jogo, na pausa e em tilt ficam em repouso.

### PP-RN-06 Lançador

- Com uma bola parada na rampa, segurar Espaço, ↓ ou **Lançar** carrega a mola: a carga vai de 0 a 1
  em `PLUNGER_CHARGE_TIME` (a bola desce até 9 px). Ao soltar, a bola sai para cima a
  `PLUNGER_MIN + PLUNGER_RANGE × carga` px/s (430 a 900).
- Carga até `PLUNGER_MIN_CHARGE` (toque de até 3 quadros) não lança: a bola volta ao lugar.
- Lançamento fraco não sobe a rampa: a bola cai de volta, assenta e pode ser lançada de novo.
- O primeiro lançamento de cada bola começa a jogada (fase `play`) e liga o segura-bola (PP-RN-21).

### PP-RN-07 Sacudir (nudge)

N ou **Sacudir** dá um tranco só com a bola em jogo (fase `play`), fora de tilt e com pelo menos
`NUDGE_COOLDOWN` desde o anterior. Cada bola livre (nem na rampa nem presa) ganha `NUDGE_PUSH_X` para
um lado sorteado e `NUDGE_PUSH_Y` para cima. Cada tranco soma 1 à conta, que cai `NUDGE_DECAY` por
segundo (1 a cada 4 s). Quando a conta passa de `NUDGE_LIMIT − 1` aparece **CUIDADO!**.

### PP-RN-08 Tilt

Quando a conta passa de `NUDGE_LIMIT` (o 4º tranco seguido): **TILT!**, os flippers desligam (e não
giram as raias), o segura-bola não salva e a bola que cair dá **bônus 0** ("TILT: sem bônus"); uma
bola extra pendente também se perde. O tilt acaba na próxima bola.

---

## 6. Semáforos, raias e MOTOBOY

### PP-RN-09 Semáforos (bumpers)

Três bumpers de raio `BUMPER_R` chutam a bola a pelo menos `BUMPER_KICK`. Cada batida vale
`PTS.bumper` (e soma `BONUS_PTS.bumper` ao bônus) e avança a luz daquele semáforo: 0–2 batidas
vermelho, 3–5 amarelo, 6+ verde (`SEMAFORO_HITS` por estágio). A 6ª batida no mesmo bumper vale mais
`PTS.semaforoVerde` (fora da Onda Verde). O painel "Semáforos" mostra quantos estão verdes.

### PP-RN-10 Onda Verde

Os 3 semáforos verdes ao mesmo tempo ligam a **Onda Verde**: `PTS.ondaVerde` na hora, bumpers valendo
o dobro por `WAVE_SECONDS` e as luzes voltam a vermelho (os três bumpers aparecem verdes durante a
onda). Durante a onda a 6ª batida não dá o extra nem liga outra onda.

### PP-RN-11 Raias do topo e multiplicador

Três raias (sensores) no topo. A bola que passa numa raia apagada acende a raia e vale `PTS.raia`
(+`BONUS_PTS.raia` no bônus); raia já acesa não pontua. Cada aperto de flipper gira as luzes: o
esquerdo para a esquerda, o direito para a direita (apertar os dois no mesmo quadro conta só o
esquerdo). As 3 acesas: **multiplicador do bônus +1** (até `MAX_MULT`), `PTS.raias` e as raias apagam
(no ×5 os pontos continuam valendo). A bola que completou o trio ainda está no sensor quando as luzes
apagam, então a mesma passagem reacende aquela raia (mais `PTS.raia` e `BONUS_PTS.raia`).

### PP-RN-12 Letras MOTOBOY

Sete placas nas guias dos corredores azuis (M-O-T à esquerda, O-B-O-Y à direita). Só contam batidas do
lado do campo, com impacto acima de `TARGET_MIN_HIT`. Letra nova: `PTS.letraNova`; letra já acesa:
`PTS.letraAcesa`; as duas somam `BONUS_PTS.alvo` ao bônus. As letras **continuam acesas de uma bola
para a outra** (zeram só no jogo novo ou no Multiball).

### PP-RN-13 Multiball

As 7 letras acesas: **MULTIBALL!**, `PTS.multiball`, as letras apagam e 2 bolas novas entram pelo topo.
Com mais de uma bola na mesa o bumper vale o dobro. A bola só conta como perdida quando cai a última;
quando sobra uma, aparece "FIM DO MULTIBALL".

---

## 7. Minhocão, spinner, estilingues e segura-bola

### PP-RN-14 Minhocão: captura

O buraco no centro (`KICKOUT`) prende a bola que passa a menos de `KICKOUT.r − 1` do centro com
velocidade abaixo de `KICKOUT_MAX_SPEED`: ela fica presa `KICKOUT_HOLD`, vale `PTS.minhocao`
(+`BONUS_PTS.minhocao` no bônus) e o buraco fica "entupido" por `KICKOUT_COOLDOWN` contados da captura
(a bola passa por cima sem cair).

### PP-RN-15 Minhocão: prêmios em ciclo

Ao soltar a bola, o Minhocão dá o **próximo prêmio** do ciclo `AWARDS`: bônus (+`BONUS_PTS.premio` na
base do bônus), letra (acende a próxima letra MOTOBOY apagada; se completar, Multiball), segura-bola
(`SAVER_AWARD_SECONDS`), multiplicador +1 (até `MAX_MULT`), `PTS.premioPontos` pontos, letra, Onda
Verde (mesmo já ativa: recomeça os 15 s e dá os pontos de novo) e bola extra. O ciclo começa num ponto
sorteado quando a mesa é montada e continua de um jogo para o outro.

### PP-RN-16 Bola extra

O prêmio bola extra sai **uma vez por jogo** (depois disso o ciclo pula esse prêmio). A bola extra fica
pendente (chip "Bola extra") e, quando a bola cair, depois do bônus, uma bola nova é servida **sem
avançar o número da bola** ("BOLA EXTRA: LANCE!"). Em tilt ela se perde.

### PP-RN-17 Minhocão: ejeção

A bola sai a `KICK_EJECT_SPEED` em diagonal, alternando o lado a cada captura, com ângulo sorteado
entre `KICK_EJECT_MIN_DEG` e `KICK_EJECT_MIN_DEG + KICK_EJECT_RANGE_DEG` a partir da vertical.

### PP-RN-18 Spinner

Uma roda em cada corredor lateral. A bola que passa faz a roda girar (mais rápido quanto mais rápida a
bola, até 60 rad/s, freando 6 rad/s²) e cada meia volta vale `PTS.spinner`. O spinner não soma ao bônus
de fim de bola e só pontua com o jogo em andamento (não depois do fim de jogo).

### PP-RN-19 Estilingues

Os dois triângulos acima dos flippers chutam a bola que bate na face interna com impacto acima de
`SLING_MIN_HIT`: velocidade de `SLING_KICK` com ±15–25% e ±20° sorteados (evita a bola ficar presa entre
eles), `PTS.estilingue` (+`BONUS_PTS.estilingue` no bônus), no máximo um chute a cada `SLING_COOLDOWN`.

### PP-RN-20 Corredores e guias

Os corredores laterais têm o fundo inclinado que devolve a bola para dentro da mesa; as guias de
entrada levam a bola aos flippers.

### PP-RN-21 Segura-bola

Por `SAVER_SECONDS` depois do primeiro lançamento de cada bola (chip "Segura-bola"), a bola que cai
volta para a rampa **sem perder a bola** ("SEGURA BOLA!"). O tempo só corre com a bola fora da rampa,
então ele continua valendo para o novo lançamento. Não salva em tilt.

---

## 8. Bolas, bônus, fim de jogo e recorde

### PP-RN-22 Bônus de fim de bola

Cada bola acumula uma base: bumper `BONUS_PTS.bumper`, estilingue `BONUS_PTS.estilingue`, alvo
`BONUS_PTS.alvo`, raia `BONUS_PTS.raia`, Minhocão `BONUS_PTS.minhocao`, prêmio bônus
`BONUS_PTS.premio`. Quando a bola é perdida aparece **BÔNUS DA BOLA** com `base × multiplicador` e o
total é somado ao placar (em tilt, `TILT: sem bônus`). A tela fica `BONUS_SECONDS`.

### PP-RN-23 O que zera a cada bola

Ao servir uma bola (nova ou extra): multiplicador volta a ×1, raias apagam, semáforos voltam a vermelho,
Onda Verde, segura-bola, tilt, conta de trancos e base do bônus zeram. Letras MOTOBOY, placar e o
ciclo do Minhocão continuam.

### PP-RN-24 Três bolas e fim de jogo

`BALLS_PER_GAME` = 3 bolas (mais a extra, se ganhar). Depois do bônus da última, **fim de jogo**: os
flippers param e, 1 s depois, aparece **FIM DE JOGO** com os pontos, **Novo recorde!** ou
**Recorde: N**, e os botões **Jogar de novo** (recomeça na bola 1, placar 0, letras apagadas) e
**Menu** (volta ao título).

### PP-RN-25 Recorde

O recorde fica em `localStorage['pinball-paulista:recorde']` e aparece no título e no card do hub.
Quando o placar passa o recorde, o painel mostra **NOVO!** e o recorde é gravado na hora, a cada ponto
(sair no meio da partida — ← Menu, barra do hub — já encontra o recorde salvo). Valor ausente, inválido
ou ≤ 0 conta como sem recorde; com o armazenamento bloqueado o jogo funciona e só não guarda.

---

## 9. Pausa, som, foco e celular

### PP-RN-26 Pausa

P, Esc ou **Pausar** pausam (de novo: continuam). A pausa mostra **PAUSA** com **Continuar** (foco) e
**Menu**. Nada anda na pausa: bola, tempos (segura-bola, onda, bônus, Minhocão) e spinner param.
Não dá para pausar no fim de jogo (o botão fica desabilitado).

### PP-RN-27 Perda de foco

Se a janela perde o foco, o jogo pausa e solta todos os controles (flippers e lançador). Uma carga do
lançador feita antes da pausa dispara ao continuar.

### PP-RN-28 Som

**Som: sim/não** liga e desliga os efeitos (WebAudio sintetizado). A escolha fica em
`localStorage['pinball-paulista:som']` (`off`/`on`) e vale para as próximas partidas.

### PP-RN-29 Celular (≈ 390 px)

Em telas até 860 px os painéis laterais somem e uma faixa acima da mesa mostra pontos, multiplicador e
recorde. A mesa ocupa a largura sem rolagem lateral; as metades da mesa são os flippers (com setas ◀ ▶
em telas de toque) e **Lançar**/**Sacudir** ficam abaixo dela.

### PP-RN-30 Robustez

Quadro com tempo negativo vira 0; quadro gigante é cortado (PP-RN-03). Recorde ou som corrompidos no
armazenamento são ignorados. Montar a tela duas vezes (StrictMode do desenvolvimento) deixa um só laço
de quadros. Sair pela barra **← Sampa Challenges** no meio da partida e voltar abre o título de novo.

---

## 10. Parâmetros

Todos em `game/constants.ts`. Mudou um valor? Atualize esta tabela no mesmo commit.

### Campo e física

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 240 × 400 | campo lógico (canvas 480×800 com `SCALE` = 2 de `game/hires.ts`) |
| `BALL_R` | 5 | raio da bola |
| `GRAVITY` | 430 px/s² | queda ao longo da mesa inclinada |
| `MAX_SPEED` | 900 px/s | velocidade máxima da bola |
| `STEP` | 1/480 s | passo fixo da física (8 subpassos por quadro a 60 fps) |
| `MAX_DT` | 0,05 s | maior `dt` aceito por quadro |
| `MAX_SUBSTEPS` | 40 | subpassos máximos por quadro (sobra descartada) |
| `E_WALL` / `E_FLIPPER` | 0,45 / 0,35 | elasticidade de paredes e flippers |
| `REST_SPEED` | 40 px/s | abaixo disso o quique é zerado (a bola assenta) |
| `DRAIN_Y` | `H + 14` = 414 | abaixo disso a bola é perdida |
| `POST_R` | 3 | raio de referência dos pinos (os pinos usam 2,5–3 em `geometry.ts`) |

### Flippers, bumpers e estilingues

| Parâmetro | Valor | Efeito |
|---|---|---|
| `FLIPPER_LEN` | 36 | comprimento do flipper |
| `FLIPPER_R0` / `FLIPPER_R1` | 6 / 3,6 | raio na base / na ponta (cápsula que afina) |
| `FLIPPER_REST` / `FLIPPER_UP` | +30° / −26° | ângulo em repouso / levantado |
| `FLIPPER_OMEGA_UP` / `FLIPPER_OMEGA_DOWN` | 15 / 9 rad/s | velocidade angular subindo / descendo (ponta a ~540 px/s) |
| `FLIPPER_PIVOT_L` / `FLIPPER_PIVOT_R` | (70, 352) / (152, 352) | pivôs |
| `BUMPER_R` | 11 | raio dos bumpers |
| `BUMPER_KICK` | 270 px/s | velocidade mínima de saída do bumper |
| `SLING_KICK` | 230 px/s | chute do estilingue (±15–25% e ±20° sorteados) |
| `SLING_MIN_HIT` | 40 px/s | impacto mínimo na face do estilingue |
| `SLING_COOLDOWN` | 0,12 s | intervalo entre chutes do mesmo estilingue |
| `TARGET_MIN_HIT` | 25 px/s | impacto mínimo para um alvo MOTOBOY contar |
| `SEMAFORO_HITS` | 3 | batidas por estágio de luz (6 = verde) |

### Lançador, sacudir e regras

| Parâmetro | Valor | Efeito |
|---|---|---|
| `LANE_X`, `LANE_FLOOR_Y`, `BALL_REST_Y` | 223, 396, 391 | bola parada na rampa |
| `PLUNGER_MIN` / `PLUNGER_RANGE` | 430 / 470 px/s | velocidade de saída = mínimo + faixa × carga |
| `PLUNGER_CHARGE_TIME` | 0,9 s | tempo segurando até a carga máxima |
| `PLUNGER_MIN_CHARGE` | 0,06 | carga mínima para disparar |
| `NUDGE_LIMIT` | 3 | trancos seguidos tolerados (o seguinte dá tilt) |
| `NUDGE_COOLDOWN` | 0,18 s | intervalo mínimo entre trancos |
| `NUDGE_DECAY` | 0,25 /s | queda da conta de trancos (1 a cada 4 s) |
| `NUDGE_PUSH_X` / `NUDGE_PUSH_Y` | 55 / 45 px/s | empurrão do tranco (lado sorteado / para cima) |
| `BALLS_PER_GAME` | 3 | bolas por jogo |
| `SAVER_SECONDS` | 12 s | segura-bola depois do lançamento |
| `SAVER_AWARD_SECONDS` | 15 s | segura-bola do prêmio do Minhocão |
| `MAX_MULT` | 5 | multiplicador máximo do bônus |
| `WAVE_SECONDS` | 15 s | duração da Onda Verde |
| `BONUS_SECONDS` | 3,4 s | tela de bônus de fim de bola |

### Minhocão

| Parâmetro | Valor | Efeito |
|---|---|---|
| `KICKOUT` | (111, 232), r 7 | buraco do Minhocão |
| `KICKOUT_HOLD` | 1,1 s | tempo com a bola presa |
| `KICKOUT_COOLDOWN` | 4 s | buraco "entupido" depois da captura |
| `KICKOUT_MAX_SPEED` | 700 px/s | bola mais rápida passa direto |
| `KICK_EJECT_SPEED` | 430 px/s | velocidade de ejeção |
| `KICK_EJECT_MIN_DEG` / `KICK_EJECT_RANGE_DEG` | 25° / 30° | ângulo da ejeção (25–55° da vertical) |
| `AWARDS` | bônus, letra, segura-bola, multiplicador, pontos, letra, onda, extra | ciclo de prêmios |

### Pontos (`PTS`) e bônus (`BONUS_PTS`)

| Evento | `PTS` (placar) | `BONUS_PTS` (base do bônus) |
|---|---|---|
| Bumper | `bumper` 100 (×2 com multiball, ×2 na onda) | `bumper` 10 |
| 6ª batida (semáforo verde) | `semaforoVerde` 500 | — |
| Onda Verde | `ondaVerde` 5000 | — |
| Raia acesa / as 3 | `raia` 100 / `raias` 1000 | `raia` 50 |
| Letra nova / acesa | `letraNova` 500 / `letraAcesa` 50 | `alvo` 100 |
| Multiball | `multiball` 2000 | — |
| Minhocão (captura) | `minhocao` 250 | `minhocao` 100 |
| Prêmio pontos / bônus | `premioPontos` 10000 / — | — / `premio` 2000 |
| Prêmio letra com as 7 acesas | `premioLetraCheia` 3000 | — |
| Spinner (meia volta) | `spinner` 10 | — |
| Estilingue | `estilingue` 10 | `estilingue` 5 |

### Geometria (`game/geometry.ts`)

Paredes são segmentos (a bola é um círculo); a mesa é simétrica em torno de x = 111 (`mx(x) = 222 − x`)
exceto o arco, centrado em x = 120 para incluir a rampa de lançamento (x 214–232). Bumpers em (84, 146),
(138, 146) e (111, 186); raias em y = 58; spinners em y = 160; estilingues entre y 268 e 322; o portão
de mão única `GATE` em x = 214, y 66–100.

---

## 11. Arquitetura

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub (`getRecord: loadRecord`, carregamento preguiçoso do `Game`) |
| `Game.tsx` | raiz: carrega os PNGs e alterna entre `TitleScreen` e `GameScreen` |
| `components/TitleScreen.tsx` | título, recorde, "Como jogar" |
| `components/GameScreen.tsx` | canvas + laço `requestAnimationFrame`, teclado, foco, zonas de toque, painéis, pausa e fim de jogo |
| `game/engine.ts` | `PinballEngine`: física em subpassos, regras, HUD (`onHud`) e desenho |
| `game/constants.ts` | todos os números (seção 10) |
| `game/geometry.ts` | paredes, pinos, bumpers, estilingues, alvos, raias, spinners, portão |
| `game/input.ts` | `Input`: teclado e toque (esquerda, direita, lançador) |
| `game/record.ts` | `loadRecord`/`saveRecord` |
| `game/sound.ts` | efeitos em WebAudio, mudo persistido |
| `game/e2eHook.ts` | gancho dos testes de ponta a ponta (inerte para o jogador) |

Detalhes do motor, armadilhas e receitas: `CLAUDE.md` desta pasta.

---

## 12. Testes

```bash
npm run test:e2e -- e2e/pinball-paulista/                  # suíte rápida do jogo (desktop + celular)
npm run test:e2e -- --project=celular e2e/pinball-paulista/  # só 390 px
npm run test:e2e:longa -- e2e/pinball-paulista/            # piloto: partidas inteiras
npm run test:e2e:cobertura -- --jogo pinball-paulista    # RN do manual × testes
```

Guia da base comum em [`e2e/README.md`](../../../e2e/README.md). Os testes jogam pela tela (teclas,
mouse, toque real no celular) com o relógio sob controle do teste: 1 quadro = 1/60 s, a física roda os
mesmos 8 subpassos e o `Math.random` é semeado, então a mesma semente e os mesmos gestos dão a mesma
partida. O gancho `window.__e2e` (`game/e2eHook.ts`) só lê o estado; para levar a bola a um alvo os testes
usam `prepare.ball`/`prepare.lights`, sempre comentados (o caminho natural fica com o piloto). Cada ação
vira um PNG em `evidencias/` com o estado da mesa no cabeçalho (bola, placar, MOTOBOY, semáforos, bolas na
mesa, segura-bola, tilt).

| Arquivo | Cobertura |
|---|---|
| `e2e/pinball-paulista/navegacao.spec.ts` | título (recorde, Enter/Espaço), HUD, ← Menu, volta ao hub, gancho só na página de teste |
| `e2e/pinball-paulista/flippers.spec.ts` | todas as teclas dos flippers, velocidades de subida/descida, rebote, mouse nas metades da mesa |
| `e2e/pinball-paulista/lancador.spec.ts` | carga e velocidade de saída, carga mínima, lançamento fraco e forte, ↓ e botão Lançar, portão |
| `e2e/pinball-paulista/nudge-tilt.spec.ts` | tranco (só em jogo, empurrão, intervalo, queda da conta), CUIDADO, TILT e suas consequências |
| `e2e/pinball-paulista/semaforos.spec.ts` | pontos do bumper, 6ª batida, Onda Verde (dobro, duração, sem extra durante a onda) |
| `e2e/pinball-paulista/raias.spec.ts` | acender raia, raia acesa, giro pelos flippers, multiplicador até ×5 |
| `e2e/pinball-paulista/motoboy-multiball.spec.ts` | letras nova/acesa, lado do campo, Multiball, bumper em dobro, perda só da última bola |
| `e2e/pinball-paulista/minhocao.spec.ts` | captura, tempo preso, entupido, bola rápida, ejeção, ciclo de prêmios e bola extra única |
| `e2e/pinball-paulista/spinner-estilingue.spec.ts` | spinner, estilingue, fundo do corredor |
| `e2e/pinball-paulista/segura-bola.spec.ts` | bola salva, tempo parado na rampa, perda depois do segura-bola |
| `e2e/pinball-paulista/bonus-fim-bola.spec.ts` | bônus × multiplicador, o que zera por bola, bola extra, 3 bolas, fim de jogo, recorde, Jogar de novo |
| `e2e/pinball-paulista/pausa.spec.ts` | P, Esc e botão, nada anda na pausa, perda de foco, som e sua persistência |
| `e2e/pinball-paulista/bordas.spec.ts` | quadro gigante, storage bloqueado, dados corrompidos, um laço só, sair pela barra e voltar |
| `e2e/pinball-paulista/responsivo.spec.ts` | 390 px (projeto `celular`): layout, toque real nas metades e nos botões |
| `e2e/pinball-paulista/piloto.spec.ts` | projeto `longa`: 3 partidas inteiras (sementes 1–3) e a repetição da mesma semente |

Regra → teste (gerada por `npm run test:e2e:cobertura -- --md pinball-paulista`):

| Regra | Testes |
|---|---|
| PP-RN-01 | `navegacao.spec.ts` |
| PP-RN-02 | `navegacao.spec.ts` |
| PP-RN-03 | `bordas.spec.ts` |
| PP-RN-04 | `flippers.spec.ts`, `lancador.spec.ts` |
| PP-RN-05 | `flippers.spec.ts`, `responsivo.spec.ts` |
| PP-RN-06 | `lancador.spec.ts`, `responsivo.spec.ts` |
| PP-RN-07 | `nudge-tilt.spec.ts`, `responsivo.spec.ts` |
| PP-RN-08 | `nudge-tilt.spec.ts` |
| PP-RN-09 | `semaforos.spec.ts` |
| PP-RN-10 | `semaforos.spec.ts` |
| PP-RN-11 | `raias.spec.ts` |
| PP-RN-12 | `motoboy-multiball.spec.ts` |
| PP-RN-13 | `motoboy-multiball.spec.ts` |
| PP-RN-14 | `minhocao.spec.ts` |
| PP-RN-15 | `minhocao.spec.ts` |
| PP-RN-16 | `bonus-fim-bola.spec.ts`, `minhocao.spec.ts` |
| PP-RN-17 | `minhocao.spec.ts` |
| PP-RN-18 | `bonus-fim-bola.spec.ts`, `spinner-estilingue.spec.ts` |
| PP-RN-19 | `spinner-estilingue.spec.ts` |
| PP-RN-20 | `spinner-estilingue.spec.ts` |
| PP-RN-21 | `segura-bola.spec.ts` |
| PP-RN-22 | `bonus-fim-bola.spec.ts`, `piloto.spec.ts` |
| PP-RN-23 | `bonus-fim-bola.spec.ts` |
| PP-RN-24 | `bonus-fim-bola.spec.ts`, `piloto.spec.ts` |
| PP-RN-25 | `bonus-fim-bola.spec.ts`, `bordas.spec.ts` |
| PP-RN-26 | `pausa.spec.ts` |
| PP-RN-27 | `pausa.spec.ts` |
| PP-RN-28 | `bordas.spec.ts`, `pausa.spec.ts` |
| PP-RN-29 | `responsivo.spec.ts` |
| PP-RN-30 | `bordas.spec.ts` |

---

## 13. Como contribuir

1. Leia o `CLAUDE.md` da raiz e o desta pasta antes de mexer.
2. Regra nova ou mudada: atualize a seção dela neste manual, a tabela de parâmetros e o teste que cita o
   número, no mesmo commit.
3. Números de equilíbrio só em `game/constants.ts`; mexeu em guia, flipper ou parede? Rode o piloto
   (`npm run test:e2e:longa -- e2e/pinball-paulista/`) e procure bola parada fora da rampa/Minhocão.
4. Antes de entregar: `npm run typecheck`, `npm run typecheck:e2e`, `npm run build` e
   `npm run test:e2e -- e2e/pinball-paulista/`.
