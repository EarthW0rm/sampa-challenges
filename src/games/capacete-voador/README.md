# Capacete Voador

Duelo de artilharia por turnos com motoboys. Dois cachorros, cada um na sua moto em cima de um prédio
de São Paulo, trocam capacetes por cima do Copan, do Edifício Itália, do MASP e companhia. Quem acertar
primeiro vence a rodada; a partida vai até o número de pontos escolhido no menu. 1 ou 2 jogadores no
mesmo aparelho (desktop ou celular, ≈ 390 px).

Rota no hub: `#/jogos/capacete-voador`. Este README é o **manual** do jogo: toda regra ou mecânica tem
um número `CV-RN-NN`, e cada número tem pelo menos um teste de ponta a ponta que o cita no nome
([seção 12](#12-testes)). Mudou uma regra? Atualize a seção dela, a tabela de parâmetros e o teste no
mesmo commit.

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Controles](#2-controles)
3. [Telas e fluxo de uma partida](#3-telas-e-fluxo-de-uma-partida)
4. [Menu e opções](#4-menu-e-opções)
5. [Mira e formulário](#5-mira-e-formulário)
6. [Física do voo](#6-física-do-voo)
7. [Acertos](#7-acertos)
8. [Rodadas, cidade e fim de partida](#8-rodadas-cidade-e-fim-de-partida)
9. [Modos e computador](#9-modos-e-computador)
10. [Som, armazenamento e robustez](#10-som-armazenamento-e-robustez)
11. [Parâmetros](#11-parâmetros)
12. [Testes](#12-testes)
13. [Arquitetura](#13-arquitetura)
14. [Como contribuir](#14-como-contribuir)

---

## 1. Início rápido

1. No menu, escolha o modo (o padrão é **Contra o computador**, nível **médio**) e clique em **Jogar**.
2. Na sua vez, o formulário aparece no seu painel com o cursor no **Ângulo**: digite o ângulo (0–180),
   passe para a **Velocidade** (1–200) com Tab e aperte **Enter** (ou clique em **Lançar!**).
3. Olhe o vento no rodapé (`Vento → 3`) e a seta amarela embaixo do campo, e corrija o próximo tiro.
4. Três acertos destroem a moto do adversário; um acerto na cabeça vence a rodada na hora. Quem chegar
   primeiro aos pontos do menu vence a partida.

---

## 2. Controles

O canvas não recebe cliques nem toques: o jogo inteiro é controlado pelo formulário de mira e pelos
botões.

| Entrada | Controle | Ação |
|---|---|---|
| Teclado | dígitos | digita o ângulo/velocidade (o campo de ângulo já vem focado e selecionado) |
| Teclado | Tab / Shift+Tab | passa de um campo ao outro (e ao botão **Lançar!**) |
| Teclado | Enter | lança (em qualquer campo do formulário); no menu, Enter num campo de texto equivale a **Jogar** |
| Mouse | clique nos campos, **Lançar!**, botões da barra | o mesmo que o teclado |
| Toque | toque nos campos (teclado numérico do celular, `inputmode=decimal`) e nos botões | o mesmo que o mouse |

Botões da barra da partida: **← Menu**, **Som: ligado/desligado** e **Reiniciar**. A barra do hub
"← Sampa Challenges" sai do jogo.

---

## 3. Telas e fluxo de uma partida

```
Menu ──Jogar──▶ Partida ──(placar chega nos pontos)──▶ Fim de jogo ──Jogar de novo──▶ Partida
  ▲               │  ▲                                     │
  └──← Menu───────┘  └──Reiniciar (a qualquer momento)      └──Menu──▶ Menu
```

Cada rodada passa pelas fases do motor: **mira** (humano digitando) ou **pensando** (computador) →
**voo** → **explosão** (prédio ou motoboy) → próxima vez, ou **fim de rodada** (comemoração de
2,8 s) → rodada nova, ou **fim de jogo**.

| Tela | O que mostra |
|---|---|
| Menu | modo, dificuldade (só contra o computador), nomes, pontos para vencer, gravidade e atalhos, garoa, **Jogar** |
| Partida | barra (modo · dificuldade · rodada, Som, Reiniciar), campo 640×400, painel de cada jogador (nome, `MOTO` com 3 quadradinhos de vida, formulário ou "Último: a° / v"), placar e vento no rodapé, faixa de mensagem no meio |
| Fim de jogo | diálogo "Fim de jogo": "*Nome* venceu!", placar `a × b`, **Jogar de novo** e **Menu** |

---

## 4. Menu e opções

### CV-RN-01 Abertura e valores padrão

O jogo abre no menu ("CAPACETE VOADOR"). Valores padrão: modo **Contra o computador**, dificuldade
**Médio**, nomes **Jogador 1** / **Jogador 2**, **3** pontos para vencer, gravidade **9,8**
(`DEFAULT_GRAVITY`), garoa desligada. **Jogar** começa a partida com as opções escolhidas.

### CV-RN-02 Modo e campos que dependem dele

| Modo | Dificuldade | Campo do adversário | Pontos para vencer |
|---|---|---|---|
| 2 jogadores | escondida | "Nome do jogador 2", editável | visível |
| Contra o computador | visível (Fácil, Médio, Difícil) | "Adversário", desabilitado, mostra **Computador** | visível |
| Treino | escondida | "Adversário", desabilitado, mostra **Motoboy-alvo** | escondido (treino não termina) |

O nome do adversário fora do modo 2 jogadores é sempre o do rótulo (Computador ou Motoboy-alvo).

### CV-RN-03 Nomes

Cada campo aceita até **14 caracteres** (o campo corta o resto). Espaços nas pontas são removidos;
nome vazio vira **Jogador 1** / **Jogador 2**. O nome aparece no painel, nas mensagens e no fim de jogo.

### CV-RN-04 Pontos para vencer

Lista de **1 a 10** (padrão 3). Vale nos modos 2 jogadores e contra o computador.

### CV-RN-05 Gravidade e atalhos

Campo numérico de **0,5 a 50** em passos de **0,1**; atalhos **Terra 9.8**, **Lua 1.6**, **Marte 3.7**,
**Júpiter 24.8** (o atalho escolhido fica destacado). Comportamento com entradas fora disso:

| Entrada | Resultado |
|---|---|
| apagar o campo | o campo passa a mostrar **0** e o **Jogar** é recusado (menor que 0,5) |
| menor que 0,5, maior que 50 ou fora do passo de 0,1 (ex.: 2,55) | o navegador recusa o **Jogar** (balão de validação no campo) e a partida não começa |
| letras | não entram no campo |

A gravidade escolhida vale para os dois jogadores e para o computador. (O código ainda troca uma
gravidade ≤ 0 por 9,8 ao começar, mas a validação do campo não deixa chegar lá.)

### CV-RN-06 Garoa

Caixa **Garoa (só visual)**: desenha uma camada de chuvisco por cima do campo. Não muda física,
vento nem acertos.

### CV-RN-07 Barra da partida

- O rótulo mostra o modo (com a dificuldade contra o computador) e a rodada: `Contra o computador ·
  médio · rodada 1`.
- **← Menu** volta ao menu com as últimas opções preenchidas; a partida é descartada.
- **Reiniciar** recomeça a partida na hora: placar, tiros do treino e últimos tiros zerados, rodada 1,
  cidade e vento novos, jogador 1 começa.

---

## 5. Mira e formulário

### CV-RN-08 Formulário de mira

- Aparece só no painel de quem tem a vez, se for humano, durante a fase de mira. O painel ativo tem o
  nome destacado.
- Ao aparecer, o campo **Ângulo** recebe o foco com o texto selecionado (digitar já substitui).
- Valores iniciais: **45** e **50** no primeiro tiro; depois, o último tiro **daquele jogador** (vale
  também nas rodadas seguintes, até **Reiniciar**).
- **Enter** ou **Lançar!** lança. O painel de quem não está na vez mostra "Último: a° / v".

### CV-RN-09 Limites dos campos

Ângulo inteiro de **0 a 180** (`ANGLE_MIN`–`ANGLE_MAX`), velocidade inteira de **1 a 200**
(`VELOCITY_MIN`–`VELOCITY_MAX`). Os campos são numéricos do navegador: valor fora do limite (181, −5,
0 na velocidade com setas) ou com casas decimais (45,5) faz o **navegador** recusar o envio com o
balão de validação no campo; nada é lançado e o jogo continua na mira.

### CV-RN-10 Entradas inválidas

| Entrada | Resultado |
|---|---|
| letras, vírgula e outros símbolos | não entram no campo (o navegador descarta a tecla); se o texto estava selecionado (como no ângulo, ao aparecer o formulário), a tecla apaga a seleção e o campo fica **vazio** |
| velocidade vazia | mensagem "Velocidade entre 1 e 200" embaixo do botão; não lança |
| ângulo vazio | **conta como 0°** (tiro na horizontal, para a frente) e lança |
| valor válido depois de um erro | lança normalmente (a mensagem some com o formulário) |

A mensagem "Ângulo entre 0 e 180" existe no código, mas o navegador barra os ângulos fora do limite
antes dela (CV-RN-09).

---

## 6. Física do voo

### CV-RN-11 Trajetória

As unidades da física são pixels lógicos do campo 640×400 (`POS_SCALE` = 1). O capacete sai de cima
da cabeça do cachorro (20 px à direita e 2 px abaixo do canto do quadro 40×40) e segue a fórmula
fechada, calculada a cada passo `t = passo · DT`:

```
x(t) = x0 + (vx·t + ½·(vento/5)·t²)
y(t) = y0 − (vy·t − ½·g·t²)
vx = cos(ângulo)·velocidade·direção    vy = sin(ângulo)·velocidade
```

`direção` é +1 para o jogador 1 (olha para a direita) e −1 para o jogador 2. O passo é `DT` = 0,05 e o
voo anda `SUBSTEPS_PER_SECOND` = 120 passos por segundo de jogo (2 passos por quadro de 60 Hz; 6
unidades de tempo por segundo). A colisão é verificada a cada ~1,5 px do caminho. `g` é a gravidade
do menu.

### CV-RN-12 Vento

Um inteiro sorteado por rodada: de −5 a 5 e, com 1/3 de chance, mais até 9 no mesmo sentido (0 conta
como positivo), ou seja, de −14 a 14. Entra na fórmula como aceleração horizontal `vento/5`
(positivo empurra para a direita). Aparece no rodapé ("Vento → 3", "Vento ← 2", "Vento sem vento") e
como seta amarela embaixo do campo (sem seta quando é 0).

### CV-RN-13 Tiro para trás

Ângulo acima de 90 lança para trás: o jogador 1 joga para a esquerda e o 2 para a direita. 90 sobe
reto; 0 e 180 saem na horizontal.

### CV-RN-14 Saída pela lateral e tempo máximo

O capacete que passa de 10 px além da borda esquerda ou direita (x < −10 ou x > 650) ou que voa mais
que `MAX_FLIGHT_T` = 80 unidades de tempo (1.600 passos, ≈ 13,3 s) some: **passa a vez**, sem
explosão. Acima do topo da tela ele continua voando (um marcador branco no topo mostra onde está).

### CV-RN-15 Chão

O capacete que chega ao chão (y ≥ 400) também some e passa a vez. Como os prédios cobrem os 640 px,
isso só acontece depois que crateras abrem caminho até o chão.

### CV-RN-16 Sol

Passar pelo sol (`SUN_RECT`) faz o sol mostrar cara de susto até o fim da vez. É só visual: o
capacete segue o voo.

---

## 7. Acertos

A cada ponto do caminho, a ordem de verificação é: saiu do campo → sol (só marca) → motoboys (cabeça
antes da moto) → prédio. As áreas de acerto ficam no quadro 40×40 do motoboy virado para a direita e
são espelhadas para o jogador 2: cabeça `PILOT_BOX` (10×8) e moto `MOTO_BOX` (33×22).

| Situação | Resultado |
|---|---|
| Capacete acerta um **prédio** | cratera, passa a vez (CV-RN-17) |
| Acerta a **moto** do adversário | quebra uma peça, passa a vez (CV-RN-18) |
| **3º acerto** na mesma moto | moto destruída, o dono perde a rodada (CV-RN-19) |
| Acerta a **cabeça** do adversário | vence a rodada na hora (CV-RN-20) |
| Acerta a **própria** moto ou cabeça | conta contra quem atirou (CV-RN-21) |
| Sai pela lateral, passa do tempo ou cai no chão | passa a vez (CV-RN-14, CV-RN-15) |
| Passa pelo sol | susto, só visual (CV-RN-16) |

### CV-RN-17 Prédio e cratera

O capacete que toca um pixel de prédio explode ali e abre uma **cratera** circular de raio
`CRATER_RADIUS` = 6 px na máscara de colisão (o buraco deixa os próximos tiros passarem). A explosão
dura 3 quadros de 110 ms e depois **passa a vez**.

### CV-RN-18 Acerto na moto

Cada acerto na moto soma 1 de dano e apaga um quadradinho de `MOTO` no painel ("Moto: 2 de 3"):

| Acerto | Peça | Mensagem |
|---|---|---|
| 1º | baú | "*Atirador* quebrou o baú de *Alvo*!" |
| 2º | farol e roda (a moto começa a soltar fumaça) | "*Atirador* quebrou o farol e a roda de *Alvo*!" |

Depois da explosão (3 quadros de 110 ms), **passa a vez**.

### CV-RN-19 Moto destruída

O 3º acerto (`MOTO_HP` = 3) destrói a moto: cratera de raio `DESTROY_CRATER_RADIUS` = 12 px sob ela,
explosão grande (5 quadros de 110 ms), mensagem "A moto de *Alvo* foi destruída!" e o **dono da moto
perde a rodada** (o outro marca 1 ponto). A moto pode ficar "flutuando" sobre a cratera: é visual.

### CV-RN-20 Acerto na cabeça

Acertar a cabeça (`PILOT_BOX`) derruba o piloto (sprite de nocaute) e **encerra a rodada na hora**:
mensagem "Capacetada na cabeça de *Alvo*!" e 1 ponto para o outro jogador, qualquer que seja o dano
das motos. As áreas da cabeça e da moto não se sobrepõem; a cabeça é verificada primeiro.

### CV-RN-21 Acertar a si mesmo

O próprio motoboy é ignorado até o capacete sair de perto dele; depois, se o capacete voltar e
acertar a própria moto ou cabeça, conta **contra quem atirou**: a moto quebra ("*Nome* quebrou o baú
da própria moto!"), a cabeça encerra a rodada ("*Nome* acertou a própria cabeça!") e o ponto vai para
o adversário.

---

## 8. Rodadas, cidade e fim de partida

### CV-RN-22 Fim de rodada e rodada nova

A rodada acaba com a moto destruída ou com um acerto na cabeça. **Quem leva o golpe perde** e o outro
marca 1 ponto no placar do rodapé (`a >Placar< b`). O vencedor comemora "dando grau" por
`ROUND_OVER_MS` = 2,8 s; depois começa a rodada seguinte com **motos inteiras**, **cidade nova** e
**vento novo**. O número da rodada aparece na barra.

### CV-RN-23 Quem começa

O jogador 1 começa a rodada 1. Nos modos 2 jogadores e contra o computador, quem começa **alterna**
a cada rodada (rodada 2: jogador 2; rodada 3: jogador 1; …). **Reiniciar** e **Jogar de novo** voltam
ao jogador 1. No treino o jogador 1 sempre atira.

### CV-RN-24 Fim de partida

Quando um jogador chega aos **pontos para vencer**, em vez da comemoração da rodada aparece o diálogo
"Fim de jogo" com "*Nome* venceu!", o placar `a × b` e os botões **Jogar de novo** (mesmas opções,
placar zerado) e **Menu**. A faixa de mensagem some e o jogo para até a escolha.

### CV-RN-25 Cidade

A cada rodada a cidade é sorteada de novo:

- Prédios lado a lado, sem vão, cobrindo os 640 px (o último pode ser cortado na borda direita, nunca
  numa fatia menor que 12 px); cada um com altura sorteada de **60 a 270 px** (em andares inteiros).
- Tipos: Copan, Edifício Itália, Altino Arantes (Banespa), Martinelli, Predinho pichado, Torre Faria
  Lima e MASP (altura fixa de 30 px, **no máximo um** por cidade). Tabela em [Parâmetros](#11-parâmetros).
- Os motoboys não têm lugar fixo. O jogador 1 fica num prédio de **telhado reto**, com **36 px ou mais**
  de largura e **60 px ou mais** de altura, cujo centro esteja entre x = 28 e 230 (`ZONE_P1`); o
  jogador 2, num prédio igual com centro entre x = 410 e 612 (`ZONE_P2`), a pelo menos **260 px** do
  primeiro (`MIN_RIDER_GAP`). Um prédio com vizinho mais de **110 px** mais alto não recebe motoboy
  (`MAX_NEIGHBOR_RISE`). MASP, Banespa e Martinelli nunca recebem.

---

## 9. Modos e computador

### CV-RN-26 2 jogadores

Dois humanos no mesmo aparelho se revezam: cada um usa o formulário do próprio painel (jogador 1 à
esquerda, caramelo com moto azul; jogador 2 à direita, branquinho com moto verde).

### CV-RN-27 Vez do computador

Contra o computador, você é o jogador 1 e o computador é o 2 (à direita). Na vez dele o painel mostra
"Mirando…" por `THINK_MS` = 0,8 s, depois o tiro escolhido ("Ângulo: a", "Velocidade: v") por
`ANNOUNCE_MS` = 0,9 s, e lança. Você não tem formulário nesse tempo. O computador usa exatamente a
mesma simulação da tela (o tiro que ele calcula é o que acontece) e só considera ângulos de 15 a 88 e
velocidades de 10 a 160 (`ANGLE_RANGE`, `VELOCITY_RANGE`). Se nenhum caminho acerta você (prédio
alto no meio), ele atira no ponto mais próximo para abrir uma cratera.

### CV-RN-28 Fácil

**Nunca acerta ninguém**: cada tiro é simulado antes e só sai se errar os dois motoboys (inclusive
ele mesmo).

### CV-RN-29 Médio

Começa errando a velocidade por uns 14 (o erro cai 40% a cada tiro) e **acerta com certeza a partir
do 5º tiro da rodada** (se existir caminho livre até você). Nunca atira em si mesmo.

### CV-RN-30 Difícil

Acerta com 35% de chance no 1º tiro da rodada, 60% no 2º e **com certeza do 3º em diante** (se
existir caminho livre). Quando acerta, mira na cabeça em 30% das vezes (se houver tiro que pegue
nela). Quando decide errar, erra por pouco, sem acertar ninguém.

| Nível | Medido (30 cidades aleatórias) |
|---|---|
| Fácil | 0 acertos |
| Médio | 1º acerto entre o 2º e o 5º tiro |
| Difícil | 1º acerto entre o 1º e o 3º tiro |

### CV-RN-31 Treino

Só o jogador 1 atira; o Motoboy-alvo nunca ataca. O rodapé mostra **Tiros N · Acertos M** em vez do
placar (acerto = moto ou cabeça do alvo). Destruir a moto do alvo ou acertar a cabeça dele encerra a
rodada com a mensagem acrescida de "(*n* tiros)" daquela rodada; acertar a si mesmo também encerra a
rodada (sem vencedor). A rodada seguinte segue a CV-RN-22. **O treino não tem fim de partida**: sai-se
por **← Menu**, **Reiniciar** ou pela barra do hub.

---

## 10. Som, armazenamento e robustez

### CV-RN-32 Som

Todos os efeitos são sintetizados com WebAudio em `game/sound.ts` (nenhum arquivo de áudio): sopro e
"pop" ao arremessar, assobio durante o voo (o tom acompanha a altura e o lado), explosão no prédio,
estouro na moto, "bonk" na cabeça, explosão grande na moto destruída, susto do sol, queda fora do
campo, jingle de rodada e fanfarra de fim de jogo. O botão **Som: ligado/desligado** da barra alterna
e grava `capacete-voador:som` = `on`/`off` no `localStorage`; a escolha vale na próxima vez que o jogo
abrir. Qualquer valor diferente de `off` (ou chave ausente) = ligado. O áudio só começa depois do
primeiro clique ou tecla (exigência dos navegadores).

### CV-RN-33 Sem placar salvo nem recorde

O jogo não guarda placar, nomes, opções nem recorde: só a escolha do som. O card do hub não mostra
recorde. Sair do jogo (barra do hub) e voltar abre o menu com os valores padrão.

### CV-RN-34 Quadro, foco e saída

- O motor limita o tempo de cada quadro a 0–100 ms: o 1º quadro com tempo negativo não faz nada e uma
  aba que volta depois de muito tempo avança no máximo 100 ms (12 passos do voo) naquele quadro.
- **Não há pausa.** Perder o foco da janela não para o jogo; na mira nada anda sozinho (é por turnos),
  mas um capacete em voo continua e o computador continua pensando.
- Sair pela barra "← Sampa Challenges" no meio da partida desmonta tudo (laço de quadros, assobio do
  voo, listeners); voltar abre o menu (CV-RN-33).
- `localStorage` bloqueado (modo privado) não impede jogar; o som fica ligado e a escolha não é salva.

### CV-RN-35 Tela estreita (≈ 390 px)

Abaixo de 720 px de largura os painéis saem de cima do campo: placar e vento em cima, o campo, e os
painéis dos jogadores embaixo, com o formulário em tamanho de toque (campos de 36 px, botão de 40 px).
Sem rolagem lateral.

---

## 11. Parâmetros

Valores em `game/constants.ts`, salvo indicação.

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 640 × 400 | resolução lógica (física, colisão, posições) |
| `SCALE` (`game/hires.ts`) | 2 | o canvas tem 1280×800 e os sprites ganham o dobro de detalhe (Scale2x) |
| `POS_SCALE` | 1 | unidades da física → pixels lógicos |
| `DT` | 0,05 | passo da física (unidades de tempo) |
| `SUBSTEPS_PER_SECOND` | 120 | passos do voo por segundo de jogo (velocidade do voo na tela) |
| `MAX_FLIGHT_T` | 80 | tempo máximo de voo (1.600 passos ≈ 13,3 s) |
| `DEFAULT_GRAVITY` | 9,8 | gravidade inicial do menu |
| `ANGLE_MIN`, `ANGLE_MAX` | 0, 180 | limites do campo de ângulo |
| `VELOCITY_MIN`, `VELOCITY_MAX` | 1, 200 | limites do campo de velocidade |
| `RIDER_SIZE` | 40 | quadro do motoboy (px lógicos) |
| `RIDER_WHEEL_ROW` | 38 | linha do quadro onde ficam as rodas (apoio no telhado) |
| `PILOT_BOX` | x19 y9 10×8 | área da cabeça (vence a rodada) |
| `MOTO_BOX` | x1 y17 33×22 | área da moto (baú, chassi, rodas) |
| `MOTO_HP` | 3 | acertos até destruir a moto |
| `SUN_POS` | (308, 4) | onde o sol é desenhado |
| `SUN_RECT` | x310 y6 20×20 | área que assusta o sol |
| `CRATER_RADIUS` | 6 | raio da cratera de capacete no prédio |
| `DESTROY_CRATER_RADIUS` | 12 | raio da cratera sob a moto destruída |
| `SUBSTEP_MS` (`engine.ts`) | 1000/120 ms | duração de um passo do voo |
| `EXPLOSION_FRAME_MS` | 110 ms | quadro de explosão (3 no prédio/moto, 5 na moto destruída) |
| `ROUND_OVER_MS` | 2800 ms | comemoração antes da próxima rodada |
| `THINK_MS` | 800 ms | computador "Mirando…" |
| `ANNOUNCE_MS` | 900 ms | computador mostrando o tiro antes de lançar |
| `THROW_POSE_MS` (`engine.ts`) | 280 ms | pose de arremesso |
| `PART_NAMES` (`engine.ts`) | baú; farol e roda | peça citada no 1º e 2º acerto |
| `ANGLE_RANGE` (`ai.ts`) | 15–88 | ângulos que o computador considera |
| `VELOCITY_RANGE` (`ai.ts`) | 10–160 | velocidades que o computador considera |
| `ZONE_P1` | 28–230 | faixa do centro do prédio do jogador 1 |
| `ZONE_P2` | 410–612 | faixa do centro do prédio do jogador 2 |
| `MIN_RIDER_GAP` | 260 | distância mínima entre os centros dos dois prédios |
| `MAX_NEIGHBOR_RISE` | 110 | vizinho mais alto que isso impede o motoboy no prédio |
| `STRIP_FLOORS` (`city.ts`) | 12 | variações de andar em cada tira de sprite |
| `MASTER_VOLUME` (`sound.ts`) | 0,5 | volume geral dos efeitos |

Chances da IA (`ai.ts`): difícil 35% / 60% / 100% no 1º / 2º / 3º+ tiro e 30% de mirar na cabeça;
médio com erro inicial 14 de velocidade e decaimento 0,6 por tiro, acerto garantido no 5º tiro;
fácil tenta até 300 tiros "parecidos" que errem todo mundo.

### Cidade (`game/city.ts`)

| Prédio | Largura | Andar | Topo | Base | Recebe motoboy |
|---|---|---|---|---|---|
| Copan | 48 | 3 (onda a cada 6) | 6 | 8 | sim |
| Edifício Itália | 36 | 4 | 9 | 6 | sim |
| Altino Arantes (Banespa) | 40 | 4 | 27 | 6 | não (topo escalonado) |
| Martinelli | 40 | 5 | 11 | 7 | não (palacete no topo) |
| Predinho pichado | 32 | 5 | 14 | 6 | não (estreito demais para a moto) |
| Torre Faria Lima | 36 | 3 | 6 | 6 | sim |
| MASP | 56 | altura fixa 30 | — | — | não (no máximo 1 por cidade) |

---

## 12. Testes

Seção preenchida na TF-129-07.

---

## 13. Arquitetura

Mapa dos arquivos, motor e armadilhas no [`CLAUDE.md`](./CLAUDE.md) desta pasta.

```
Menu (React) ──Settings──▶ GameScreen (React) ──cria no useEffect──▶ CapaceteEngine (TS puro)
                              ▲  HudState (onHud)                     │ update(ms) / render(ctx)
                              └──── AimForm ──submitShot──────────────┘
                                                                       ├─ physics.ts (launch, stepFlight)
                                                                       ├─ ai.ts (planComputerShot = mesma física)
                                                                       ├─ city.ts (cidade + máscara de colisão)
                                                                       └─ sound.ts (sfx WebAudio)
```

| Camada | Arquivos | Regra |
|---|---|---|
| Física | `game/physics.ts` | fórmula fechada por passo inteiro; a IA e o motor chamam a mesma `stepFlight` |
| Motor | `game/engine.ts` | fases, turnos, dano, rodadas, partículas, desenho; o React só recebe o `HudState` |
| IA | `game/ai.ts` | varre a grade de tiros com `simulate` e decide por nível |
| Cidade | `game/city.ts` | sorteio dos prédios e dos lugares dos motoboys, máscara de colisão, crateras |
| Telas | `Game.tsx`, `components/` | menu, partida, formulário de mira |
| Testes | `game/e2eHook.ts`, `e2e/capacete-voador/` | gancho só com a flag da página de teste |

Única chave do `localStorage`: `capacete-voador:som`.

---

## 14. Como contribuir

1. Leia o [`CLAUDE.md` da raiz](../../../CLAUDE.md) (CSS escopado, assets na pasta, manifest leve,
   StrictMode, `dt` do quadro) e o [`CLAUDE.md` do jogo](./CLAUDE.md).
2. Mudança de regra: atualize a seção `CV-RN-NN` deste manual, a tabela de parâmetros e o teste que
   cita o número, no mesmo commit.
3. Física só em `game/physics.ts` (vale para o motor e para a IA). Não quebre o determinismo: passo
   inteiro, fórmula fechada.
4. Antes de entregar: `npm run typecheck`, `npm run typecheck:e2e`, `npm run build`,
   `npm run test:e2e -- capacete-voador/` e, se mexeu em regra de partida ou na IA,
   `npm run test:e2e:longa -- capacete-voador/`. Teste no navegador em desktop e a ≈ 390 px.
