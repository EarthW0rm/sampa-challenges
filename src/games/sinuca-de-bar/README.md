# Sinuca de Bar

Sinuca de boteco vista de cima, em pixel art: mesa de pano verde, bolas numeradas e a regra da
casa. Duas modalidades (lisas × listradas, mata a 8; ímpares × pares, mata a 15), para 2 jogadores
no mesmo aparelho ou contra o computador em 3 níveis. Desktop ou celular (≈ 390 px).

Rota no hub: `#/jogos/sinuca-de-bar`.

Este README é o **manual** do jogo: toda regra ou mecânica tem um número `SB-RN-NN`, e cada número
tem pelo menos um teste de ponta a ponta que o cita no nome (seção 15). Mudou uma regra? Atualize a
seção dela, a tabela de parâmetros e o teste no mesmo commit.

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Controles](#2-controles)
3. [Telas e fluxo de uma partida](#3-telas-e-fluxo-de-uma-partida)
4. [Menu e tela da partida](#4-menu-e-tela-da-partida)
5. [Mira, força e tacada](#5-mira-força-e-tacada)
6. [Saída](#6-saída)
7. [Grupos e vez](#7-grupos-e-vez)
8. [Faltas e bola na mão](#8-faltas-e-bola-na-mão)
9. [Bola castigo e fim de partida](#9-bola-castigo-e-fim-de-partida)
10. [Computador](#10-computador)
11. [Robustez](#11-robustez)
12. [Pontuação, recorde e opções do menu](#12-pontuação-recorde-e-opções-do-menu)
13. [Parâmetros](#13-parâmetros)
14. [Arquitetura](#14-arquitetura)
15. [Testes](#15-testes)
16. [Como contribuir](#16-como-contribuir)

---

## 1. Início rápido

1. No menu, escolha **Contra o computador** ou **2 jogadores**, a **regra da casa** (lisas ×
   listradas ou ímpares × pares), o nível do computador, os nomes e quem dá a **saída**. Toque em
   **Jogar**.
2. Na saída, a branca fica atrás da **linha de cabeceira** (faixa clara à esquerda). Arraste-a (ou
   use W A S D) se quiser mudá-la de lugar.
3. Toque ou arraste na mesa para mirar: o taco aponta para o ponto tocado. A linha pontilhada mostra
   o caminho da branca e a **bola-fantasma** (onde ela encosta); a linha amarela, para onde vai a bola
   atingida.
4. Ajuste a barra **Força** e toque em **Tacar!**.
5. Encaçapou uma bola do seu grupo sem falta, joga de novo. Quem limpar o próprio grupo **mata a
   castigo** (8 ou 15) e vence.

---

## 2. Controles

| Entrada | Controle | Ação |
|---|---|---|
| Toque / mouse | toque, clique ou arraste na mesa | mira: o taco aponta para o ponto (SB-RN-04) |
| Toque / mouse | arrastar a branca | posiciona a branca com **bola na mão** (SB-RN-11, SB-RN-24) |
| Toque / mouse | ◀ ▶ | gira a mira 1° (SB-RN-05) |
| Toque / mouse | ‹ › | gira a mira 0,2° (SB-RN-05) |
| Toque / mouse | barra **Força** | força da tacada, de 5% a 100% (SB-RN-06) |
| Toque / mouse | **Tacar!** | dá a tacada (SB-RN-07) |
| Teclado | ← / → | gira a mira 1°; com **Shift**, 0,2° |
| Teclado | ↑ / ↓ | força ± 5 pontos |
| Teclado | Espaço / Enter | dá a tacada |
| Teclado | W A S D | move a branca 2 px lógicos com bola na mão; com **Shift**, 0,5 px |

O teclado só age na vez de uma pessoa (não do computador) e com a mesa parada. Com o foco num botão,
Espaço/Enter apertam o botão (não dão a tacada); com o foco na barra de força, ←/→ mexem na barra.
Só o botão principal do mouse mira.

---

## 3. Telas e fluxo de uma partida

| Tela | O que acontece |
|---|---|
| **Carregando** | "Passando giz no taco…" enquanto os PNGs carregam; erro de carga mostra "Erro: …" |
| **Menu** | Modo, regra da casa, nível do computador (só contra o computador), nomes, saída e **Jogar** (SB-RN-01) |
| **Partida** | Barra (← Menu, modo e regra, Som), mesa (canvas 640×400, lógica 320×200) com o placar desenhado no topo, linha de status, ◀ ‹ › ▶, Força, Tacar!, Nova partida e a dica dos controles |
| **Fim de partida** | Diálogo sobre a mesa: quem venceu, o motivo, o placar de vitórias e **Jogar de novo**, **Ver mesa**, **Menu** (SB-RN-29) |

Uma vez é: mirar → tacar → as bolas rolam (controles desligados, status "Bolas rolando…") → quando
tudo para, as regras decidem falta, grupo, vitória e de quem é a vez, e os avisos aparecem na mesa
(até 2 ao mesmo tempo, `TOAST_S` cada).

---

## 4. Menu e tela da partida

### SB-RN-01 Opções do menu

| Opção | Valores | Padrão |
|---|---|---|
| Modo de jogo | **Contra o computador** (você é o jogador 1, o computador o 2) · **2 jogadores** (mesmo aparelho) | contra o computador |
| Regra da casa | **Lisas × listradas** (mata a 8) · **Ímpares × pares** (mata a 15) | lisas × listradas |
| Computador | **Pato**, **Bom de taco**, **Tubarão** (o grupo só aparece contra o computador) | Bom de taco |
| Jogadores | "Seu nome" (contra o computador) ou "Jogador 1" e "Jogador 2"; até 14 caracteres cada | Jogador 1, Jogador 2 |
| Saída | **Você**/**Jogador 1**, **Computador**/**Jogador 2**, **Sorteio** | Você/Jogador 1 |

Os nomes perdem os espaços das pontas; nome vazio vira "Jogador 1"/"Jogador 2". Contra o computador
o segundo nome não é pedido e o adversário se chama "Computador". **Jogar** grava as escolhas e
abre a partida.

### SB-RN-02 Últimas escolhas lembradas

As escolhas ficam em `localStorage["sinuca-de-bar:config"]` (JSON) e voltam no próximo menu. Cada
campo inválido volta ao padrão sozinho (modo diferente de `pvp` = contra o computador; regra
diferente de `parimpar` = lisas; nível fora de 1 e 3 = 2; saída fora de `p2`/`random` = `p1`); JSON
quebrado ou armazenamento bloqueado = tudo no padrão, sem erro na tela.

### SB-RN-03 Barra da partida e som

A barra mostra o modo ("Contra o computador (Bom de taco)" ou "2 jogadores"), os grupos e a castigo
("Lisas × Listradas · mata a 8"). **← Menu** volta ao menu: a partida e o placar de vitórias se
perdem. **Som** liga/desliga os efeitos (taco, choque, tabela, caçapa, falta, vez, vitória/derrota)
e grava `localStorage["sinuca-de-bar:som"]` (`on`/`off`; padrão ligado).

---

## 5. Mira, força e tacada

### SB-RN-04 Mira por toque, clique e arraste

Na vez de uma pessoa, tocar/clicar na mesa aponta o taco da branca para o ponto tocado; arrastar
continua mirando enquanto o dedo/botão estiver apertado. Um toque a menos de 2 px lógicos do centro
da branca não muda a mira. No início de cada vez (depois da saída) a mira já aponta para a bola
permitida mais perto da branca; na saída ela aponta para a direita (o triângulo).

### SB-RN-05 Mira fina: botões e teclado

◀ e ▶ giram a mira `AIM_STEP_DEG` (1°) no sentido anti-horário e horário da tela; ‹ e › giram
`AIM_FINE_DEG` (0,2°). No teclado, ←/→ giram `AIM_STEP_DEG` e, com Shift, `AIM_FINE_DEG`. Os botões
ficam desligados fora da vez de uma pessoa.

### SB-RN-06 Força

A força vai de 5% a 100% (`0,05`–`1`) e começa em `DEFAULT_POWER` (40%). A barra **Força** muda de
1 em 1 ponto; ↑/↓ mudam `POWER_STEP` (5 pontos) e param nos limites. A força escolhida continua
valendo nas tacadas seguintes (não volta ao padrão). Durante a vez do computador a força não pode
ser mudada (a barra fica desligada).

### SB-RN-07 Tacada

**Tacar!**, Espaço ou Enter dão a tacada na vez de uma pessoa (não durante o arraste da branca). O
taco recua e avança por `STROKE_S` e então a branca sai na direção da mira com velocidade
`força × MAX_SPEED`. Com as bolas rolando, os botões ◀ ‹ › ▶ e Tacar! ficam desligados e o status
diz "Bolas rolando…". Quando a última bola para, a tacada é decidida (seções 6 a 9).

### SB-RN-08 Linhas de mira

Na vez de uma pessoa, uma linha pontilhada clara vai da branca até a primeira coisa no caminho: a
bola-fantasma (o anel onde a branca encosta) numa bola ou na tabela. Se acerta uma bola, uma linha
curta mostra para onde ela vai (linha dos centros) e outra, mais fraca, para onde a branca desvia.
A linha da bola é **amarela** se ela pode ser tocada primeiro e **vermelha** (com um ponto vermelho
em cima da bola) se tocá-la primeiro é falta.

### SB-RN-09 Física da mesa

Bolas de massa igual, sem efeito. A física roda em passos fixos de `PHYS_DT`, divididos para nenhuma
bola andar mais que `MAX_SUBSTEP_MOVE` por subpasso; mesma mesa e mesma tacada dão sempre o mesmo
resultado. O pano freia com `ROLL_DECEL` + `LINEAR_DRAG` × velocidade e a bola para abaixo de
`STOP_SPEED`. Choques entre bolas guardam `BALL_RESTITUTION` da velocidade; nas tabelas,
`CUSHION_RESTITUTION`. As bocas das caçapas têm quinas cortadas (`JAW_FACING`) que guiam a bola para
dentro. Uma bola cai quando o centro entra no raio de captura da caçapa (`POCKETS`); a que escapar
da mesa sem cair vai para a caçapa mais perto. A bola caída some na caçapa em `SINK_S`.

---

## 6. Saída

### SB-RN-10 Mesa armada

Toda partida começa com o triângulo de 15 bolas com a ponta na marca do pé (`FOOT_X`, meio da mesa
na altura): a castigo no meio da terceira fileira, uma bola de cada grupo nos dois cantos de trás e
as demais sorteadas. A branca fica na marca da cabeceira (`HEAD_X` − 8, meio da mesa), a mesa está
aberta e um aviso diz "<nome> dá a saída".

### SB-RN-11 Branca atrás da linha de cabeceira

Na saída, quem tem a vez está com **bola na mão atrás da linha**: pode arrastar a branca ou usar
W A S D, mas só dentro do pano, sem encostar em outra bola e com `x ≤ HEAD_X` (a área permitida fica
clara). Arraste para um lugar proibido: a branca acompanha o dedo, mas ao soltar volta ao último
lugar válido. W A S D que levaria a um lugar proibido não move.

### SB-RN-12 Saída: continua e não há falta pela castigo

Na saída, encaçapar **qualquer** bola numerada sem falta faz o mesmo jogador continuar (e a primeira
bola encaçapada define os grupos, SB-RN-16). Tocar primeiro na castigo na saída não é falta. As
demais faltas (SB-RN-19, SB-RN-23) valem.

### SB-RN-13 Castigo na saída volta para a marca

A castigo encaçapada na saída não decide a partida: volta para a marca do pé (ou o primeiro lugar
livre à direita dela) com o aviso "Bola 8 na saída: volta para a marca" e o jogo segue pelas outras
regras da tacada.

### SB-RN-14 Quem dá a saída

Na primeira partida, sai quem foi escolhido no menu (**Sorteio** sorteia entre os dois). Cada nova
partida (**Jogar de novo** ou **Nova partida**) passa a saída para o outro jogador.

---

## 7. Grupos e vez

### SB-RN-15 Grupos por modalidade

| | Lisas × listradas | Ímpares × pares |
|---|---|---|
| Grupo A | lisas, 1 a 7 | ímpares, 1 a 13 |
| Grupo B | listradas, 9 a 15 | pares, 2 a 14 |
| Bola castigo | 8 (preta) | 15 |

Cada grupo tem 7 bolas.

### SB-RN-16 Mesa aberta e definição do grupo

A mesa começa **aberta** (sem grupos): pode-se tocar primeiro qualquer bola, menos a castigo (fora da
saída). A primeira bola encaçapada **sem falta** (inclusive na saída) dá o grupo dela a quem tacou;
o adversário fica com o outro, e um aviso diz "<nome>: Lisas". Bola encaçapada numa tacada com falta
não define grupo.

### SB-RN-17 Continuar ou passar a vez

Encaçapou pelo menos uma bola do **seu** grupo sem falta: joga de novo. Não encaçapou nenhuma do seu
grupo (errou, ou só derrubou bola do adversário): a vez passa, sem bola na mão, e a bola do
adversário fica encaçapada. Cada troca mostra "Vez de <nome>".

### SB-RN-18 Placar na mesa

No topo da mesa há uma caixa por jogador: nome (com reticências enquanto o computador pensa) e
vitórias na sessão; embaixo, **MESA ABERTA**, as bolas do grupo que faltam e o nome do grupo, ou
**MATA A** com a castigo quando o grupo acabou. A caixa da vez tem borda amarela (piscando enquanto
se mira). Quando um jogador limpa o grupo, aparece "<nome> agora mata a bola 8".

---

## 8. Faltas e bola na mão

Toda falta mostra "Falta: <motivo>" na mesa e passa a vez ao adversário com **bola na mão em
qualquer lugar** (SB-RN-24). As bolas encaçapadas na tacada com falta continuam fora.

### SB-RN-19 Não tocou em nenhuma bola

A branca parou sem encostar em nenhuma bola numerada: "Não tocou em nenhuma bola".

### SB-RN-20 Tocou primeiro na bola do adversário

Com os grupos definidos, a primeira bola tocada pela branca é do adversário: "Tocou primeiro na
bola do adversário".

### SB-RN-21 Tocou primeiro na castigo antes da hora

Fora da saída, a primeira bola tocada é a castigo e o jogador ainda não está na castigo (inclusive
com a mesa aberta): "Tocou primeiro na bola 8".

### SB-RN-22 Na castigo, tem que tocar nela primeiro

Quem já limpou o grupo precisa tocar primeiro na castigo: tocar outra bola primeiro é "Tinha que
tocar primeiro na bola 8".

### SB-RN-23 A branca caiu

A branca encaçapada é falta ("A branca caiu"; com outra falta junto, "A branca caiu e <outra>").
A branca volta à mesa na marca da cabeceira ou no lugar livre mais perto dela, e o adversário joga
com bola na mão em qualquer lugar.

### SB-RN-24 Bola na mão em qualquer lugar

Depois de uma falta, o adversário pode pôr a branca em qualquer lugar do pano sem encostar em outra
bola: arrastando-a (o toque precisa começar a menos de `BALL_R` + 5 px lógicos do centro dela; fora
disso o toque mira) ou com W A S D (2 px; Shift 0,5 px). Soltar num lugar proibido devolve a branca
ao último lugar válido; W A S D não entra em lugar proibido. A branca pisca devagar onde pode ficar e
rápido onde não pode, e o status diz "<nome> tem bola na mão: posicione a branca e dê a tacada.".

---

## 9. Bola castigo e fim de partida

A castigo só pode ser encaçapada depois de todas as bolas do seu grupo saírem ("na castigo" = grupo
já vazio **antes** da tacada). Fora da saída, encaçapá-la sempre encerra a partida:

### SB-RN-25 Vence: castigo na hora certa

Quem está na castigo e a encaçapa sem falta vence ("Encaçapou a bola 8.").

### SB-RN-26 Perde: castigo antes da hora

Encaçapar a castigo sem estar nela perde na hora para o adversário ("Encaçapou a bola 8 antes da
hora."), inclusive com a mesa aberta e inclusive junto com a última bola do próprio grupo (na mesma
tacada).

### SB-RN-27 Perde: branca junto com a castigo

Encaçapar a castigo e a branca na mesma tacada perde ("Derrubou a branca junto com a bola 8."),
esteja ou não na castigo.

### SB-RN-28 Perde: castigo com falta

Na castigo, encaçapá-la numa tacada com falta (ex.: tocou outra bola primeiro) perde ("Falta na bola
8: tinha que tocar primeiro na bola 8.").

### SB-RN-29 Fim de partida

O vencedor ganha 1 vitória no placar da sessão e um diálogo mostra "<nome> venceu!" (ou "O
computador venceu!"), o motivo e o placar ("Placar: Ana 1 × 0 Computador"). **Jogar de novo** arma
outra partida (a saída alterna, SB-RN-14); **Ver mesa** fecha o diálogo e deixa ver a mesa final
(a partida continua encerrada; **Nova partida** arma a próxima sem confirmação); **Menu** volta ao
menu. As vitórias não são gravadas: valem enquanto a tela da partida estiver aberta.

### SB-RN-30 Nova partida com confirmação

Com a partida em andamento, **Nova partida** vira "Abandonar esta partida?" e só arma outra mesa com
um segundo toque em até 3 s; sem o segundo toque, o botão volta ao normal. Abandonar não dá vitória
a ninguém. Com a partida encerrada, **Nova partida** arma a próxima direto.

---

## 10. Computador

### SB-RN-31 Vez do computador

Na vez do computador o status diz "Computador está mirando…", os controles da tacada ficam desligados
e o teclado não age. Ele pensa pelo menos `AI_THINK_S` (e até a tacada ficar pronta), põe a branca
quando tem bola na mão, gira o taco até a mira escolhida em `AI_AIM_S` e bate. Ele segue as mesmas
regras (faltas, grupos, castigo).

### SB-RN-32 Níveis

Para cada bola permitida e cada caçapa o computador calcula a bola-fantasma, descarta cortes acima
de ~75° e caminhos bloqueados, simula cada linha nas forças do nível com a mesma física do jogo e dá
nota pelo resultado das regras (vitória, falta, continuar, bolas do grupo e, no Tubarão, a posição
da branca para a próxima). Com bola na mão testa lugares da branca atrás da bola-fantasma. Sem linha
limpa, mira direto numa bola permitida e escolhe a que não faz falta. Na saída bate com força total
no triângulo. O erro do nível entra no fim, como ruído gaussiano na mira e na força:

| Nível | Erro de mira (desvio) | Erro de força | Forças testadas | Pensa na próxima |
|---|---|---|---|---|
| Pato | 2,2° | 15% | 23%, 40% | não |
| Bom de taco | 0,9° | 7% | 17%, 27%, 40% | não |
| Tubarão | 0,25° | 3% | 13%, 20%, 28%, 40%, 57% | sim |

### SB-RN-33 Busca em segundo plano, reserva e resposta atrasada

A tacada do computador é calculada num Web Worker (o pior caso do Tubarão leva ≈ 2 s). Se o worker
não carrega ou falha, a busca passa a rodar na própria página e a partida continua. Uma resposta que
chega depois de a partida mudar (Nova partida, Jogar de novo, Menu) é descartada. Nos testes, o
pedido ao worker leva uma semente: a mesma partida dá a mesma tacada.

---

## 11. Robustez

### SB-RN-34 Tempo de quadro, foco e saída pelo hub

Cada quadro avança o jogo `Math.max(0, Math.min(dt, 0,05 s))`: um primeiro quadro com tempo negativo
não anda e uma aba que volta depois de muito tempo anda só 0,05 s (a física continua em passos
fixos). O jogo não tem pausa: perder o foco da janela não muda nada (é por vez; sem quadros, nada
anda). Sair pelo "← Sampa Challenges" no meio da partida desmonta o jogo inteiro (laço, worker,
teclado); voltar abre o menu com as últimas escolhas.

### SB-RN-35 Armazenamento bloqueado ou corrompido

Com o `localStorage` bloqueado (modo privado) o jogo abre e joga com as escolhas padrão e o som
ligado, sem lembrar nada e sem erro. Config corrompida volta ao padrão (SB-RN-02).

### SB-RN-36 Celular (≈ 390 px)

A 390 px de largura não há rolagem lateral; o menu, a mesa (largura toda), a força e os botões ficam
visíveis. O toque mira e arrasta a branca como o mouse.

---

## 12. Pontuação, recorde e opções do menu

- **Pontuação:** a partida não tem pontos; vale quem vence pela castigo (SB-RN-25 a SB-RN-28). O
  placar de vitórias (SB-RN-29) conta as partidas da sessão e zera ao voltar ao menu.
- **Recorde:** não há recorde; o card do hub não mostra recorde para este jogo.
- **Opções do menu:** SB-RN-01 (o que cada uma faz e o padrão) e SB-RN-02 (onde ficam guardadas).

---

## 13. Parâmetros

`game/constants.ts` (a mesa precisa bater com o topo de `tools/pixelart/sinuca_de_bar.py`):

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 320 × 200 | grade lógica (posições e colisões) |
| `SCALE` (`game/hires.ts`) | 2 | o canvas tem 640×400; o fundo ganha o dobro de detalhe (Scale2x) |
| `FELT_L`, `FELT_R` | 16, 304 | bordas esquerda e direita do pano (288 de largura) |
| `FELT_T`, `FELT_B` | 40, 184 | bordas de cima e de baixo do pano (144 de altura) |
| `MID_X`, `CY` | 160, 112 | meio do pano (caçapas do meio, linha do triângulo e da branca) |
| `HEAD_X` | 88 | linha de cabeceira: na saída a branca fica com `x ≤ HEAD_X`; a branca nasce em `HEAD_X − 8` |
| `FOOT_X` | 232 | marca do pé: ponta do triângulo e onde a castigo volta |
| `BOX_L`, `BOX_R` | (4, 2)–(121, 25), (198, 2)–(315, 25) | caixas do placar dos jogadores 1 e 2 |
| `BALL_R` | 4 | raio da bola (PNG 16×16 em 2× nativo) |
| `JAW_CORNER` | 11 | da quina até onde a tabela começa (boca de canto ≈ 2 bolas na diagonal): maior = mais fácil encaçapar |
| `JAW_MID` | 9 | meia boca da caçapa do meio (boca ≈ 2,25 bolas) |
| `JAW_FACING` | 5 | quina cortada de cada boca: desvia para dentro a bola que chega em ângulo |
| `POCKETS` | cantos r 8,5 (1 px fora do pano); meio r 7,5 (4 px fora) | centro e raio de captura: o centro da bola dentro dele cai |
| `PHYS_DT` | 1/240 s | passo fixo da física (o mesmo da previsão da IA) |
| `MAX_SUBSTEP_MOVE` | 0,5 px | maior deslocamento por subpasso (evita atravessar bolas) |
| `MAX_SPEED` | 975 px/s | velocidade da branca com força 100% |
| `ROLL_DECEL` | 45 px/s² | atrito do pano: maior = bolas param antes |
| `LINEAR_DRAG` | 0,2 /s | arrasto extra nas bolas rápidas |
| `STOP_SPEED` | 2 px/s | abaixo disso a bola para |
| `BALL_RESTITUTION` | 0,97 | energia que sobra no choque entre bolas |
| `CUSHION_RESTITUTION` | 0,8 | energia que sobra na tabela |
| `MAX_SHOT_TIME` | 20 s | limite de uma tacada simulada pela IA |
| `DEFAULT_POWER` | 0,4 | força inicial (40%) |
| `POWER_STEP` | 0,05 | passo de ↑/↓ na força |
| `AIM_STEP_DEG` | 1° | passo da mira (◀ ▶ e ←/→) |
| `AIM_FINE_DEG` | 0,2° | passo fino (‹ › e Shift + ←/→) |
| `CUE_LENGTH` | 120 px | tamanho do taco desenhado |
| `CUE_PULL` | 14 px | recuo máximo do taco (mostra a força) |
| `STROKE_S` | 0,16 s | animação do taco antes de a branca sair |
| `TOAST_S` | 2,4 s | tempo de cada aviso na mesa |
| `SINK_S` | 0,18 s | bola sumindo na caçapa |
| `AI_THINK_S` | 0,5 s | pausa mínima do computador antes de mirar |
| `AI_AIM_S` | 0,8 s | tempo do computador girando o taco até a mira |

Números do motor e das telas (fora de `constants.ts`):

| Onde | Valor | Efeito |
|---|---|---|
| `GameScreen.tsx` (laço) | `dt` limitado a 0–0,05 s | quadro negativo não anda; quadro gigante anda no máximo 0,05 s (SB-RN-34) |
| `engine.ts` `setPower` | 0,05–1 | limites da força (SB-RN-06) |
| `engine.ts` `aimAt` | 2 px | toque mais perto que isso da branca não mira (SB-RN-04) |
| `engine.ts` `pointerDown` | `BALL_R` + 5 px | raio para pegar a branca com bola na mão (SB-RN-24) |
| `engine.ts` `keyDown` | 2 px / 0,5 px | passo de W A S D sem e com Shift |
| `engine.ts` `toast` | 3 guardados, 2 visíveis | avisos simultâneos na mesa |
| `engine.ts` `requestAi` | 30 ms (relógio real) | atraso da busca na própria página quando não há worker |
| `GameScreen.tsx` | 3 s (relógio real) | janela da confirmação de Nova partida (SB-RN-30) |
| `ai.ts` `LEVELS` | tabela da SB-RN-32 | erro de mira/força, forças testadas e posição por nível |
| `sound.ts` `MASTER_VOLUME` | 0,5 | volume dos efeitos |

---

## 14. Arquitetura

Mapa dos arquivos, física, regras, IA e armadilhas no [`CLAUDE.md`](CLAUDE.md) desta pasta. Em
resumo: `game/physics.ts` (mesa), `game/rules.ts` (`resolveShot`: falta, grupo, castigo, vez) e
`game/ai.ts` (`chooseShot`) são TypeScript puro; `game/engine.ts` (`SinucaEngine`) junta tudo, desenha
o canvas e manda o `HudState` para o React (`components/GameScreen.tsx`); `game/ai.worker.ts` roda a
IA fora da página.

---

## 15. Testes

```bash
npm run test:e2e -- e2e/sinuca-de-bar/                   # suíte rápida (desktop + celular)
npx playwright test -c e2e/playwright.config.ts --project=celular e2e/sinuca-de-bar/  # só 390 px
npm run test:e2e:longa -- e2e/sinuca-de-bar/             # piloto (partidas inteiras)
npm run test:e2e:cobertura -- --jogo sinuca-de-bar       # RN do manual × testes
```

Os testes jogam pela tela (toque, clique, arraste e teclado) com o relógio controlado: nada anda
sem o teste mandar, a semente fixa o `Math.random` da página e a semente vai no pedido ao worker da
IA, então a mesma semente dá a mesma partida. O gancho `window.__e2e` (`game/e2eHook.ts`) só lê o
estado; mesas raras (uma falta, a castigo na hora) são montadas pelo `prepare`, sempre comentado no
teste. Cada ação vira um PNG em `evidencias/` com modalidade, vez, grupos, bolas, mira, força, bola
na mão e a última tacada no cabeçalho.

| Arquivo | Cobertura |
|---|---|
| `e2e/sinuca-de-bar/navegacao.spec.ts` | abre pelo hub, partida, ← Menu, volta ao hub |
| `e2e/sinuca-de-bar/menu.spec.ts` | opções do menu, nomes, escolhas lembradas e inválidas, Som |
| `e2e/sinuca-de-bar/mira-forca.spec.ts` | mira por toque/arraste, botões e teclado, linhas de mira, força, tacada e física |
| `e2e/sinuca-de-bar/saida.spec.ts` | mesa armada, branca atrás da linha, saída que continua, castigo na saída, quem sai e alternância, Sorteio |
| `e2e/sinuca-de-bar/grupos-vez.spec.ts` | grupos por modalidade, mesa aberta, continuar/passar a vez, aviso de matar a castigo |
| `e2e/sinuca-de-bar/faltas-bola-na-mao.spec.ts` | cada falta e a bola na mão (arraste e W A S D) |
| `e2e/sinuca-de-bar/castigo.spec.ts` | vitória e cada derrota pela castigo, diálogo do fim, Jogar de novo, Ver mesa, Menu, Nova partida com confirmação |
| `e2e/sinuca-de-bar/computador.spec.ts` | vez do computador (tempos, controles travados) e erro de mira por nível |
| `e2e/sinuca-de-bar/ia-worker.spec.ts` | mesma semente = mesma tacada, worker que falha (reserva), resposta atrasada descartada |
| `e2e/sinuca-de-bar/bordas.spec.ts` | quadro negativo/gigante, foco, um laço só, sair pelo hub e voltar, storage bloqueado e config corrompida |
| `e2e/sinuca-de-bar/responsivo.spec.ts` | 390 px (projeto `celular`): sem rolagem lateral, toque mira e arrasta a branca |
| `e2e/sinuca-de-bar/piloto.spec.ts` | projeto `longa`: partidas inteiras (lisas e ímpares × pares contra o Pato, 2 jogadores) com cada tacada recalculada por `resolveShot`; mesma semente = mesmo `partida-<n>.json` |

Regra → teste (gerada por `npm run test:e2e:cobertura -- --md sinuca-de-bar`):

| Regra | Testes |
|---|---|
| SB-RN-01 | `menu.spec.ts` |
| SB-RN-02 | `bordas.spec.ts`, `menu.spec.ts` |
| SB-RN-03 | `menu.spec.ts`, `navegacao.spec.ts` |
| SB-RN-04 | `mira-forca.spec.ts` |
| SB-RN-05 | `mira-forca.spec.ts` |
| SB-RN-06 | `mira-forca.spec.ts` |
| SB-RN-07 | `mira-forca.spec.ts` |
| SB-RN-08 | `mira-forca.spec.ts` |
| SB-RN-09 | `mira-forca.spec.ts` |
| SB-RN-10 | `saida.spec.ts` |
| SB-RN-11 | `saida.spec.ts` |
| SB-RN-12 | `saida.spec.ts` |
| SB-RN-13 | `saida.spec.ts` |
| SB-RN-14 | `saida.spec.ts` |
| SB-RN-15 | `grupos-vez.spec.ts` |
| SB-RN-16 | `grupos-vez.spec.ts` |
| SB-RN-17 | `grupos-vez.spec.ts` |
| SB-RN-18 | `grupos-vez.spec.ts` |
| SB-RN-19 | `faltas-bola-na-mao.spec.ts` |
| SB-RN-20 | `faltas-bola-na-mao.spec.ts` |
| SB-RN-21 | `faltas-bola-na-mao.spec.ts` |
| SB-RN-22 | `faltas-bola-na-mao.spec.ts` |
| SB-RN-23 | `faltas-bola-na-mao.spec.ts` |
| SB-RN-24 | `faltas-bola-na-mao.spec.ts` |
| SB-RN-25 | `castigo.spec.ts` |
| SB-RN-26 | `castigo.spec.ts` |
| SB-RN-27 | `castigo.spec.ts` |
| SB-RN-28 | `castigo.spec.ts` |
| SB-RN-29 | `castigo.spec.ts`, `piloto.spec.ts` |
| SB-RN-30 | `castigo.spec.ts` |
| SB-RN-31 | `computador.spec.ts` |
| SB-RN-32 | `computador.spec.ts` |
| SB-RN-33 | `ia-worker.spec.ts`, `piloto.spec.ts` |
| SB-RN-34 | `bordas.spec.ts` |
| SB-RN-35 | `bordas.spec.ts` |
| SB-RN-36 | `responsivo.spec.ts` |

---

## 16. Como contribuir

Leia o `CLAUDE.md` da raiz e o desta pasta antes de mexer. Mudou regra ou número: atualize a seção e
a tabela de parâmetros deste manual e o teste que cita a regra, no mesmo commit. Antes de entregar:
`npm run typecheck`, `npm run typecheck:e2e`, `npm run build` e a suíte do jogo (desktop e celular).
