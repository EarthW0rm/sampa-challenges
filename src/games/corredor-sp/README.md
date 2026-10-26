# Corredor SP

Enduro de motoboy em pixel art, com visão por trás da moto (pseudo-3D, como os jogos de corrida
dos anos 80/90). Não há linha de chegada: você costura o trânsito de uma avenida de São Paulo, pega
pacotes e tenta durar o máximo possível com 3 vidas. 1 jogador, desktop (teclado) ou celular (botões
na tela, ≈ 390 px).

Rota no hub: `#/jogos/corredor-sp`. Este README é o **manual** do jogo: toda regra ou mecânica tem um
número `CS-RN-NN`, e cada número tem pelo menos um teste de ponta a ponta que o cita no nome
([seção 15](#15-testes)). Mudou uma regra? Atualize a seção dela, a tabela de parâmetros e o teste no
mesmo commit.

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Controles](#2-controles)
3. [Telas e fluxo de um turno](#3-telas-e-fluxo-de-um-turno)
4. [Escolha da moto e da pista](#4-escolha-da-moto-e-da-pista)
5. [Pilotagem](#5-pilotagem)
6. [Vidas, batidas e colisão](#6-vidas-batidas-e-colisão)
7. [Faixas, corredores, ultrapassagem e grau](#7-faixas-corredores-ultrapassagem-e-grau)
8. [Capacete e itens](#8-capacete-e-itens)
9. [Progressão: nível, densidade, dia e garoa](#9-progressão-nível-densidade-dia-e-garoa)
10. [Trânsito e perigos](#10-trânsito-e-perigos)
11. [Pontuação, fim de turno e recorde](#11-pontuação-fim-de-turno-e-recorde)
12. [Pausa, som e opções](#12-pausa-som-e-opções)
13. [Parâmetros](#13-parâmetros)
14. [Arquitetura e como contribuir](#14-arquitetura-e-como-contribuir)
15. [Testes](#15-testes)

---

## 1. Início rápido

1. `npm run dev` na raiz e abra `#/jogos/corredor-sp` (ou clique no card "Corredor SP" no hub).
2. Escolha pista, cachorro, categoria, modelo e cor e clique em **Correr!**.
3. Depois da contagem 3-2-1, segure **↑** para acelerar e use **← →** para costurar o trânsito.
   Passe pelos corredores entre os carros (a faixa azul, à esquerda, é a mais larga).
4. Pegue pacotes (multiplicam os pontos), guarde capacetes (**X** arremessa) e segure **Espaço** para
   dar grau. Bateu três vezes, acabou o turno.

## 2. Controles

| Teclado | Toque (celular) | Ação |
|---|---|---|
| ↑ / W (segurar) | automático | acelerar |
| ↓ / S (segurar) | FREIO | frear |
| ← → / A D (segurar) | ◀ ▶ | mudar de faixa / entrar no corredor |
| Espaço (segurar) | GRAU | dar grau |
| X / Enter / Enter do teclado numérico | CAPACETE | arremessar um capacete (um por toque de tecla; segurar não repete) |
| P / Esc | botão **Pausar** | pausa / continua |
| — | botão **Som** | liga/desliga os efeitos sonoros (lembrado no navegador) |
| — | botão **← Trocar moto ou pista** | volta para a tela de escolha |

- Mouse: só nos botões (escolha, barra da corrida, pausa e fim de turno); o canvas não reage a clique.
- As teclas do jogo (setas, WASD, Espaço, X, Enter) têm o comportamento padrão do navegador
  cancelado durante a corrida: a página não rola e **Enter/Espaço não acionam botões em foco**
  (nem os da pausa e do fim de turno; use o mouse/toque ou P/Esc para continuar).
- Os botões de toque só aparecem em telas de ponteiro grosso (`(pointer: coarse)`), abaixo da pista.

## 3. Telas e fluxo de um turno

```
Escolha ──Correr!──▶ Corrida: contagem 3-2-1 ─▶ VAI! ─▶ turno ─▶ (3ª batida) ─▶ FIM DE TURNO
   ▲                     │  P/Esc/blur ⇄ PAUSA                                  │
   └──── ← Trocar moto ou pista (barra, pausa ou fim) ◀──────────────────────────┤
                         ▲                                    Correr de novo ───┘
```

- **Escolha** (`SetupScreen`): título "CORREDOR SP", cards de pista com o recorde, cachorro,
  categoria, modelo, cor, prévia da moto e o botão **Correr!**.
- **Corrida** (`RaceScreen`): barra com "← Trocar moto ou pista", "Som: sim/não" e "Pausar"; o canvas
  com o HUD; os botões de toque (só em ponteiro grosso).
- **Pausa**: diálogo "PAUSA" com **Continuar** e **Trocar moto ou pista**.
- **Fim de turno**: diálogo "FIM DE TURNO" com pontos, a conta da pontuação, ultrapassagens, recorde
  e os botões **Correr de novo** (novo turno com a mesma escolha) e **Trocar moto ou pista**.

HUD (desenhado em 320×200 e ampliado 2×): TEMPO (mm:ss), PACOTES, NÍVEL, PONTOS e metros; corações
(mínimo 3 desenhados, os perdidos apagados) e 3 capacetes (os guardados acesos); barra do GRAU
("GRAU!" ligado), "VELOCIDADE n" com o turbo, velocímetro em km/h; avisos piscando
("AMBULÂNCIA ATRÁS!", "CONTRAMÃO À FRENTE!"), faixas de mensagem ("VAI!", "BATEU!", "NÍVEL n · …",
"GAROA: PISTA ESCORREGADIA", "FIM DE TURNO") e textos curtos dos itens ("+1 PACOTE", "CAPACETADA!"…).

## 4. Escolha da moto e da pista

### CS-RN-01 Tela de escolha

| Escolha | Opções |
|---|---|
| Pista | Av. 23 de Maio · Radial Leste · Av. das Nações Unidas |
| Cachorro (só visual) | Vira-lata caramelo · Pitbull · Pincher · Border collie |
| Categoria | CêGezinha 150cc (baú) · Hornetão 600cc (mochila térmica) · Tratorzão 1000cc (malas) |
| Modelo | 3 por categoria (CS-RN-03) |
| Cor | Vermelho, Azul, Preto, Branco, Amarelo, Verde (pinta a moto e o baú/top case) |

Cada opção é um botão com `aria-pressed`; só uma por grupo fica marcada. Trocar a **categoria**
seleciona o **primeiro modelo** dela. A prévia mostra o cachorro na moto com a cor escolhida e o nome
do modelo. O card de cada pista mostra "Recorde N" quando há recorde salvo nela.

### CS-RN-02 Escolha lembrada

Ao clicar em **Correr!** a escolha é gravada em `corredor-sp:escolha` (JSON) e volta marcada na
próxima visita. Sem escolha salva, ou com uma inválida (JSON quebrado, ou qualquer campo
desconhecido: pista, cachorro, categoria, modelo que não é da categoria, cor), vale o padrão: 23 de
Maio, caramelo, 150, Entregadora 150, vermelho. Com o armazenamento bloqueado o jogo funciona e
só não lembra a escolha.

### CS-RN-03 Modelos (`game/data.ts`)

| Categoria | Modelo | Vel. máx. | Aceleração | Freio | Direção | Ponto forte |
|---|---|---|---|---|---|---|
| 150 | Pão de Queijo 150 | 112 km/h | 30 km/h/s | 95 km/h/s | 2,1 | controle |
| 150 | Entregadora 150 | 118 | 36 | 80 | 1,9 | equilibrada |
| 150 | Foguetinho 150 | 126 | 38 | 65 | 1,7 | velocidade |
| 600 | Corisco 600 | 195 | 60 | 100 | 1,75 | equilibrada |
| 600 | Tubarão 600 | 188 | 58 | 120 | 1,55 | freio |
| 600 | Marimbondo 600 | 205 | 70 | 85 | 1,55 | velocidade |
| 1000 | Jabuti 1000 | 212 | 52 | 105 | 1,6 | estabilidade |
| 1000 | Rinoceronte 1000 | 222 | 60 | 125 | 1,3 | freio |
| 1000 | Búfalo 1000 | 235 | 72 | 90 | 1,3 | velocidade |

"Direção" é a velocidade lateral máxima em meias-larguras de pista por segundo. A velocidade máxima
do modelo é o teto da moto em linha reta (sem grau nem turbo). Categorias maiores são mais rápidas e
por isso mais difíceis: o trânsito é o mesmo, mas chega mais rápido. As bolinhas do menu
(aceleração, freio, controle) são notas de 1 a 5 só para leitura.

## 5. Pilotagem

### CS-RN-04 Contagem e largada

A corrida começa com a contagem **3-2-1** (3 s, número grande no centro, um bipe por número). Durante a
contagem a moto, o cronômetro e o trânsito ficam parados e as teclas de pilotagem não fazem nada.
Ao zerar aparece **VAI!** e o turno começa: cronômetro, trânsito, itens e perigos andam. O trânsito
inicial (`TRAFFIC_START` veículos) já está espalhado à frente.

### CS-RN-05 Acelerar, frear e soltar

- **Acelerar** soma `aceleração × fator` por segundo, com `fator = max(0,15; 1 − 0,6 × v/vmax)`: a moto
  ganha velocidade rápido no começo e devagar perto do máximo.
- **Frear** tira `freio` km/h por segundo (25% menos na garoa). Frear tem prioridade sobre acelerar.
- **Sem nada**, a moto perde `0,35 × aceleração` por segundo até parar.
- Acima do teto (ex.: o turbo acabou), a moto perde `2,5 × aceleração` por segundo até o teto.
- O teto é `vmax × 1,2 com grau × 1,15 com o item velocidade` (× `OFFROAD_SPEED` fora do asfalto).
- O velocímetro mostra a velocidade em km/h inteiros.

### CS-RN-06 Direção, curvas e acostamento

- ← → movem a moto de lado com inércia: a velocidade lateral vai para `direção × (0,5 com grau) ×
  min(1; 0,35 + v/vmax)` (parada a moto ainda vira um pouco), com aderência 9 (3 na garoa).
- Nas curvas a moto escorrega levemente para fora (`CENTRIFUGAL`), proporcional ao quadrado da
  velocidade.
- A posição lateral `x` vai de −1 (borda esquerda) a +1 (borda direita) e é limitada a
  ±`OFFROAD_LIMIT` (1,25). Com |x| > 1,02 a moto está **na terra**: o teto cai para
  `OFFROAD_SPEED` (35%) da velocidade máxima.

### CS-RN-07 Controles de toque e aceleração automática

Em telas de ponteiro grosso (`(pointer: coarse)`, celular/tablet) a moto **acelera sozinha** desde a
largada e os botões aparecem abaixo da pista: ◀ ▶ (direção, enquanto pressionados), FREIO, GRAU
(enquanto pressionados) e CAPACETE (um arremesso por toque). Tocar qualquer um desses botões também
liga a aceleração automática. Soltar, cancelar ou arrastar o dedo para fora do botão solta o comando.

## 6. Vidas, batidas e colisão

### CS-RN-08 Vidas, queda e proteção

- O turno começa com `START_LIVES` (3) vidas.
- **Bateu** (veículo, buraco em alta velocidade): perde 1 vida, aparece "BATEU!", a moto cai e fica
  `CRASH_TIME` (2 s) no chão, perdendo velocidade até parar; o cronômetro continua. O grau desliga.
- Ao levantar, a moto volta para dentro da pista (|x| ≤ 0,9), parada, e quem estiver em cima dela
  (a menos de 900 unidades à frente/atrás e perto de lado) é tirado da pista. Ela fica
  `INVULNERABLE_TIME` (3 s) piscando, sem bater em nada (veículo, buraco ou cone).
- Caída a moto não pega itens nem arremessa capacete (o pedido de arremesso fica guardado e sai ao
  levantar). Invulnerável, pega itens normalmente.
- A batida que zera as vidas mostra "FIM DE TURNO" e o turno acaba quando a moto termina de cair (2 s).

### CS-RN-09 Colisão

Há batida quando a moto e um veículo se sobrepõem: |Δz| < (comprimento do veículo + `PLAYER_LEN`)/2
e |Δx| < meia largura do veículo + `PLAYER_HALF_W`. A meia largura de colisão é 72% da desenhada
(é isso que deixa passar no corredor). **Motos que vêm por trás não batem** enquanto estão atrás:
elas desviam da linha da moto quando chegam a 1 500 unidades (a 0,6 de lado por segundo); uma moto
que termina a ultrapassagem ainda sobreposta conta como batida. Qualquer
outro veículo bate, inclusive a ambulância que alcança a moto por trás e o motoboy na contramão.
Veículo rodando depois de uma capacetada não bate.

## 7. Faixas, corredores, ultrapassagem e grau

### CS-RN-10 Faixas, corredores e faixa azul

A pista tem 4 faixas (centros em `LANES`: −0,85, −0,25, 0,25, 0,75) e 3 corredores entre elas
(`CORRIDORS`: −0,55, 0, 0,5). O corredor da esquerda (−0,55) é a **faixa azul** (pintada, só de
motos), mais larga: entre dois carros lado a lado sobram 0,35 contra 0,25 nos outros corredores.
A moto conta como **no corredor** quando está a menos de `CORRIDOR_TOL` (0,1) do centro de um.

### CS-RN-11 Ultrapassagem e carga do grau

Uma **ultrapassagem** conta quando um veículo passa de "à frente" para "atrás" da moto entre dois
quadros, com a moto em pé e o turno em andamento (contramão e veículo rodando não contam). Se nesse
momento a moto está num corredor, a barra do grau sobe `GRAU_CHARGE_CORRIDOR` (8%); na faixa azul,
`GRAU_CHARGE_BLUE` (14%). A barra vai até 100%. O total de ultrapassagens aparece no fim do turno.

### CS-RN-12 Grau

Segurando Espaço (ou GRAU), a moto empina se a barra tem carga e a velocidade passa de 30% da
máxima do modelo. Com grau: teto +20% (`GRAU_SPEED`), aceleração +30% (`GRAU_ACCEL`) e direção
pela metade (`GRAU_STEER`); a barra gasta `GRAU_DRAIN` (22%) por segundo. Barra vazia, soltar a
tecla, cair abaixo de 30% ou bater desliga o grau. A barra começa em `GRAU_START` (30%) e fica
laranja abaixo de 15%.

## 8. Capacete e itens

### CS-RN-13 Capacete

- A moto guarda até `MAX_HELMETS` (3) capacetes; começa sem nenhum. Sem capacete, o arremesso não
  faz nada.
- Arremessado, o capacete sai 150 unidades à frente da moto, na mesma linha, a
  `velocidade da moto + HELMET_SPEED` e some depois de `HELMET_RANGE` (14 000 unidades).
- Acerta o **primeiro** alvo na linha (|Δx| < meia largura + 0,04): **carro, táxi, SUV, moto ou
  motoboy na contramão** sai rodando da pista ("CAPACETADA!"); **cone** voa longe ("CONE LONGE!");
  **ônibus, caminhão e ambulância** são grandes demais: o capacete quica ("TOC! GRANDE DEMAIS") e o
  veículo continua.

### CS-RN-14 Itens

| Item | Efeito |
|---|---|
| Pacote | +1 no multiplicador de pontos ("+1 PACOTE") |
| Capacete | +1 capacete, até 3; com 3 guardados o item pode ser pego, mas não muda nada |
| Grau | +50% na barra (`GRAU_ITEM`), até 100% |
| Velocidade | teto ×1,15 (`SPEED_ITEM_FACTOR`) por 8 s (`SPEED_ITEM_TIME`); pegar outro reinicia os 8 s |
| Vida | +1 coração, até `MAX_LIVES` (10) |

A moto pega o item quando passa a menos de 260 unidades dele e a menos de 0,12 de lado.

### CS-RN-15 Sorteio dos itens

Um item a cada 1,8–3,2 s de turno (o primeiro aos 2 s), sorteado com os pesos pacote 55, capacete 15,
grau 15, velocidade 10, vida 5. Ele surge `SPAWN_AHEAD_MIN` (22 000 unidades) à frente, no centro de uma
das 4 faixas ou dos 3 corredores. Se a moto já tem `MAX_LIVES` vidas, a vida sorteada vira pacote.

## 9. Progressão: nível, densidade, dia e garoa

### CS-RN-16 Nível

O nível é `1 + ⌊segundos de turno / LEVEL_TIME⌋` (sobe a cada 45 s), com faixa "NÍVEL n · nome" (2 TRÂNSITO
PESADO, 3 HORA DO RUSH, 4 MARGINAL TRAVADA, 5 em diante CAOS TOTAL). A cada nível:

| Efeito | Fórmula |
|---|---|
| velocidade do trânsito que surge | × (1 + 0,06 × (nível − 1)), máx. × 1,6 |
| vontade de trocar de faixa | 0,04 + 0,01 × nível por segundo |
| chance de fechada sem seta | 8% + 5% × (nível − 1), máx. 50% |
| intervalo de buracos | máx(3, 9 − nível) + 0–3 s |
| intervalo de cones | máx(5, 14 − nível) + 0–4 s |
| contramão (nível 2+) | máx(14, 40 − 4 × nível) + 0–10 s |
| ambulância (nível 2+) | máx(30, 70 − 5 × nível) + 0–15 s |

### CS-RN-17 Densidade do trânsito

O jogo mantém à frente da moto `TRAFFIC_START` + (`TRAFFIC_MAX` − `TRAFFIC_START`) × min(1, t /
`TRAFFIC_RAMP`) veículos (6 no começo, sobe em linha reta até 42 aos 6 min), contando os que estão
de 1 500 unidades atrás até `SPAWN_AHEAD_MAX` à frente, sem ambulância e contramão. Faltando, surgem
até 2 por quadro entre `SPAWN_AHEAD_MIN` e `SPAWN_AHEAD_MAX` à frente; uma moto sorteada com a moto do
jogador abaixo de 90 km/h tem 30% de chance de surgir 2 500 unidades **atrás** (e passa no corredor).
Motos que surgiram atrás entram na conta ao chegar a 1 500 atrás, então a contagem pode passar do
alvo por 1 ou 2. Veículos que ficam 3 000 unidades para trás (ou além de 40 000 à frente) saem da pista.

### CS-RN-18 Dia e noite

Ciclo de `DAY_CYCLE` (240 s) de turno: tarde → pôr do sol → noite → madrugada → manhã → tarde. A
escuridão é 0 até 15% do ciclo, sobe até 100% aos 35%, fica cheia até 70% e volta a 0 aos 85%. À
noite o céu tem estrelas, o horizonte troca para a versão noturna, as lanternas dos carros, os
postes e o farol da moto acendem.

### CS-RN-19 Garoa

A primeira garoa começa aos 70 s de turno; dura 25–40 s e volta depois de 50–110 s secos. Ao começar
mostra "GAROA: PISTA ESCORREGADIA". Com garoa: o freio rende 25% menos e a direção responde mais
devagar (aderência 3 em vez de 9); a pista fica mais escura e cai chuva na tela.

## 10. Trânsito e perigos

### CS-RN-20 Comportamento do trânsito

| Quem | Comportamento |
|---|---|
| Carros, táxis, SUVs | mantêm a faixa e seguem o da frente (freiam para não encostar); para trocar dão seta antes (2,2 s − km/h ÷ 70, entre 0,6 e 2 s) e mudam em 1,1 s |
| Fechada sem seta | parte das trocas é sem seta (0,7 s, sem pisca), mais comum perto da moto (500–2 600 unidades à frente), puxando para o lado dela, e a cada nível |
| Motos | andam nos corredores (de preferência na faixa azul) e nas faixas, a 75–115 km/h; desviam da moto do jogador quando vêm por trás |
| Caminhões | só nas duas faixas da direita, lentos (40–60 km/h), seta 40% mais longa e troca em 1,8 s |
| Ônibus | só na faixa da direita (35–55 km/h); de vez em quando param no ponto 3–5 s com pisca-alerta |
| Ambulância (nível 2+) | vem por trás a 150–160 km/h, numa faixa sorteada, com aviso "AMBULÂNCIA ATRÁS!" e sirene; os carros até 4 500 unidades à frente dela na mesma faixa abrem passagem (seta curta de 0,45 s) |
| Contramão (nível 2+) | motoboy vindo de frente (40–55 km/h) por um corredor, com aviso "CONTRAMÃO À FRENTE!" |

Um veículo novo só surge numa faixa livre (sem outro de quatro rodas a 2 000 unidades); motos e
contramão surgem em qualquer lugar.

### CS-RN-21 Peso de cada tipo de veículo, por pista

| Pista | carro | táxi | SUV | moto | ônibus | caminhão |
|---|---|---|---|---|---|---|
| 23 de Maio | 50 | 8 | 12 | 18 | 6 | 6 |
| Radial Leste | 40 | 6 | 10 | 16 | 14 | 14 |
| Nações Unidas | 46 | 6 | 16 | 18 | 6 | 8 |

A Radial Leste também tem o trem do metrô ao lado da pista (só cenário).

### CS-RN-22 Buraco

Buracos surgem no centro de uma faixa (±0,1). Passar por um (|Δz| < 200, |Δx| < 0,1) **acima de 55% da
velocidade máxima do modelo** derruba a moto (CS-RN-08). Abaixo disso a moto perde 40% da velocidade e
balança por 0,6 s ("BURACO!"), e o buraco some. Invulnerável, a moto passa por cima sem efeito.

### CS-RN-23 Cones

Cones vêm em grupos de 3 numa faixa, em diagonal. Passar por um (|Δz| < 150, |Δx| < 0,07) tira **30%
da velocidade** e o cone voa; não derruba. Invulnerável, sem efeito.

### CS-RN-24 Contramão e ambulância só a partir do nível 2

No nível 1 não há contramão nem ambulância. Do nível 2 em diante os relógios delas começam a contar:
a primeira contramão vem 30 s depois de atingir o nível 2 e a primeira ambulância 50 s depois; as
seguintes seguem os intervalos de CS-RN-16. A contramão surge 22 000 unidades à frente; a ambulância,
6 000 atrás.

## 11. Pontuação, fim de turno e recorde

### CS-RN-25 Pontuação

**Pontos = (⌊segundos de turno⌋ + ⌊metros rodados ÷ `METERS_PER_POINT`⌋) × (1 + pacotes).**
`UNITS_PER_METER` (100) unidades de pista = 1 m; o HUD mostra os metros sob os pontos. Cada metro vale
igual nas 3 categorias, então quem anda mais rápido roda mais e pontua mais (a 100 km/h são ~2,8
pontos/s de distância, a 235 km/h ~6,5, além de 1 ponto/s de tempo). A contagem e o tempo caído
contam como tempo de turno só depois da largada (a contagem não conta; caído conta).

### CS-RN-26 Fim de turno

Quando a última vida acaba (CS-RN-08) o turno termina: a moto desliza até parar, o trânsito continua
andando e, 1,5 s depois, aparece o diálogo **FIM DE TURNO** com "N pontos", a conta
"(mm:ss na pista + M m rodados) × (1 + P pacotes) · U ultrapassagens" e o recorde. **Correr de novo**
começa outro turno com a mesma escolha (contagem de novo, 3 vidas, tudo zerado); **Trocar moto ou
pista** volta à tela de escolha. No fim de turno o botão Pausar fica desabilitado e P/Esc/perda de
foco não pausam.

### CS-RN-27 Recorde por pista

Cada pista tem o seu recorde (`corredor-sp:recorde:<pista>`). Ao fim do turno, se os pontos forem
**maiores** que o recorde da pista, ele é gravado e o diálogo diz "Novo recorde nesta pista!";
senão (inclusive empate) diz "Recorde da pista: N". O card da pista na escolha mostra "Recorde N"
e o card do jogo no hub mostra o **maior** entre as três pistas. Recorde salvo inválido (texto,
negativo, zero) vale 0; fracionário é arredondado para baixo. Com o armazenamento bloqueado o
turno roda e o recorde só não é guardado.

## 12. Pausa, som e opções

### CS-RN-28 Pausa

P ou Esc alternam a pausa (também durante a contagem); o botão **Pausar/Continuar** da barra faz o
mesmo. Se a janela perde o foco, o jogo pausa sozinho. Pausado, nada anda (cronômetro, moto,
trânsito, contagem), os sons contínuos param e aparece o diálogo **PAUSA** com **Continuar** e
**Trocar moto ou pista**. Pausar e continuar soltam todas as teclas e botões: para seguir
acelerando é preciso apertar de novo. No fim de turno não há pausa.

### CS-RN-29 Som

Sintetizados no navegador (WebAudio, sem arquivos), a partir do primeiro toque ou tecla: motor grave
que sobe de tom com a velocidade (um pouco mais alto no grau e no turbo, mais forte ao acelerar) e,
na velocidade máxima, faz o corte de giro; ronco ao sair para a terra; chiado da garoa; sirene da
ambulância (a menos de 22 000 unidades, mais alta quanto mais perto); bipes da contagem e da largada;
sons de cada item, arremesso, capacetada, buraco, cone, batida, sopro nas ultrapassagens rentes,
subida de nível e fanfarra de recorde (ou trombone triste) no fim do turno. O botão **Som: sim/não**
liga/desliga tudo e a escolha fica em `corredor-sp:som` (`on`/`off`).

### CS-RN-30 Trocar moto ou pista

O botão **← Trocar moto ou pista** (na barra, na pausa e no fim de turno) encerra o turno sem gravar
recorde e volta para a tela de escolha com a escolha atual marcada. Sair pelo "← Sampa Challenges" do
hub no meio do turno também descarta o turno (sem recorde) e desliga o laço e os sons.

## 13. Parâmetros

Em `game/constants.ts` (e no motor/trânsito quando indicado). Números de modelos, pistas e veículos
estão em `game/data.ts` (tabelas acima).

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 640 × 400 | resolução interna do canvas (lógica dos testes também) |
| `K` | `W / 320` = 2 | converte medidas "de projeto" (320×200) para a tela; o HUD é desenhado em 320×200 × `K` |
| `SEG_LEN` | 200 | comprimento de um segmento de pista (unidades) |
| `ROAD_W` | 1000 | meia largura da pista (x normalizado −1…+1) |
| `CAM_H` | 1150 | altura da câmera |
| `FOV` | 100° | abertura da câmera |
| `CAM_DEPTH` | 1 / tan(50°) ≈ 0,839 | profundidade de projeção (derivada do `FOV`) |
| `PLAYER_Z` | `CAM_H × CAM_DEPTH` ≈ 965 | distância da câmera à moto (z da moto = câmera + `PLAYER_Z`) |
| `DRAW_DIST` | 210 segmentos | quanto se vê à frente (42 000 unidades) |
| `FOG_START` | 0,72 | a partir desta fração da distância, pista e objetos entram na névoa (até 85%) |
| `MIN_OBJ_W` | 8 px | largura mínima de veículos (itens 80%, perigos 70%) lá longe |
| `BAND` | 3 | segmentos por faixa de cor (zebra, grama, tracejado) |
| `SPRITE_UNITS` | 6,25 | unidades por pixel de sprite (tamanho nativo na distância da moto) |
| `PLAYER_DRAW_SCALE` | 1,5 | a moto do jogador é desenhada 50% maior |
| `CENTRIFUGAL` | 0,03 | quanto a curva empurra para fora (uma faixa em ~5 s na curva mais forte) |
| `KMH` | 100 / 3,6 | conversão km/h → unidades/s (1 m = 100 unidades) |
| `UNITS_PER_METER` | 100 | unidades de pista por metro |
| `METERS_PER_POINT` | 10 | metros rodados por ponto (CS-RN-25) |
| `LANES` | −0,85, −0,25, 0,25, 0,75 | centro das 4 faixas |
| `CORRIDORS` | −0,55, 0, 0,5 | centro dos 3 corredores |
| `BLUE_LANE` | −0,55 | faixa azul (o 1º corredor) |
| `BLUE_HALF` | 0,075 | meia largura da pintura azul |
| `CORRIDOR_TOL` | 0,1 | distância do centro do corredor que conta como "no corredor" |
| `PLAYER_HALF_W` | 0,05 | meia largura de colisão da moto |
| `PLAYER_LEN` | 300 | comprimento de colisão da moto |
| `OFFROAD_LIMIT` | 1,25 | limite lateral da moto (|x|) |
| `OFFROAD_SPEED` | 0,35 | fora do asfalto (|x| > 1,02), fração da velocidade máxima |
| `START_LIVES` | 3 | vidas no início do turno |
| `MAX_LIVES` | 10 | teto de vidas com o item vida |
| `MAX_HELMETS` | 3 | capacetes guardados |
| `CRASH_TIME` | 2 s | tempo caído |
| `INVULNERABLE_TIME` | 3 s | proteção ao levantar |
| `GRAU_START` | 0,3 | barra inicial do grau |
| `GRAU_DRAIN` | 0,22 / s | gasto do grau |
| `GRAU_SPEED` | 1,2 | teto com grau |
| `GRAU_ACCEL` | 1,3 | aceleração com grau |
| `GRAU_STEER` | 0,5 | direção com grau |
| `GRAU_CHARGE_CORRIDOR` | 0,08 | recarga por ultrapassagem no corredor |
| `GRAU_CHARGE_BLUE` | 0,14 | recarga por ultrapassagem na faixa azul |
| `GRAU_ITEM` | 0,5 | recarga do item grau |
| `SPEED_ITEM_FACTOR` | 1,15 | teto com o item velocidade |
| `SPEED_ITEM_TIME` | 8 s | duração do item velocidade |
| `HELMET_SPEED` | 6000 u/s | velocidade do capacete além da velocidade da moto |
| `HELMET_RANGE` | 14 000 | alcance do capacete |
| `LEVEL_TIME` | 45 s | duração de um nível |
| `DAY_CYCLE` | 240 s | ciclo dia/noite |
| `SPAWN_AHEAD_MIN` | 22 000 | distância mínima de surgimento do trânsito; itens, buracos e cones surgem nela |
| `SPAWN_AHEAD_MAX` | 36 000 | distância máxima de surgimento do trânsito |
| `DESPAWN_BEHIND` | 3000 | atrás disso veículos, itens e perigos saem da pista |
| `TRAFFIC_START` | 6 | veículos à frente no início |
| `TRAFFIC_MAX` | 42 | teto de veículos à frente |
| `TRAFFIC_RAMP` | 360 s | tempo da rampa de densidade |

No motor (`game/engine.ts`) e no trânsito (`game/traffic.ts`):

| Parâmetro | Valor | Efeito |
|---|---|---|
| `ITEM_WEIGHTS` | pacote 55, capacete 15, grau 15, velocidade 10, vida 5 | sorteio dos itens |
| intervalo dos itens | 1,8 + 0–1,4 s (1º aos 2 s) | CS-RN-15 |
| relógios iniciais | buraco 6 s, cone 10 s, contramão 30 s, ambulância 50 s | 1º perigo de cada tipo |
| contagem | 3 s | CS-RN-04 |
| garoa | 1ª aos 70 s; dura 25–40 s; seca 50–110 s; freio × 0,75; aderência 3 (9 seco) | CS-RN-19 |
| curva de aceleração | `max(0,15; 1 − 0,6 × v/vmax)`; solto −0,35 × acel.; acima do teto −2,5 × acel. | CS-RN-05 |
| grau mínimo | velocidade > 30% da máxima do modelo | CS-RN-12 |
| fora do asfalto | |x| > 1,02 | CS-RN-06 |
| desaceleração caído / fim | 4000 / 3000 unidades/s² | CS-RN-08, CS-RN-26 |
| coleta de item | |Δz| < 260, |Δx| < 0,12 | CS-RN-14 |
| buraco | |Δz| < 200, |Δx| < 0,1; derruba acima de 55% da vmax do modelo; abaixo ×0,6 e balanço 0,6 s | CS-RN-22 |
| cone | |Δz| < 150, |Δx| < 0,07; × 0,7 | CS-RN-23 |
| velocidade do trânsito | × (1 + 0,06 × (nível − 1)), máx. 1,6 | CS-RN-16 |
| troca de faixa | 0,04 + 0,01 × nível por s; sem seta 8% + 5%/nível (máx. 50%) | CS-RN-16, CS-RN-20 |
| buraco / cone / contramão / ambulância | máx(3, 9 − n) + 0–3 / máx(5, 14 − n) + 0–4 / máx(14, 40 − 4n) + 0–10 / máx(30, 70 − 5n) + 0–15 s | CS-RN-16 |
| colisão dos veículos (`traffic.ts`) | 72% da largura desenhada | CS-RN-09 |
| velocidades do trânsito (`VEHICLE_SPEED`) | carro 50–80, táxi 55–85, SUV 50–80, ônibus 35–55, caminhão 40–60, ambulância 150–160, moto 75–115, contramão 40–55 km/h | CS-RN-20 |
| comprimentos (`VEHICLE_LENGTH`) | carro/táxi 600, SUV 650, ônibus 1500, caminhão 1600, ambulância 800, moto/contramão 300 | CS-RN-09 |
| capacete remove (`REMOVABLE`) | carro, táxi, SUV, moto, contramão | CS-RN-13 |
| sirene | ambulância a menos de 22 000 unidades | CS-RN-29 |
| aviso de ambulância / contramão | 200–6 000 atrás / até 14 000 à frente | CS-RN-20 |
| fim de turno | diálogo 1,5 s depois | CS-RN-26 |
| `SPRITE_SCALE` (`hires.ts`) | 2 | Scale2x dos PNGs 1× |

Em testes com um piloto automático simples (que não pega itens), as partidas duraram de 20 s a 1 min
e 40 s. Ainda falta testar com pessoas jogando para calibrar a dificuldade.

## 14. Arquitetura e como contribuir

Mapa dos arquivos, pseudo-3D, trânsito, sprites e receitas no [`CLAUDE.md`](./CLAUDE.md) desta pasta.
Resumo: `Game.tsx` (escolha salva, alterna as telas) → `components/SetupScreen.tsx` (escolha) e
`components/RaceScreen.tsx` (canvas, laço, teclado, toque, diálogos) → `game/engine.ts`
(`CorredorEngine`: física, trânsito, itens, perigos, desenho e HUD), com `game/traffic.ts`,
`game/road.ts`, `game/data.ts`, `game/constants.ts`, `game/record.ts`, `game/sound.ts` e
`game/e2eHook.ts` (gancho dos testes).

### Visual em alta (640×400)

- **Resolução dobrada (640×400).** A pista, as faixas e o horizonte têm o dobro de linhas.
- **Sprites com o dobro de detalhe.** Os cachorros motoboys vêm da biblioteca única de sprites
  (`src/shared/sprites`, 2× nativo) e entram como estão. Os demais PNGs continuam em 1× e
  `game/hires.ts` aplica o Scale2x.
- **Mipmaps** para longe, **tamanho mínimo** de veículos e itens, lanternas sempre marcadas em quem
  está longe e **névoa** no fim da pista (quem surge aparece aos poucos).

### Como contribuir

1. Leia o `CLAUDE.md` da raiz e o desta pasta.
2. Mudou regra, número ou controle? Atualize a seção `CS-RN` correspondente, a tabela de parâmetros
   e o teste que cita a regra, no mesmo commit.
3. `npm run typecheck`, `npm run typecheck:e2e`, `npm run build` e a suíte do jogo
   (`npm run test:e2e -- corredor-sp/`) antes de entregar; teste no navegador e a ≈ 390 px.

## 15. Testes

(Preenchido na TF-130-07.)
