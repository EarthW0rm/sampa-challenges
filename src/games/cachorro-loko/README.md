# Cachorro Loko

Jogo de esteiras em pixel art. Um vira-lata caramelo motoboy trabalha para o **LOKO DOG**, uma
lanchonete de cachorro-quente no centro de São Paulo. Os pedidos descem por esteiras em zigue-zague
e ele precisa pegar cada pacote no baú antes que caia na rua. Jogo infinito, 1 jogador, desktop ou
celular (≈ 390 px), com recorde.

Rota no hub: `#/jogos/cachorro-loko`.

Este README é o **manual** do jogo: toda regra ou mecânica tem um número `CL-RN-NN`, e cada número tem
pelo menos um teste de ponta a ponta que o cita no nome (seção 12). Mudou uma regra? Atualize a seção
dela, a tabela de parâmetros e o teste no mesmo commit.

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Controles](#2-controles)
3. [Telas e fluxo de uma partida](#3-telas-e-fluxo-de-uma-partida)
4. [Pedidos, esteiras e desvios](#4-pedidos-esteiras-e-desvios)
5. [Pega, pontos e vidas](#5-pega-pontos-e-vidas)
6. [Pacotes especiais e poderes](#6-pacotes-especiais-e-poderes)
7. [Nível, pausa e tempo](#7-nível-pausa-e-tempo)
8. [Pontuação e recorde](#8-pontuação-e-recorde)
9. [Opções do menu](#9-opções-do-menu)
10. [Parâmetros](#10-parâmetros)
11. [Arquitetura](#11-arquitetura)
12. [Como contribuir](#12-como-contribuir)
13. [Testes](#13-testes)

---

## 1. Início rápido

1. No título, aperte **Jogar** (ou `Enter`/`Espaço`).
2. O chapeiro joga os pedidos na esteira de cima. Olhe as **placas de desvio** no fim de cada esteira:
   verde ↓ manda o pacote para a esteira de baixo, vermelha → joga na rua.
3. Ande com `←`/`→` (ou `A`/`D`; no celular, segure o lado esquerdo ou direito da tela) e fique embaixo
   do pacote que vai cair na rua. Cada pacote pego vale 1 ponto.
4. Pacote que toca o asfalto tira uma vida. Não pegue as **bombas**. Com 0 vidas acaba o turno.

---

## 2. Controles

| Entrada | Controle | Ação |
|---|---|---|
| Teclado | `←` / `A` | andar para a esquerda (enquanto segura) |
| Teclado | `→` / `D` | andar para a direita (enquanto segura) |
| Teclado | `P` ou `Esc` | pausar / continuar |
| Teclado | `Enter` ou `Espaço` | no título: começar |
| Mouse | botões **Jogar**, **← Menu**, **Pausar**/**Continuar**, **Jogar de novo**, **Menu** | o que o rótulo diz |
| Toque | segurar a metade esquerda / direita do palco | andar para aquele lado; soltar para |

Detalhes (CL-RN-02 a CL-RN-04): segurar os dois lados ao mesmo tempo deixa o cachorro parado; as setas
redondas de toque só aparecem em telas de toque (`pointer: coarse`), mas as zonas cobrem o palco inteiro
em qualquer tela. O mouse também aciona as zonas (é um "toque" com o botão apertado).

---

## 3. Telas e fluxo de uma partida

| Tela | O que mostra | Saídas |
|---|---|---|
| **Carregando** | "Esquentando a chapa…" enquanto os PNGs carregam | — |
| **Título** | "CACHORRO LOKO", botão **Jogar**, recorde (se houver), como jogar e a legenda dos 7 pacotes | **Jogar**/`Enter`/`Espaço` → partida |
| **Partida** | barra (**← Menu**, "Nível N", **Pausar**), canvas 640×400 e HUD | pausa, fim do turno, **← Menu** → título |
| **Pausa** | diálogo "PAUSA" sobre o canvas: **Continuar**, **Menu** | continuar, título |
| **Fim do turno** | diálogo "FIM DO TURNO": entregas, recorde ou "Novo recorde!", **Jogar de novo**, **Menu** | nova partida, título |

### CL-RN-01 Título e início

O título mostra o recorde salvo ("Recorde: N") só quando ele é maior que 0. **Jogar**, `Enter` e `Espaço`
começam a partida, sempre do zero: 3 vidas, 0 pontos, nível 1, cachorro em x = 140 olhando para a direita.

### CL-RN-30 HUD

- **Esquerda:** corações (cheios = vidas; o HUD mostra no mínimo 3 e no máximo `MAX_LIVES` = 5) e um
  ícone por poder ativo com o nome e os segundos restantes **arredondados para cima** (`Turbo 8s`,
  `Grau 10s`, `Ímã 8s`, `×2 10s`).
- **Direita:** `ENTREGAS 000` (placar com 3 dígitos) e `RECORDE 000`, que vira `NOVO RECORDE!` quando o
  placar passa do recorde do início da partida.
- **Barra:** `Nível N`. Textos que sobem no canvas: `+1`/`+2` (pega), `-1` (vida perdida), `+1 VIDA`,
  `TURBO!`, `GRAU!`, `IMA!`, `X2!`.

### CL-RN-28 Saídas e retorno

**← Menu** (barra) e **Menu** (pausa e fim do turno) voltam ao título do jogo; a barra
"← Sampa Challenges" do hub volta à home. Sair no meio da partida descarta a partida: **o recorde não é
salvo** (veja CL-RN-27). Voltar ao jogo abre o título de novo e a próxima partida começa do zero.

---

## 4. Pedidos, esteiras e desvios

### CL-RN-05 Saída dos pedidos

O primeiro pedido sai 1 s depois do início. Os seguintes saem a cada `intervalo` do nível (CL-RN-23)
com variação aleatória de ±15%. O chapeiro só joga um pacote se a boca da esteira 1 estiver livre (nenhum
pacote caindo nela nem sobre ela com x < `SPAWN_POS.x + 18`); se estiver ocupada, tenta de novo em 0,25 s.
O pacote sai em `SPAWN_POS` e cai na esteira 1.

### CL-RN-06 Esteiras e sentido

São 4 esteiras em zigue-zague (→ ← → ←, tabela `BELTS`), todas na mesma velocidade do nível (CL-RN-23).
Quando o centro do pacote chega à ponta de saída (x1 se → , x0 se ←), o desvio daquela esteira decide se
ele **desce** para a esteira de baixo (cai com um empurrãozinho de 12 px/s no sentido da esteira e é
encaixado dentro dela) ou vai **para a rua**. A última esteira sempre joga na rua.

### CL-RN-07 Desvio troca a cada pacote

Cada uma das 3 primeiras esteiras tem um desvio com o destino do **próximo** pacote. Não há relógio:
quando um pacote passa, ele segue o destino mostrado e o desvio troca (desce ↔ rua). Se o primeiro pacote
desceu, o segundo vai para a rua, o terceiro desce, e assim por diante. **Bombas também contam.** Os três
desvios começam em posições sorteadas a cada partida.

### CL-RN-08 Aviso de troca

Logo depois de trocar, a placa pisca por `FLASH_TIME` = 0,5 s entre o destino antigo e o novo (só aviso
visual; o destino que vale já é o novo).

### CL-RN-09 Arremesso para a rua

O pacote jogado na rua sai com velocidade horizontal de 18 a 28 px/s (sorteada) no sentido da esteira e
um pulinho de 30 px/s para cima; depois cai com `GRAVITY` = 320 px/s². Só pacotes na rua podem ser pegos
ou se perder; eles são desenhados na frente do cachorro.

---

## 5. Pega, pontos e vidas

### CL-RN-02 Andar

Segurando `←`/`A` ou `→`/`D` o cachorro anda a `DOG_SPEED` = 160 px/s (lógicos) e passa a olhar para o lado
em que anda. Soltar para na hora (sem inércia). As duas direções juntas se anulam (parado, sem virar).

### CL-RN-03 Limites da rua

A posição do cachorro (canto esquerdo do quadro de 40 px) fica sempre entre `DOG_MIN_X` = −2 e
`DOG_MAX_X` = 282; segurar a seta contra a borda não passa dela.

### CL-RN-04 Toque

Segurar a metade esquerda do palco anda para a esquerda; a direita, para a direita. Soltar o dedo, cancelar
o toque ou arrastar o dedo para fora da metade para o cachorro.

### CL-RN-10 Pega

Um pacote na rua é pego quando o quadrado dele (12×12) encosta na **área de pega**: `CATCH_RECT`
(x 1, y 10, 34×16 dentro do quadro do cachorro virado para a direita; espelhada quando ele olha para a
esquerda), que cobre o baú e o corpo. A pega é testada antes do chão no mesmo quadro: pacote que encosta
na área ao mesmo tempo em que toca o asfalto conta como pego.

### CL-RN-11 Ponto por pacote

Todo pacote que não é bomba vale 1 ponto (2 com o Dobro ativo, CL-RN-20), inclusive os especiais.
Caixa, pizza e sacola são só visuais (sorteio 2:1:1).

### CL-RN-12 Vidas e pacote perdido

A partida começa com `START_LIVES` = 3 vidas. Pacote (não bomba) que toca o asfalto (`GROUND_Y` = 180) ou
sai pelas laterais da tela tira 1 vida e deixa uma caixa amassada no chão.

### CL-RN-13 Bomba

Pegar uma bomba tira 1 vida, mostra uma explosão e deixa o cachorro **tonto** por `DIZZY_TIME` = 1 s:
ele pisca e não anda (as teclas são ignoradas), mas a área de pega continua valendo. Bomba que cai no
asfalto (ou sai pela lateral) explode **sem dano**.

### CL-RN-14 Quando aparecem bombas

Só a partir de `BOMBS_FROM_SCORE` = 15 pontos. Cada pedido tem chance de bomba de 10% + 1% por nível acima
do 2, até 18% (nível 10 em diante).

### CL-RN-26 Fim do turno

Com 0 vidas o turno acaba: tudo para, o cachorro fica tonto, o botão **Pausar** é desabilitado e, 1,2 s
depois, aparece o diálogo "FIM DO TURNO" com as entregas e o recorde ("Novo recorde!" se bateu).
**Jogar de novo** começa uma partida nova (CL-RN-01); **Menu** volta ao título. Depois do fim nada mais
pontua nem tira vida, nem os pacotes que chegariam no mesmo quadro.

---

## 6. Pacotes especiais e poderes

| Pacote | Efeito | Duração |
|---|---|---|
| Caixa, pizza, sacola | +1 ponto (só muda o visual) | — |
| Turbo | moto mais rápida (`DOG_TURBO_SPEED` = 215 px/s, +34%), com fogo no escapamento | 8 s |
| Grau | a moto empina; a área de pega sobe `GRAU_LIFT` = 10 px (pega antes) | 10 s |
| Ímã | puxa para o baú os pacotes que caem a até `IMA_RANGE` = 52 px (bombas também!) | 8 s |
| Vida | +1 coração, até 5 | — |
| Dobro | cada pacote vale 2 | 10 s |
| Bomba | não pegue | — |

### CL-RN-15 Sorteio dos especiais

Cada pedido que não é bomba conta no contador de comuns. A partir do 5º seguido, cada um tem 22% de
chance de ser especial; o 11º é especial garantido. Ao sair um especial o contador zera. O especial é
sorteado entre turbo, grau, ímã e dobro (peso 1 cada) e vida (peso 0,7, só se faltar coração).
Bombas não contam nem zeram o contador.

### CL-RN-16 Turbo

Por `POWER_DURATION.turbo` = 8 s o cachorro anda a `DOG_TURBO_SPEED`.

### CL-RN-17 Grau

Por `POWER_DURATION.grau` = 10 s a área de pega sobe `GRAU_LIFT` px (o topo sobe e a base fica onde
estava: a área fica 10 px mais alta).

### CL-RN-18 Ímã

Por `POWER_DURATION.ima` = 8 s, todo pacote na rua abaixo de y = 70 cujo centro esteja a menos de
`IMA_RANGE` px (na horizontal) do centro da área de pega é puxado para ela (até 160 px/s). Puxa bombas
também, de propósito.

### CL-RN-19 Vida

+1 vida, até `MAX_LIVES` = 5. Com 5 vidas a caixa de vida não é mais sorteada.

### CL-RN-20 Dobro

Por `POWER_DURATION.dobro` = 10 s cada pacote pego vale 2 pontos. A própria caixa de dobro vale 1 (o dobro
começa depois dela) e uma caixa de vida pega durante o dobro vale 2.

### CL-RN-21 Repegar um poder

Pegar um poder que já está ativo **reinicia** o tempo dele para a duração cheia (não soma). Poderes
diferentes valem ao mesmo tempo.

---

## 7. Nível, pausa e tempo

### CL-RN-22 Nível

`nível = floor(pontos / 10) + 1`: sobe a cada 10 pontos (com o Dobro, sobe mais rápido).

### CL-RN-23 Curva de dificuldade

| Grandeza | Fórmula | Nível 1 | Nível 5 | Limite |
|---|---|---|---|---|
| Velocidade das esteiras | `24 + 4·(nível−1)` px/s | 24 | 40 | 64 (nível 11+) |
| Intervalo entre pedidos | `3,4 · 0,9^(nível−1)` s (±15% aleatório) | 3,4 | 2,23 | 1,1 (nível 12+) |
| Chance de bomba | `10% + 1% por nível acima do 2` (a partir de 15 pontos) | — | 13% | 18% (nível 10+) |

A velocidade vale para todos os pacotes nas esteiras assim que o nível muda; o intervalo novo vale a
partir do próximo pedido.

### CL-RN-24 Pausa

`P`, `Esc` ou o botão **Pausar** pausam; `P`, `Esc`, **Continuar** (barra ou diálogo) continuam. Na pausa
nada anda (esteiras, pacotes, poderes, tontura, sorteio) e o diálogo "PAUSA" cobre o canvas. Ao pausar e
ao continuar, as teclas e toques seguros são soltos (o cachorro não sai andando sozinho). No fim do turno
a pausa não funciona.

### CL-RN-25 Perda de foco

Quando a janela perde o foco (trocar de aba ou de programa) a partida pausa sozinha. Ao voltar ela
continua pausada até o jogador continuar.

### CL-RN-29 Quadros fora do normal

O tempo de cada quadro é limitado a 0–0,05 s: um primeiro quadro com tempo negativo não faz nada e uma
aba que volta depois de muito tempo avança só 0,05 s (o jogo não "pula" pacotes nem perde vidas de uma
vez).

---

## 8. Pontuação e recorde

### CL-RN-27 Recorde

- O recorde fica no `localStorage`, chave `cachorro-loko:recorde` (número inteiro).
- Durante a partida, `RECORDE` no HUD acompanha o placar quando ele passa do recorde, e o texto vira
  `NOVO RECORDE!`.
- É salvo **só no fim do turno** (0 vidas) e só se o placar for maior que o recorde do início da
  partida. Sair pelo **← Menu**, pelo **Menu** da pausa ou pela barra do hub não salva.
- Aparece no título ("Recorde: N") e no card do hub ("Recorde N").
- Valor inválido no armazenamento (texto, negativo, vazio) conta como 0; fração é truncada. Com o
  armazenamento bloqueado (modo privado) o jogo funciona normalmente, sem recorde.

---

## 9. Opções do menu

O jogo não tem opções nem som. O título só tem **Jogar**; o que fica guardado é o recorde (CL-RN-27).

---

## 10. Parâmetros

### `game/constants.ts`

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 320 × 200 | resolução lógica (posições e colisões) |
| `SCALE` (`game/hires.ts`) | 2 | o canvas tem 640×400 e os sprites ganham o dobro de detalhe (Scale2x) |
| `GROUND_Y` | 180 | linha do asfalto onde o pacote se perde |
| `GRAVITY` | 320 px/s² | queda dos pacotes |
| `BOX_SIZE` | 12 | tamanho dos pacotes (quadrado de colisão) |
| `DOG_FRAME` | 40 | lado do quadro do cachorro |
| `DOG_WHEEL_ROW` | 38 | linha do quadro onde as rodas tocam a rua |
| `DOG_BOTTOM` | 190 | y da rua sob as rodas |
| `DOG_Y` | `DOG_BOTTOM − DOG_WHEEL_ROW` = 152 | topo do quadro do cachorro |
| `DOG_SPEED` / `DOG_TURBO_SPEED` | 160 / 215 px/s | velocidade da moto (normal / turbo) |
| `DOG_MIN_X` / `DOG_MAX_X` | −2 / `W − DOG_FRAME + 2` = 282 | limites da rua |
| `CATCH_RECT` | x 1, y 10, 34×16 | área de pega no quadro virado para a direita (espelha ao virar) |
| `GRAU_LIFT` | 10 px | quanto o grau sobe a área de pega |
| `IMA_RANGE` | 52 px | alcance horizontal do ímã |
| `BELTS` | 4 esteiras (veja abaixo) | posição, altura e sentido (`BeltDef`: `x0`, `x1`, `y`, `dir`) |
| `RESTAURANT_POS`, `CHEF_POS`, `SPAWN_POS` | (104, 2), (126, 26), (172, 40) | restaurante, chapeiro e boca de saída |
| `START_LIVES` / `MAX_LIVES` | 3 / 5 | vidas iniciais / máximo |
| `POWER_DURATION` | turbo 8, grau 10, ímã 8, dobro 10 s | duração dos poderes |
| `BOMBS_FROM_SCORE` | 15 | pontos antes de aparecer bomba |
| `DIZZY_TIME` | 1 s | tontura ao pegar bomba |

Esteiras (a ponta de saída de cada uma fica em cima da próxima, para o pacote cair nela):

| Esteira | x0 → x1 | y | Sentido | Centro do pacote ao chegar ao asfalto (rua) |
|---|---|---|---|---|
| 1 | 166 → 250 | 58 | → | x ≈ 267–277 |
| 2 | 64 → 262 | 84 | ← | x ≈ 40–48 |
| 3 | 52 → 270 | 110 | → | x ≈ 284–291 |
| 4 | 84 → 282 | 136 | ← (sempre na rua) | x ≈ 67–73 |

### Topo e corpo do motor (`game/engine.ts`)

| Parâmetro | Valor | Efeito |
|---|---|---|
| `FLASH_TIME` | 0,5 s | pisca da placa de desvio depois de trocar |
| `GAME_OVER_DELAY` | 1,2 s | atraso do fim (o diálogo usa o mesmo 1,2 s, medido no React) |
| `POWER_LABEL` | `TURBO!`, `GRAU!`, `IMA!`, `X2!` | texto que sobe ao pegar o poder |
| `beltSpeed` | `min(24 + 4·(nível−1), 64)` px/s | velocidade das esteiras |
| `spawnEvery` | `max(3,4 · 0,9^(nível−1), 1,1)` s | intervalo base entre pedidos (×0,85 a 1,15) |
| primeiro pedido / nova tentativa | 1 s / 0,25 s | `spawnTimer` no início / com a boca ocupada |
| boca ocupada | pacote na queda ou na esteira 1 com x < `SPAWN_POS.x + 18` | trava o próximo pedido |
| chance de bomba | `0,1 + min(0,08, (nível−2)·0,01)` | a partir de `BOMBS_FROM_SCORE` |
| especiais | 5 comuns → 22%; 11º garantido; vida peso 0,7 | `pickKind()` |
| visual comum | caixa 2 : pizza 1 : sacola 1 | só aparência |
| desce | `vx = 12·dir` px/s | empurrão ao descer para a próxima esteira |
| rua | `vx = dir·(18 a 28)`, `vy = −30` px/s | arremesso |
| ímã | y > 70, `vx = clamp(6·dx, ±160)` | puxão |
| cachorro inicial | x = 140, olhando para a direita | começo de cada partida |
| `dt` | 0 a 0,05 s | limite do quadro (CL-RN-29) |
| efeitos | poeira a cada 0,14 s; brilho 0,3 s; explosão 0,45 s; caixa amassada 1,6 s; textos 0,9 s | só visual |

Em testes com um robô jogando (25 partidas), a média ficou em ~29 entregas (≈ 107 s) por partida, com
a primeira vida perdida por volta dos 60 s. Com os desvios trocando por relógio eram ~19 entregas
(≈ 80 s). O robô enxerga a ordem dos pacotes perfeitamente, então uma pessoa deve ir um pouco pior.

---

## 11. Arquitetura

Mapa dos arquivos, ciclo de um pacote e armadilhas no [`CLAUDE.md`](./CLAUDE.md) do jogo.

```
Game.tsx ── TitleScreen (React)
        └── GameScreen (React: barra, HUD, zonas de toque, diálogos)
               │  Input (teclado + toque) ──▶ CachorroLokoEngine.update(dt) ──onHud──▶ HUD
               │  requestAnimationFrame ────▶ CachorroLokoEngine.render(ctx)  (canvas 640×400)
               └── e2eHook (só na página de teste)
```

| Camada | Arquivo | Regra |
|---|---|---|
| Motor | `game/engine.ts` | TypeScript puro (sem React); lógica em 320×200; sorteios pelo `rng` (padrão `Math.random`) |
| Números | `game/constants.ts` | todos os parâmetros de equilíbrio |
| Telas | `Game.tsx`, `components/` | título, partida, HUD e diálogos em React DOM |
| Recorde | `game/record.ts` | `cachorro-loko:recorde`, sempre em `try/catch` |
| Testes E2E | `game/e2eHook.ts` + `e2e/cachorro-loko/` | gancho só de leitura (inerte para o jogador) |

---

## 12. Como contribuir

1. Leia o [`CLAUDE.md` da raiz](../../../CLAUDE.md) e o [`CLAUDE.md` do jogo](./CLAUDE.md).
2. Ache a regra pelo número (`CL-RN-NN`) e o teste que a cita (`npm run test:e2e -- -g "CL-RN-07"`).
3. Mudou regra, controle ou número? Atualize a seção da regra e a tabela de parâmetros **no mesmo commit**,
   e o teste junto.
4. Antes de entregar: `npm run typecheck`, `npm run typecheck:e2e`, `npm run build`, a suíte do jogo
   (desktop e celular) e, se mexeu em equilíbrio, o piloto (`npm run test:e2e:longa -- cachorro-loko/`).
5. Teste no navegador em desktop e a ≈ 390 px; a barra "← Sampa Challenges" volta ao hub.

---

## 13. Testes

Testes de ponta a ponta no navegador (Playwright, guia em [`e2e/README.md`](../../../e2e/README.md)). Eles
jogam pela tela (teclado, toque, cliques) com o relógio controlado (1 quadro = 1/60 s) e a semente do
sorteio fixa; o gancho `game/e2eHook.ts` só lê o estado e, em pré-condições raras e comentadas, prepara
pacotes, vidas ou placar.

```bash
npm run test:e2e -- e2e/cachorro-loko/                    # suíte rápida do jogo (desktop + 390 px, ~45 s)
npm run test:e2e -- -g "CL-RN-07"                         # uma regra pelo número
npm run test:e2e -- --project=celular e2e/cachorro-loko/  # só 390 px
caffeinate -dimsu npm run test:e2e:longa -- e2e/cachorro-loko/   # piloto: partidas inteiras (~1,5 min)
npm run test:e2e:cobertura -- --jogo cachorro-loko        # cada CL-RN tem teste?
```

Use o caminho com `e2e/` no filtro: o filtro é uma expressão sobre o caminho completo, e `cachorro-loko/`
sozinho também casa com a pasta do worktree `.worktrees/cachorro-loko/` (roda todos os testes).

| Arquivo | Cobertura |
|---|---|
| `e2e/cachorro-loko/navegacao.spec.ts` | título (Enter, Espaço, Jogar), gancho só com a flag de teste, ← Menu, volta ao hub; fim do turno (diálogo, Pausar desabilitado, P ignorado), recorde salvo e exibido no título e no card do hub, Jogar de novo; nada pontua depois do fim (bug corrigido); sair no meio não salva |
| `e2e/cachorro-loko/movimento.spec.ts` | `DOG_SPEED` com setas e A/D, virar, parar ao soltar, duas teclas se anulam, limites `DOG_MIN_X`/`DOG_MAX_X`; zonas de toque (mouse) |
| `e2e/cachorro-loko/esteiras-desvios.spec.ts` | primeiro pedido, boca ocupada (0,25 s), intervalo ±15%; velocidade e sentido das esteiras; desvio alternando a cada pacote desde a posição sorteada, bomba incluída, última esteira sempre na rua; pisca de 0,5 s; arremesso (vx 18–28, vy −30, gravidade) |
| `e2e/cachorro-loko/pega-vidas.spec.ts` | área de pega (baú, corpo, espelhada), ponto e HUD, pacote no asfalto e na lateral, bomba (vida, tontura sem andar mas pegando, explosão sem dano no chão) |
| `e2e/cachorro-loko/poderes.spec.ts` | turbo (velocidade, duração, repegar reinicia, HUD em segundos), grau (`GRAU_LIFT`), ímã (alcance, puxa bomba, fora do alcance cai), vida até `MAX_LIVES`, dobro (a própria caixa vale 1, vida no dobro vale 2) |
| `e2e/cachorro-loko/nivel.spec.ts` | nível a cada 10 pontos, curva e limites da velocidade e do intervalo, intervalo real no piso; bombas só a partir de `BOMBS_FROM_SCORE`, especial entre o 5º e o 11º comum, vida não sai com 5+ vidas |
| `e2e/cachorro-loko/pausa.spec.ts` | P, Esc, Pausar/Continuar, Menu da pausa; nada anda na pausa; teclas soltas ao continuar; perda de foco |
| `e2e/cachorro-loko/bordas.spec.ts` | quadro gigante (0,05 s), aba em segundo plano, armazenamento bloqueado, recorde corrompido/fração/negativo, StrictMode (1 laço, 1 listener), sair pelo hub no meio e voltar |
| `e2e/cachorro-loko/responsivo.spec.ts` | 390 px: sem rolagem lateral, canvas na proporção, HUD e barra na largura; toque real (CDP) nas zonas e setas visíveis |
| `e2e/cachorro-loko/piloto.spec.ts` | projeto `longa`: sementes 11, 23 e 37 até 0 vidas passando do nível 3; placar e vidas recalculados pelos eventos, recorde no diálogo, no título e no card do hub; semente 37 jogada 2× dá o mesmo `partida-<n>.json` |

Regra → teste (gerada por `npm run test:e2e:cobertura -- --md cachorro-loko`):

| Regra | Testes |
|---|---|
| CL-RN-01 | `navegacao.spec.ts`, `responsivo.spec.ts` |
| CL-RN-02 | `movimento.spec.ts` |
| CL-RN-03 | `movimento.spec.ts` |
| CL-RN-04 | `movimento.spec.ts`, `responsivo.spec.ts` |
| CL-RN-05 | `esteiras-desvios.spec.ts`, `pausa.spec.ts` |
| CL-RN-06 | `esteiras-desvios.spec.ts` |
| CL-RN-07 | `esteiras-desvios.spec.ts`, `piloto.spec.ts` |
| CL-RN-08 | `esteiras-desvios.spec.ts` |
| CL-RN-09 | `esteiras-desvios.spec.ts` |
| CL-RN-10 | `pega-vidas.spec.ts` |
| CL-RN-11 | `pega-vidas.spec.ts` |
| CL-RN-12 | `pega-vidas.spec.ts` |
| CL-RN-13 | `pega-vidas.spec.ts` |
| CL-RN-14 | `nivel.spec.ts` |
| CL-RN-15 | `nivel.spec.ts`, `piloto.spec.ts` |
| CL-RN-16 | `poderes.spec.ts` |
| CL-RN-17 | `poderes.spec.ts` |
| CL-RN-18 | `poderes.spec.ts` |
| CL-RN-19 | `poderes.spec.ts` |
| CL-RN-20 | `poderes.spec.ts` |
| CL-RN-21 | `poderes.spec.ts` |
| CL-RN-22 | `nivel.spec.ts` |
| CL-RN-23 | `nivel.spec.ts` |
| CL-RN-24 | `bordas.spec.ts`, `pausa.spec.ts` |
| CL-RN-25 | `pausa.spec.ts` |
| CL-RN-26 | `navegacao.spec.ts`, `piloto.spec.ts` |
| CL-RN-27 | `bordas.spec.ts`, `navegacao.spec.ts`, `piloto.spec.ts` |
| CL-RN-28 | `bordas.spec.ts`, `navegacao.spec.ts` |
| CL-RN-29 | `bordas.spec.ts` |
| CL-RN-30 | `pega-vidas.spec.ts`, `poderes.spec.ts`, `responsivo.spec.ts` |
