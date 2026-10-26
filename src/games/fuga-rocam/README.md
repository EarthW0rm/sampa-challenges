# Fuga da Rocam

Jogo de ação de labirinto visto de cima, em pixel art. Você é o cachorro motoboy: pega um pedido no
**pino amarelo**, entrega no **pino verde** e foge das viaturas da Rocam (carros, motos e, no auge,
um helicóptero). Cada entrega rende pontos e deixa você mais **procurado**. A partida acaba quando a
Rocam pega você 3 vezes. São 3 mapas de São Paulo, cada um com o próprio recorde. 1 jogador,
desktop ou celular (≈ 390 px).

Rota no hub: `#/jogos/fuga-rocam`.

Este README é o **manual** do jogo: toda regra ou mecânica tem um número `FR-RN-NN`, e cada número
tem pelo menos um teste de ponta a ponta que o cita no nome (seção 11). Mudou uma regra? Atualize a
seção dela, a [tabela de parâmetros](#9-parâmetros) e o teste no mesmo commit. Nenhum número de
equilíbrio fica fora da tabela de parâmetros: o texto das regras cita o nome do parâmetro.

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Controles](#2-controles)
3. [Telas e fluxo de uma partida](#3-telas-e-fluxo-de-uma-partida)
4. [Mapas e movimento](#4-mapas-e-movimento)
5. [Turbo e óleo](#5-turbo-e-óleo)
6. [Pedidos](#6-pedidos)
7. [Procurado: calor, estrelas, viaturas e garagem](#7-procurado-calor-estrelas-viaturas-e-garagem)
8. [Captura, vidas, itens, pausa e recorde](#8-captura-vidas-itens-pausa-e-recorde)
9. [Parâmetros](#9-parâmetros)
10. [Arquitetura](#10-arquitetura)
11. [Testes](#11-testes)
12. [Como contribuir](#12-como-contribuir)

---

## 1. Início rápido

1. No hub, abra **Fuga da Rocam** e escolha um mapa (clique no card ou tecle **1**, **2** ou **3**).
2. A partida começa parada (**PRONTO**). Aperte uma **seta** (ou deslize no mapa) para sair.
3. Siga até o **pino amarelo** para pegar o pedido; leve ao **pino verde** para entregar.
4. Fuja das viaturas: as setas escolhem a próxima curva, **Espaço** liga o turbo, **X** solta óleo.
   Se o procurado subir demais, entre numa **garagem** (portão com anel verde) para sumir.
5. Pego 3 vezes, a partida acaba e o recorde do mapa fica guardado.

---

## 2. Controles

| Entrada | Controle | Ação |
|---|---|---|
| Teclado | **Setas** ou **W A S D** | escolhe a direção (vale até a próxima esquina; ver FR-RN-05) |
| Teclado | **Espaço**, **Shift** (esquerdo ou direito), segurados | turbo (FR-RN-09) |
| Teclado | **X**, **Z** ou **E** | solta uma mancha de óleo (FR-RN-10) |
| Teclado | **P** ou **Esc** | pausa / continua (FR-RN-27) |
| Teclado (título) | **1**, **2**, **3** | escolhe o mapa (FR-RN-01) |
| Mouse | botões da barra, dos cards e das caixas | escolher mapa, Som, Pausar, Continuar, Mapas, Jogar de novo |
| Toque | **deslizar** o dedo no mapa | escolhe a direção pelo eixo dominante do deslize (FR-RN-08) |
| Toque | **direcional** ▲ ◀ ▶ ▼ | escolhe a direção (FR-RN-08) |
| Toque | **TURBO** (segurado) e **ÓLEO** | turbo enquanto o dedo está no botão; óleo a cada toque |

O direcional e os botões TURBO/ÓLEO aparecem em tela de toque ou com largura até 860 px; nesse caso a
linha de ajuda do teclado some. Arrastar com o **mouse** no mapa não muda a direção (só o toque).

---

## 3. Telas e fluxo de uma partida

```
Título (3 mapas) ──clique/1-3──▶ Partida: PRONTO ──seta──▶ jogando ──pego──▶ PEGO! (1,5 s)
     ▲                              ▲                         │  ▲                │
     │                              └──── vidas > 0 ──────────┼──┼────────────────┘
     │                                                        │  └── P/Esc/Continuar
     └───────── ← Mapas / Mapas ◀── Fim de jogo ◀── vidas = 0  └──▶ PAUSA
```

- **Título** (`TitleScreen`): nome do jogo, os 3 cards de mapa (miniatura, nome, subtítulo,
  descrição e o recorde do mapa ou "Sem recorde ainda") e a caixa "Como jogar".
- **Partida** (`GameScreen`): barra (← Mapas, nome do mapa, **Som**, **Pausar**), painel (HUD) e o mapa.
  O painel mostra a pontuação, `REC <recorde>` (ou `NOVO RECORDE`), os corações, as 5 estrelas,
  a barra de calor, a barra de turbo (cinza quando travado), o escudo, o óleo (`×n`), o pedido atual
  (`Pedido`/`Frágil`/`Urgente`/`Pesado` · `ir buscar`/`entregar`, e os segundos do urgente), as
  entregas e a mensagem do momento (ou `Escondido · Ns` na garagem).
- **PRONTO** (faixa amarela no mapa e dica "Aperte uma seta"): nada se move até a primeira direção.
- **PEGO!** (faixa vermelha, o cachorro pisca) dura `CAUGHT_PAUSE`; depois volta ao PRONTO ou vai ao fim.
- **PAUSA**: caixa com **Continuar** e **Mapas**.
- **Fim de jogo**: caixa "PEGO PELA ROCAM" com os pontos, as entregas e "Novo recorde!" ou
  "Recorde: N", e os botões **Jogar de novo** e **Mapas**.

---

## 4. Mapas e movimento

### FR-RN-01 Título e escolha do mapa

A tela de título lista os 3 mapas na ordem de `MAPS` (Centro Velho, Avenida Paulista, Marginal
Pinheiros). Clicar num card ou teclar o número dele (**1**–**3**) abre a partida naquele mapa; outras
teclas não fazem nada. Cada card mostra o recorde **do próprio mapa** ("Recorde: N") ou "Sem recorde
ainda". **← Mapas** (na barra ou nas caixas de pausa e de fim) volta ao título.

### FR-RN-02 Mapas e tiles

Cada mapa é uma grade de `COLS` × `ROWS` tiles de `TILE` px (o campo lógico tem `W` × `H`).
Tipos de tile e quem entra em cada um:

| Tile | Nome | Cachorro | Moto da Rocam | Carro da Rocam |
|---|---|---|---|---|
| `#` | prédio | — | — | — |
| `.` | rua | sim | sim | sim |
| `f` | faixa rápida (azul) | sim | sim | sim |
| `o` | praça aberta | sim | sim | sim |
| `b` | beco (paralelepípedo) | sim | sim | — |
| `g` | garagem (portão) | sim | — | — |
| `p` | parque fechado | — | — | — |
| `w` | água (rio) | — | — | — |

| Mapa | Partida (`start`) | Destaques |
|---|---|---|
| Centro Velho (`centro`) | tile (17, 14) | ruas apertadas, quarteirões fechados, Praça da Sé aberta, 6 becos, 7 garagens |
| Avenida Paulista (`paulista`) | tile (17, 7) | duas faixas rápidas no meio (linhas 11 e 12), Parque Trianon fechado, vão do MASP aberto, 6 becos, 8 garagens |
| Marginal Pinheiros (`marginal`) | tile (20, 7) | rio no meio (linhas 9–15) cruzado só por 3 pontes (colunas 9, 20 e 31), duas vias expressas rápidas (linhas 7 e 17), 4 becos, 8 garagens |

As garagens são escolhidas por um sorteio fixo de cada mapa (`seed`): prédios com exatamente uma rua
colada (pontas sem saída), longe da partida e longe umas das outras. O mapa é sempre o mesmo.

### FR-RN-03 Começo da partida (PRONTO)

A partida começa com `START_LIVES` vidas, 1 estrela, calor 0, turbo cheio, 1 óleo
(`OIL_START`), sem escudo, 0 pontos e o primeiro pedido já sorteado. O cachorro fica parado no tile
`start` do mapa, virado para a primeira rua livre na ordem direita, esquerda, baixo, cima. Enquanto
estiver **PRONTO**, nada anda (nem o cachorro, nem viaturas, nem prazos, nem itens); só uma **direção** (seta,
WASD, deslize ou direcional) começa o jogo — turbo e óleo não começam.

### FR-RN-04 Velocidade e faixa rápida

A moto anda `PLAYER_SPEED` px/s. Em faixa rápida (`f`) todos (cachorro e viaturas) andam
`FAST_LANE_MULT` vezes mais rápido. A velocidade vale para o tile mais próximo do veículo.

### FR-RN-05 Direção até a próxima esquina

A direção escolhida fica **guardada**: a moto segue em frente e, no primeiro centro de tile em que
dá para virar para a direção guardada, vira. Sem saída à frente nem na direção guardada, a moto
**para** e espera. A direção guardada continua valendo depois da curva (vira a direção atual).
A direção **oposta** inverte na hora, mesmo no meio do tile (menos para dentro de uma garagem trancada).

### FR-RN-06 Curva antecipada e tardia

Para facilitar a curva, há uma folga de `TURN_TOLERANCE` px: se a direção pedida é lateral e faltam até
`TURN_TOLERANCE` px para o centro da próxima esquina, a moto já vira ali (curva antecipada); se ela
passou do centro há até `TURN_TOLERANCE` px e a lateral está livre, volta ao centro e vira (curva
tardia).

### FR-RN-07 Becos e praças

Becos (`b`) são atalhos que só o cachorro e as motos da Rocam usam; carros não entram. Praças
abertas (`o`) e ruas valem para todos. Prédio, parque e água bloqueiam todos.

### FR-RN-08 Controles de toque

Deslizar o dedo no mapa por pelo menos `SWIPE_MIN` px de tela escolhe a direção pelo eixo dominante
(horizontal: direita/esquerda; vertical: baixo/cima); um deslize longo vale de novo a cada
`SWIPE_MIN` px. O direcional ▲ ◀ ▶ ▼ escolhe a direção ao tocar. **TURBO** liga o turbo enquanto o
dedo estiver no botão (solta ao levantar, cancelar ou sair dele); **ÓLEO** solta uma mancha por toque.

---

## 5. Turbo e óleo

### FR-RN-09 Turbo

Segurar **Espaço**/**Shift** (ou **TURBO**) multiplica a velocidade da moto por `TURBO_MULT` e gasta o
tanque (0 a 1) a `TURBO_DRAIN` por segundo, mesmo parado numa parede. Solto, o tanque recarrega
`TURBO_RECHARGE` por segundo. Se o tanque **zerar**, o turbo **trava** (barra cinza) até recarregar
`TURBO_MIN_RESTART`. Não há turbo escondido na garagem nem levando pedido **frágil** (FR-RN-13).

### FR-RN-10 Óleo

**X**/**Z**/**E** (ou **ÓLEO**) solta uma mancha logo atrás da moto (`OIL_BACK` px), se houver óleo
(começa com `OIL_START`, máximo `OIL_MAX`) e o cachorro não estiver escondido. A mancha dura
`OIL_TIME` s; a primeira viatura ativa que passar a até `OIL_RADIUS` px dela **derrapa** e fica parada
`OIL_STUN` s, e a mancha some. O cachorro não derrapa no próprio óleo.

---

## 6. Pedidos

### FR-RN-11 Pegar e entregar

Há sempre um pedido (ou um prestes a chegar). O pino de **coleta** (amarelo) é sorteado numa rua ou
faixa (`.`/`f`) a uma distância de caminho entre `JOB_PICKUP_DIST` tiles do cachorro; o de
**entrega** (verde), a uma distância entre `JOB_DROP_DIST` tiles da coleta. Passar a até
`JOB_RADIUS` px do centro do pino amarelo coleta o pedido; depois, passar a até `JOB_RADIUS` px do
pino verde entrega (nada disso acontece escondido). Coletado, a moto mostra a
caixa colorida do tipo de pedido. Depois da entrega, o próximo pedido chega em `NEXT_JOB_DELAY` s
("Novo pedido!" ou "Pedido <tipo>!").

### FR-RN-12 Tipos de pedido

O tipo é sorteado ao criar o pedido, com pesos `JOB_WEIGHTS`: só **normal** no começo; **frágil**
entra a partir de `JOB_UNLOCK.fragil` entregas, **urgente** a partir de `JOB_UNLOCK.urgente` e
**pesado** a partir de `JOB_UNLOCK.pesado`. Os pontos-base de cada tipo estão em `POINTS`.

### FR-RN-13 Frágil

Levando um pedido frágil, o turbo não liga (mensagem "Frágil: sem turbo!") e o tanque recarrega.
Vale `POINTS.fragil` (o dobro do normal).

### FR-RN-14 Urgente: prazo e bônus

Ao coletar um urgente, começa um prazo de `max(URGENT_MIN, tiles × TILE / PLAYER_SPEED × URGENT_FACTOR +
URGENT_EXTRA)` s, onde `tiles` é a distância de caminho da coleta à entrega. O painel mostra os
segundos (em vermelho nos últimos 5). O prazo só corre jogando (para no PRONTO, na pausa e no PEGO!).
Entregue no prazo: `POINTS.urgente` mais `TIME_BONUS_PER_SEC` por segundo inteiro que sobrou. Prazo
esgotado: "Atrasou! Pedido perdido", o pedido some sem pontos, o calor sobe `LATE_HEAT` e o próximo
pedido chega em `LATE_JOB_DELAY` s.

### FR-RN-15 Pesado

Levando um pedido pesado, a moto anda `HEAVY_MULT` vezes a velocidade (o turbo ainda multiplica).
Vale `POINTS.pesado` e a entrega soma `HEAVY_HEAT` de calor além do normal.

### FR-RN-16 Pontos da entrega

`pontos = arredonda(POINTS[tipo] × (1 + STAR_POINTS × (estrelas − 1)) + bônus do urgente)`, com as
estrelas do momento da entrega. A entrega soma 1 em "Entregas" e `HEAT_DELIVERY` de calor.

---

## 7. Procurado: calor, estrelas, viaturas e garagem

### FR-RN-17 Calor e estrelas

O calor vai de 0 a `HEAT_MAX` e define as estrelas: `estrelas = 1 + min(4, piso(calor / HEAT_PER_STAR))`
(1 a 5). Jogando, a cada segundo: visto por alguma viatura (ou pela luz do helicóptero) o calor sobe
`HEAT_SEEN`; fora de vista cai `HEAT_COOL`; escondido na garagem cai `HEAT_COOL_HIDDEN`. Cada entrega
soma `HEAT_DELIVERY` (FR-RN-16). Mudou de estrela: "Procurado: N estrelas!".

### FR-RN-18 Visão e rádio

Uma viatura **vê** o cachorro quando a distância de caminho (pela malha da classe dela) é de até
`SIGHT_TILES` tiles, ela já está visível (`COP_SEE_ALPHA`) e não está indo embora; escondido, ninguém
vê. A última posição vista vale pelo rádio por `RADIO_MEMORY` s (o dobro com 4 ou mais estrelas):
enquanto valer, as viaturas vão atrás dela; depois, rondam.

### FR-RN-19 Viaturas por estrela

A quantidade de viaturas segue `QUOTA` por estrela (carros, motos, helicóptero). Falta viatura: nasce
uma a cada `SPAWN_INTERVAL` s (a primeira `SPAWN_FIRST` s depois de começar e `SPAWN_AFTER_CATCH` s
depois de ser pego), num tile da classe dela, de preferência a `SPAWN_MIN_DIST` tiles de caminho ou
mais (fora de praça aberta), aparecendo aos poucos. Sobra viatura (as estrelas caíram): uma que não
está vendo e está a mais de `LEAVE_DIST` tiles vai embora (some aos poucos).

### FR-RN-20 Personas e velocidade das viaturas

Os carros entram na ordem de `PERSONAS.car` (perseguidor, bloqueador, perseguidor) e as motos na de
`PERSONAS.moto` (rápida, emboscada). **Perseguidor** e **rápida** vão para a última posição conhecida;
**bloqueador** vai para `BLOCK_AHEAD` tiles à frente do cachorro (ou direto nele se a até
`BLOCK_NEAR` tiles); **emboscada** espera no pino do pedido atual (ou vai direto se a até
`AMBUSH_NEAR` tiles). Sem pista, todas rondam. Em cada esquina escolhem o vizinho mais perto do alvo
(sem dar meia-volta, com um pouco de sorteio). Velocidade: `CAR_SPEED` (carro) ou `MOTO_SPEED` (moto;
×`FAST_MOTO_MULT` na rápida) × (1 + `COP_STAR_BONUS` × (estrelas − 1)) × faixa rápida; atrás de outra
viatura muito perto, metade.

### FR-RN-21 Helicóptero

Com 5 estrelas (`QUOTA[5].heli`) entra um helicóptero pelo canto mais longe ("Helicóptero na área!").
Ele voa direto até o cachorro a `HELI_SPEED` px/s, ignorando o mapa, e a luz dele (raio `HELI_LIGHT`
px) conta como "visto". Ele não prende ninguém. Abaixo de 5 estrelas ele vai embora.

### FR-RN-22 Garagem

Entrar numa garagem (tile `g`, ponta sem saída) **esconde** o cachorro ("Escondido na garagem"): a
moto fica meio transparente, ninguém vê, ninguém prende, o calor cai `HEAT_COOL_HIDDEN` por segundo e
não há turbo, óleo, coleta, entrega nem item. O painel mostra `Escondido · Ns`. O máximo é `HIDE_MAX` s:
depois a moto sai sozinha. Ao sair (sozinho ou de propósito), todas as garagens **trancam** por
`GARAGE_COOLDOWN` s (anel vermelho) e viram parede para o cachorro.

---

## 8. Captura, vidas, itens, pausa e recorde

### FR-RN-23 Captura e vidas

Uma viatura ativa (visível ao menos `COP_CATCH_ALPHA`, sem derrapar, sem ir embora) a até `CATCH_DIST`
px do cachorro o **pega**, salvo se ele estiver escondido ou invulnerável. Pego: perde 1 vida, faixa
**PEGO!** por `CAUGHT_PAUSE` s. Com vidas, a rodada recomeça: viaturas, helicóptero, manchas e rádio
somem, o calor cai pela metade (`CATCH_HEAT_KEEP`), as estrelas são recalculadas, o cachorro volta ao
`start` com `INVULN_TIME` s de invulnerabilidade (piscando), as garagens destrancam e a fase volta ao
PRONTO ("Foge!"). Pontos, entregas, itens no chão e o pedido em andamento continuam. Sem vidas: fim de
jogo (FR-RN-28).

### FR-RN-24 Capacete (escudo)

Com o capacete (anel azul na moto, chip "escudo"), a próxima captura não acontece: o capacete se
gasta, a viatura fica parada `SHIELD_STUN` s e o cachorro fica `SHIELD_INVULN` s invulnerável ("O
capacete salvou!"). Pegar outro capacete com escudo não acumula.

### FR-RN-25 Itens no mapa

Um item nasce a cada `ITEM_INTERVAL` s (o primeiro `ITEM_FIRST` s depois do começo) enquanto houver
menos de `MAX_ITEMS` no mapa, numa rua ou faixa a pelo menos `ITEM_MIN_DIST` tiles de caminho do
cachorro. Dura `ITEM_LIFETIME` s (pisca nos últimos 5) e some. Sorteio com pesos `ITEM_WEIGHTS`; a
vida só entra com menos de `MAX_LIVES` vidas. Passar a até `ITEM_RADIUS` px pega o item (não
escondido).

### FR-RN-26 Efeito de cada item

| Item | Efeito |
|---|---|
| turbo | tanque + `TURBO_ITEM` (até 1) e destrava o turbo |
| óleo | + 1 óleo (até `OIL_MAX`) |
| capacete | escudo (FR-RN-24) |
| pizza | + `PIZZA_POINTS` pontos na hora |
| vida | + 1 vida (até `MAX_LIVES`) |

### FR-RN-27 Pausa

**P**, **Esc** ou o botão **Pausar** pausam (no PRONTO, jogando ou no PEGO!); de novo, ou **Continuar**,
voltam à fase em que estava. Perder o foco da janela também pausa. Pausar solta as teclas e
esquece a direção guardada: ao continuar, a moto segue na direção em que estava até a próxima seta
(se pausou no PRONTO, continua PRONTO). Na pausa nada anda. **Mapas** sai para o
título. No fim de jogo não há pausa (botão desabilitado).

### FR-RN-28 Fim de jogo

Com 0 vidas, a fase vira fim de jogo; `OVER_DELAY` depois aparece a caixa "PEGO PELA ROCAM" com os
pontos e as entregas ("1 entrega"/"N entregas"). **Jogar de novo** recomeça no mesmo mapa
(FR-RN-03); **Mapas** volta ao título.

### FR-RN-29 Pontuação e recorde por mapa

A pontuação soma as entregas (FR-RN-16) e as pizzas (FR-RN-26). O recorde é **por mapa**, na chave
`fuga-rocam:recorde:<mapa>` (`centro`, `paulista`, `marginal`), e é gravado quando a pontuação passa o
recorde: no fim de jogo, em **Jogar de novo** e ao **sair da partida** (← Mapas, Mapas ou ← Sampa
Challenges) — sair no meio também vale. Durante a partida o painel mostra `REC` com o maior entre o
recorde e a pontuação; quando já havia recorde (maior que 0) e a pontuação passa dele, mostra
**NOVO RECORDE** e a caixa de fim diz "Novo recorde!". Na primeira partida do mapa (sem recorde) não há
"novo recorde": a caixa mostra "Recorde: N". O card do hub mostra o **maior** recorde entre os mapas.
Valor gravado inválido, zero ou negativo conta como sem recorde.

### FR-RN-30 Som

Efeitos sintetizados (sirene pela viatura mais próxima, hélice, coleta, entrega, estrelas, captura).
O botão **Som: sim/não** liga e desliga na hora e grava em `fuga-rocam:som` (`on`/`off`); o som começa
ligado se nada estiver gravado. Pausa, captura e saída silenciam a sirene.

### FR-RN-31 Robustez

O passo do jogo é limitado a `DT_MAX` s por quadro (um quadro atrasado, como na volta de uma aba em
segundo plano, não teleporta nada; tempo negativo vira 0). Com o armazenamento bloqueado (modo
privado), o jogo abre e joga sem recorde nem preferência de som. Montar a partida duas vezes (modo de
desenvolvimento) mantém um único laço de quadros.

### FR-RN-32 Celular

Em 390 px de largura não há rolagem lateral; o mapa ocupa a largura, o painel continua legível e o
direcional e os botões TURBO/ÓLEO aparecem (FR-RN-08).

---

## 9. Parâmetros

Valores de `game/constants.ts` (constantes exportadas), do topo de `game/engine.ts` e dos poucos
literais que ficaram no motor e nas telas. **Mudou um número? Atualize esta tabela.**

### 9.1 `game/constants.ts`

| Parâmetro | Valor | Efeito |
|---|---|---|
| `TILE` | 16 | lado do tile (px lógicos) |
| `COLS`, `ROWS` | 40 × 25 | grade de tiles do mapa |
| `W`, `H` | 640 × 400 | campo lógico (`COLS·TILE` × `ROWS·TILE`) |
| `PLAYER_SPEED` | 84 px/s | velocidade da moto (FR-RN-04) |
| `TURBO_MULT` | 1,38 | multiplicador do turbo (FR-RN-09) |
| `FAST_LANE_MULT` | 1,22 | multiplicador da faixa rápida, para todos (FR-RN-04) |
| `HEAVY_MULT` | 0,86 | multiplicador levando pedido pesado (FR-RN-15) |
| `CAR_SPEED` | 70 px/s | carro da Rocam (FR-RN-20) |
| `MOTO_SPEED` | 80 px/s | moto da Rocam (FR-RN-20) |
| `COP_STAR_BONUS` | 0,035 | velocidade extra das viaturas por estrela acima de 1 |
| `HELI_SPEED` | 46 px/s | helicóptero (FR-RN-21) |
| `TURBO_DRAIN` | 0,42 /s | gasto do tanque com turbo |
| `TURBO_RECHARGE` | 0,1 /s | recarga do tanque sem turbo |
| `TURBO_MIN_RESTART` | 0,25 | tanque mínimo para destravar depois de zerar |
| `TURBO_ITEM` | 0,55 | tanque somado pelo item turbo |
| `START_LIVES` | 3 | vidas no começo |
| `MAX_LIVES` | 5 | teto de vidas (item vida) |
| `CATCH_DIST` | 11 px | distância de captura |
| `INVULN_TIME` | 2,5 s | invulnerável depois de ser pego |
| `HIDE_MAX` | 4 s | tempo máximo escondido na garagem |
| `GARAGE_COOLDOWN` | 6 s | garagens trancadas depois de sair |
| `TURN_TOLERANCE` | 5 px | folga da curva antecipada/tardia (FR-RN-06) |
| `HEAT_MAX` | 100 | calor máximo |
| `HEAT_PER_STAR` | 20 | calor por estrela |
| `HEAT_DELIVERY` | 16 | calor somado por entrega |
| `HEAT_SEEN` | 2,4 /s | calor que sobe à vista |
| `HEAT_COOL` | 3,2 /s | calor que cai fora de vista |
| `HEAT_COOL_HIDDEN` | 10 /s | calor que cai escondido |
| `SIGHT_TILES` | 9 | alcance da visão (tiles de caminho) |
| `RADIO_MEMORY` | 9 s | memória do rádio (×2 com 4+ estrelas) |
| `OIL_TIME` | 22 s | duração da mancha de óleo |
| `OIL_STUN` | 2,6 s | viatura parada pelo óleo |
| `MAX_ITEMS` | 3 | itens ao mesmo tempo no mapa |
| `ITEM_INTERVAL` | 9 s | intervalo entre itens |
| `ITEM_LIFETIME` | 28 s | duração de um item no chão |
| `SHIELD_STUN` | 1,6 s | viatura parada pelo capacete |
| `POINTS` | normal 100, frágil 200, urgente 250, pesado 300 | pontos-base da entrega |
| `PIZZA_POINTS` | 150 | pontos da pizza |
| `TIME_BONUS_PER_SEC` | 12 | bônus por segundo que sobrou no urgente |
| `JOB_RADIUS` | 9 px | alcance da coleta e da entrega (FR-RN-11) |
| `JOB_PICKUP_DIST` | 12 a 40 tiles | distância de caminho do cachorro à coleta (60 tentativas; senão qualquer rua) |
| `JOB_DROP_DIST` | 20 a 60 tiles | distância de caminho da coleta à entrega (80 tentativas; senão qualquer rua) |
| `NEXT_JOB_DELAY` / `LATE_JOB_DELAY` | 1,2 s / 1,5 s | próximo pedido depois de entregar / de perder o urgente |
| `JOB_UNLOCK` | frágil 2, urgente 3, pesado 4 entregas | a partir de quantas entregas o tipo entra no sorteio |
| `URGENT_MIN` / `URGENT_FACTOR` / `URGENT_EXTRA` | 10 s / 1,4 / 8 s | prazo do urgente (FR-RN-14) |
| `LATE_HEAT` | 8 | calor somado ao perder o urgente |
| `HEAVY_HEAT` | 8 | calor extra da entrega pesada |
| `STAR_POINTS` | 0,25 | pontos extras por estrela acima de 1 (fração) |
| `OIL_START` / `OIL_MAX` | 1 / 3 | óleo no começo / máximo |
| `OIL_BACK` / `OIL_RADIUS` | 6 px / 10 px | onde a mancha cai / alcance da derrapada |
| `ITEM_FIRST` | 4,5 s (`ITEM_INTERVAL` × 0,5) | primeiro item |
| `ITEM_MIN_DIST` / `ITEM_RADIUS` | 6 tiles / 10 px | onde o item nasce / alcance para pegar |
| `SHIELD_INVULN` | 1 s | invulnerável depois do capacete |
| `CAUGHT_PAUSE` | 1,5 s | duração do PEGO! |
| `CATCH_HEAT_KEEP` | 0,5 | fração do calor que fica depois de ser pego |
| `SPAWN_FIRST` / `SPAWN_AFTER_CATCH` | 1 s / 2 s | espera até a primeira viatura no começo / depois de ser pego |
| `DT_MAX` | 0,05 s | teto do passo do motor por quadro (o laço da tela já corta em 0,1 s) |

### 9.2 Topo de `game/engine.ts`

| Parâmetro | Valor | Efeito |
|---|---|---|
| `QUOTA` | 1★: 1 carro · 2★: 1 carro, 1 moto · 3★: 2 carros, 1 moto · 4★: 2 carros, 2 motos · 5★: 3 carros, 2 motos, 1 helicóptero | viaturas por estrela (FR-RN-19) |
| `PERSONAS` | carro: perseguidor, bloqueador, perseguidor · moto: rápida, emboscada | ordem das personas (FR-RN-20) |
| `SPAWN_MIN_DIST` | 16 tiles | distância de caminho preferida para nascer |
| `SPAWN_INTERVAL` | 2,2 s | intervalo entre viaturas novas |
| `HELI_LIGHT` | 46 px | raio da luz do helicóptero |
| `CARGO_COLOR` | normal amarelo, frágil azul, urgente vermelho, pesado lilás | cor da caixa na moto (só visual) |

### 9.3 Literais do motor e das telas

| Nome neste manual | Valor | Onde | Efeito |
|---|---|---|---|
| `JOB_WEIGHTS` | normal 3, frágil 2, urgente 2, pesado 2 | `engine.weightedKind` | pesos do sorteio do tipo |
| `ITEM_WEIGHTS` | turbo 3, óleo 3, capacete 2, pizza 3, vida 1 | `engine.updateItems` | pesos do sorteio do item |
| `COP_SEE_ALPHA` / `COP_CATCH_ALPHA` | 0,5 / 0,9 | `engine.updateCops`, `checkCaught` | visibilidade mínima da viatura para ver / para prender (aparece a +1 por s) |
| `FAST_MOTO_MULT` | 1,06 | `engine.updateCops` | moto "rápida" |
| `BLOCK_AHEAD` / `BLOCK_NEAR` / `AMBUSH_NEAR` | 4 / 5 / 6 tiles | `engine.copTarget` | alvos do bloqueador e da emboscada |
| `LEAVE_DIST` | 14 tiles | `engine.manageQuota` | viatura excedente só sai se mais longe que isso (ou sem caminho) |
| `SWIPE_MIN` | 18 px de tela | `GameScreen` | deslize mínimo |
| `OVER_DELAY` | 900 ms | `GameScreen` | atraso da caixa de fim de jogo |
| `SCALE` (`game/hires.ts`) | 2 | `hires.ts` | canvas 1280×800, sprites em alta (Scale2x) |
| `MASTER_VOLUME` | 0,5 | `sound.ts` | volume geral do som |

---|---|---|---|
| `DT_MAX` | 0,05 s | `engine.update` | teto do passo por quadro (o laço da tela já corta em 0,1 s) |
| `OIL_START` / `OIL_MAX` | 1 / 3 | `reset`, item óleo | óleo no começo / máximo |
| `OIL_BACK` / `OIL_RADIUS` | 6 px / 10 px | `updateOil` | onde a mancha cai / alcance da derrapada |
| `JOB_RADIUS` | 9 px | `updateJob` | alcance da coleta e da entrega |
| `JOB_PICKUP_DIST` | 12 a 40 tiles | `newJob` | distância de caminho do cachorro à coleta (60 tentativas; senão qualquer rua) |
| `JOB_DROP_DIST` | 20 a 60 tiles | `newJob` | distância de caminho da coleta à entrega (80 tentativas; senão qualquer rua) |
| `NEXT_JOB_DELAY` / `LATE_JOB_DELAY` | 1,2 s / 1,5 s | `updateJob` | próximo pedido depois de entregar / de atrasar |
| `JOB_WEIGHTS` | normal 3, frágil 2, urgente 2, pesado 2 | `weightedKind` | pesos do sorteio do tipo |
| `JOB_UNLOCK` | frágil 2, urgente 3, pesado 4 entregas | `weightedKind` | a partir de quantas entregas o tipo entra no sorteio |
| `URGENT_MIN` / `URGENT_FACTOR` / `URGENT_EXTRA` | 10 s / 1,4 / 8 s | `updateJob` | prazo do urgente (FR-RN-14) |
| `LATE_HEAT` | 8 | `updateJob` | calor somado ao perder o urgente |
| `HEAVY_HEAT` | 8 | `updateJob` | calor extra da entrega pesada |
| `STAR_POINTS` | 0,25 | `updateJob` | pontos extras por estrela acima de 1 (fração) |
| `COP_SEE_ALPHA` / `COP_CATCH_ALPHA` | 0,5 / 0,9 | `updateCops`, `checkCaught` | visibilidade mínima da viatura para ver / para prender (aparece a +1 por s) |
| `FAST_MOTO_MULT` | 1,06 | `updateCops` | moto "rápida" |
| `BLOCK_AHEAD` / `BLOCK_NEAR` / `AMBUSH_NEAR` | 4 / 5 / 6 tiles | `copTarget` | alvos do bloqueador e da emboscada |
| `LEAVE_DIST` | 14 tiles | `manageQuota` | viatura excedente só sai se mais longe que isso (ou sem caminho) |
| `SPAWN_FIRST` / `SPAWN_AFTER_CATCH` | 1 s / 2 s | `reset`, `afterCaught` | espera até a primeira viatura |
| `ITEM_FIRST` | 4,5 s (`ITEM_INTERVAL` × 0,5) | `reset` | primeiro item |
| `ITEM_MIN_DIST` / `ITEM_RADIUS` | 6 tiles / 10 px | `updateItems` | onde o item nasce / alcance para pegar |
| `ITEM_WEIGHTS` | turbo 3, óleo 3, capacete 2, pizza 3, vida 1 | `updateItems` | pesos do sorteio do item |
| `SHIELD_INVULN` | 1 s | `checkCaught` | invulnerável depois do capacete |
| `CAUGHT_PAUSE` | 1,5 s | `update` | duração do PEGO! |
| `CATCH_HEAT_KEEP` | 0,5 | `afterCaught` | fração do calor que fica depois de ser pego |
| `SWIPE_MIN` | 18 px de tela | `GameScreen` | deslize mínimo |
| `OVER_DELAY` | 900 ms | `GameScreen` | atraso da caixa de fim de jogo |
| `SCALE` (`game/hires.ts`) | 2 | `hires.ts` | canvas 1280×800, sprites em alta (Scale2x) |
| `MASTER_VOLUME` | 0,5 | `sound.ts` | volume geral do som |

---

## 10. Arquitetura

Mapa dos arquivos e receitas no [`CLAUDE.md`](./CLAUDE.md) do jogo.

```
TitleScreen ──onStart(mapa)──▶ GameScreen ──cria no useEffect──▶ FugaEngine(assets, Input, setHud, mapa, semente)
                                  │  teclado/toque → Input (want, turbo, óleo)        │ update(dt) / render(ctx)
                                  └──────────── HUD (React) ◀── onHud(HudState) ◀─────┘
```

| Camada | Arquivo | Papel |
|---|---|---|
| Mapas | `game/maps.ts` | tiles de cada mapa, `canEnter` por classe, garagens automáticas |
| Navegação | `game/nav.ts` | campos de distância (BFS) por classe e alvo, com cache |
| Motor | `game/engine.ts` | movimento por grade, viaturas, calor, pedidos, itens, captura, desenho |
| Entrada | `game/input.ts` | direção guardada, turbo, óleo |
| Arte | `game/mapArt.ts`, `game/assets.ts`, `game/hires.ts`, `game/pixelFont.ts` | camada do mapa, sprites, alta resolução, texto em pixel |
| Som | `game/sound.ts` | WebAudio sintetizado, chave `fuga-rocam:som` |
| Recorde | `game/record.ts` | `fuga-rocam:recorde:<mapa>` e `bestRecord` do card |
| Testes | `game/e2eHook.ts` | gancho de leitura dos testes de ponta a ponta (inerte para o jogador) |

---

## 11. Testes

Testes de ponta a ponta no navegador (Playwright), na raiz do repositório. Guia geral em
[`e2e/README.md`](../../../e2e/README.md); detalhes do gancho e do piloto no [`CLAUDE.md`](./CLAUDE.md).

```bash
npm run test:e2e -- e2e/fuga-rocam/                    # suíte rápida do jogo (desktop + 390 px)
npm run test:e2e -- -g "FR-RN-14"                      # uma regra pelo número
caffeinate -dimsu npm run test:e2e:longa -- e2e/fuga-rocam/   # piloto: os 3 mapas até o fim (~2–3 min)
npm run test:e2e:cobertura -- --jogo fuga-rocam        # toda FR-RN tem teste?
```

Os testes jogam pela tela (setas, Espaço, X, P/Esc, cliques, toque no direcional, deslize no mapa). O relógio é
controlado (1 quadro = 1/60 s, tempo virtual) e a semente do motor segue a do teste: mesma semente, mesma
partida. Cada ação vira um PNG em `evidencias/` com o estado da partida no cabeçalho (mapa, pontos,
vidas, estrelas/calor, pedido, itens, posição, viaturas). Pré-condições raras (calor, item, viatura ou
tipo de pedido num lugar certo) usam o `prepare` do gancho, sempre comentado no teste.

| Arquivo | Cobertura |
|---|---|
| `e2e/fuga-rocam/navegacao.spec.ts` | título, 3 mapas com recorde, escolha por clique e tecla, ← Mapas, volta ao hub |
| `e2e/fuga-rocam/movimento.spec.ts` | tiles e garagens dos 3 mapas, PRONTO, velocidade e faixa rápida, direção guardada, parede, meia-volta, curva antecipada/tardia, becos |
| `e2e/fuga-rocam/turbo-oleo.spec.ts` | turbo (velocidade, gasto, trava e recarga), óleo (mancha, derrapada, sem óleo) |
| `e2e/fuga-rocam/pedidos.spec.ts` | coleta, entrega, distâncias, tipos liberados, pontos por estrela, frágil, urgente (prazo, bônus, atraso), pesado |
| `e2e/fuga-rocam/procurado.spec.ts` | calor à vista e fora dela, estrelas, visão, viaturas por estrela, personas, helicóptero, saída do excedente, garagem |
| `e2e/fuga-rocam/captura-escudo.spec.ts` | captura, vidas, PEGO!, recomeço, invulnerabilidade, capacete |
| `e2e/fuga-rocam/itens.spec.ts` | surgimento, teto e duração dos itens; efeito de cada item |
| `e2e/fuga-rocam/pausa.spec.ts` | P, Esc, botão, perda de foco, Continuar, Mapas |
| `e2e/fuga-rocam/recorde.spec.ts` | fim de jogo, recorde por mapa, novo recorde, sair no meio, valor inválido, card do hub, som |
| `e2e/fuga-rocam/bordas.spec.ts` | determinismo, quadro gigante, laço único, saída pelo hub e volta, storage bloqueado, dado corrompido, arraste de mouse |
| `e2e/fuga-rocam/responsivo.spec.ts` | 390 px (projeto `celular`): sem rolagem lateral, HUD, direcional, deslize, TURBO, ÓLEO |
| `e2e/fuga-rocam/piloto.spec.ts` | projeto `longa`: os 3 mapas até acabar as vidas (≥ 3 estrelas), placar recalculado, recorde, card do hub, mesma semente = mesma partida |

Regra → teste (gerada por `npm run test:e2e:cobertura -- --md fuga-rocam`):

| Regra | Testes |
|---|---|
| FR-RN-01 | `navegacao.spec.ts` |
| FR-RN-02 | `movimento.spec.ts` |
| FR-RN-03 | `movimento.spec.ts` |
| FR-RN-04 | `movimento.spec.ts` |
| FR-RN-05 | `movimento.spec.ts` |
| FR-RN-06 | `movimento.spec.ts` |
| FR-RN-07 | `movimento.spec.ts` |
| FR-RN-08 | `bordas.spec.ts`, `responsivo.spec.ts` |
| FR-RN-09 | `turbo-oleo.spec.ts` |
| FR-RN-10 | `turbo-oleo.spec.ts` |
| FR-RN-11 | `pedidos.spec.ts` |
| FR-RN-12 | `pedidos.spec.ts` |
| FR-RN-13 | `pedidos.spec.ts` |
| FR-RN-14 | `pedidos.spec.ts` |
| FR-RN-15 | `pedidos.spec.ts` |
| FR-RN-16 | `pedidos.spec.ts` |
| FR-RN-17 | `procurado.spec.ts` |
| FR-RN-18 | `procurado.spec.ts` |
| FR-RN-19 | `procurado.spec.ts` |
| FR-RN-20 | `procurado.spec.ts` |
| FR-RN-21 | `procurado.spec.ts` |
| FR-RN-22 | `procurado.spec.ts` |
| FR-RN-23 | `captura-escudo.spec.ts`, `piloto.spec.ts` |
| FR-RN-24 | `captura-escudo.spec.ts` |
| FR-RN-25 | `itens.spec.ts` |
| FR-RN-26 | `itens.spec.ts` |
| FR-RN-27 | `pausa.spec.ts` |
| FR-RN-28 | `piloto.spec.ts`, `recorde.spec.ts` |
| FR-RN-29 | `bordas.spec.ts`, `piloto.spec.ts`, `recorde.spec.ts` |
| FR-RN-30 | `recorde.spec.ts` |
| FR-RN-31 | `bordas.spec.ts` |
| FR-RN-32 | `responsivo.spec.ts` |

---

## 12. Como contribuir

1. Leia o [`CLAUDE.md` da raiz](../../../CLAUDE.md) (CSS escopado em `.fuga-rocam`, assets na pasta do
   jogo, manifest leve, StrictMode, `dt` do quadro) e o [`CLAUDE.md` do jogo](./CLAUDE.md).
2. Ache a regra pelo número (`FR-RN-NN`) e o teste que a cita (seção 11).
3. Mudou regra, mecânica ou número? Atualize a seção da regra, a [tabela de parâmetros](#9-parâmetros)
   e o teste no mesmo commit.
4. Mexeu num mapa? Confira que ele continua conexo para as três classes (cachorro, moto, carro) e que as
   garagens seguem sendo pontas sem saída.
5. Antes de entregar: `npm run typecheck`, `npm run typecheck:e2e`, `npm run build`,
   `npm run test:e2e -- fuga-rocam/` e, se mudou equilíbrio, `npm run test:e2e:longa -- fuga-rocam/`.
   Teste no navegador em desktop e a ≈ 390 px; a barra "← Sampa Challenges" volta ao hub.
