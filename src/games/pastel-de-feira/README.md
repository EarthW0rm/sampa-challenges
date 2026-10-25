# Pastel de Feira

Jogo de gestão em pixel art: você é o pasteleiro de uma barraca de feira em São Paulo. Em cada
**Dia de Feira** (4 minutos reais, das 7h às 14h no relógio do jogo) anota pedidos, monta, frita no
ponto, mói o caldo de cana, entrega e cobra. Entre os dias, no **Preparo**, compra insumos, ajusta o
cardápio e os preços, melhora a barraca, contrata equipe e tenta bater a **meta** de cada um dos 20
dias da campanha. Depois do dia 20 vem o **modo livre**. 1 jogador, desktop ou celular (≈ 390 px).

Rota no hub: `#/jogos/pastel-de-feira`.

Este README é o manual do jogo e o guia de quem contribui. As regras de negócio completas, numeradas
(`RN-xx`), estão em [`docs/specs/pastel-de-feira/spec.md`](../../../docs/specs/pastel-de-feira/spec.md);
a arquitetura, em [`plan.md`](../../../docs/specs/pastel-de-feira/plan.md). Quando o número aqui difere da
spec, vale o código: os valores marcados com **(P)** foram calibrados pela simulação sem tela
([`calibracao.md`](../../../docs/specs/pastel-de-feira/calibracao.md)).

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Controles](#2-controles)
3. [Telas e o ciclo de um dia](#3-telas-e-o-ciclo-de-um-dia)
4. [O Dia de Feira](#4-o-dia-de-feira)
5. [Cardápio, insumos e estoque](#5-cardápio-insumos-e-estoque)
6. [A barraca: equipamentos, espaço e mesas](#6-a-barraca-equipamentos-espaço-e-mesas)
7. [Equipe e escritório](#7-equipe-e-escritório)
8. [Delivery e encomendas](#8-delivery-e-encomendas)
9. [Promoções, tema e desafios](#9-promoções-tema-e-desafios)
10. [Estações do ano e eventos](#10-estações-do-ano-e-eventos)
11. [Campanha: metas, falência, modo livre e save](#11-campanha-metas-falência-modo-livre-e-save)
12. [Parâmetros](#12-parâmetros)
13. [Arquitetura](#13-arquitetura)
14. [Como contribuir](#14-como-contribuir)
15. [Testes](#15-testes)
16. [Depuração](#16-depuração)

---

## 1. Início rápido

1. **Nova campanha**: escolha o perfil do pasteleiro, se quer eventos e o tutorial do dia 1 e, nas opções,
   o capital inicial, o dia em que começa, se os funcionários cansam e se as melhorias ficam liberadas desde já.
2. **Preparo**: na aba Insumos, use **Usar sugerida** e **Comprar tudo** (dias 1 a 3). Confira o
   cardápio e os preços. Toque em **Abrir a feira**.
3. **Dia de Feira**: quando um cliente chegar, vá ao **balcão** e toque em **ANOTAR**. Vá à
   **bancada**, toque nos recheios do pedido e em **FECHAR**. No **tacho**, toque num **CESTO** livre;
   espere o ponto (barra verde) e toque de novo para tirar. Se o pedido tem caldo, **segure** o botão
   da **moenda** por 6 s. Volte ao balcão, toque no item pronto e depois no cliente. Toque em
   **COBRAR** para levar as moedas ao caixa.
4. **Fechamento** (14h): veja o lucro, a reputação e se a meta foi cumprida. Prepare o próximo dia.

Meta do dia 1: lucro de R$ 70 e reputação 2,0 ou mais. Meta não cumprida repete o dia; nada se perde.

---

## 2. Controles

O toque/clique é o controle completo. No desktop também há teclado (RN-174).

| Controle | Ação |
|---|---|
| Toque numa estação | o pasteleiro anda até ela; o **painel** da estação abre quando ele chega |
| Toque num controle do painel | executa a ação (anotar, ingrediente, fechar, cesto, cobrar…) |
| Segurar (moenda, troca de óleo, vassoura, limpar mesa) | a ação dura enquanto o dedo/tecla estiver pressionado |
| Toque num item pronto e depois no cliente | entrega |
| Toque na faixa de avisos (topo) | aceita a oferta do app |
| Toque num funcionário | manda descansar (só no modo fixo) |
| Toque fora do painel ou 4 s sem interação | recolhe o painel |
| `1` a `9` | vai à estação (na ordem da barraca) |
| Setas | escolhem o controle do painel |
| `Espaço` / `Enter` | ativa (ou segura) o controle em foco |
| `Esc` | recolhe o painel |
| `P` | pausa (também pelo botão **Pausa** ou ao trocar de aba) |
| `M` | liga/desliga efeitos e música |
| `F` | acelera 2× (indisponível nos passos guiados do tutorial) |

Os botões do painel têm pelo menos 72×72 unidades lógicas (≈ 44 px a 390 px de largura). Cada
insumo e cada pastel tem rótulo próprio de até 8 letras: `C.seca`, `Q.minas`, `Carne+1` (versão 1),
`Puro`, `Limao`…

---

## 3. Telas e o ciclo de um dia

| Tela | O que acontece |
|---|---|
| **Título** | Continuar (com save), Nova campanha (pede confirmação se há save), Sair. Mostra o recorde |
| **Nova campanha** | Perfil do pasteleiro, eventos liga/desliga, tutorial do dia 1. Opções (RN-55a): capital inicial (padrão do perfil, +R$ 100 por toque, até R$ 100.000), dia inicial (1 a 20), cansaço dos funcionários liga/desliga e liberar, sem esperar o dia mínimo, melhorias, receitas, áreas, a aba Equipe e a Associação (desafios) |
| **Preparo** | Fora do relógio. Abas: Insumos, Cardápio, Melhorias, Equipe (dia 2), Escritório (com escritório), Associação (dia 3). Previsão do dia, meta, balões de novidade e tema (dia 5) |
| **Dia de Feira** | Canvas 640×480 lógico + HUD (relógio, caixa, fila, estrelas, som, música, 1×/2×, pausa) |
| **Fechamento** | Balanço, meta, reputação, pedidos, desperdício. Salva e volta ao Preparo |
| **Fim de campanha** | Falência. A partir do dia 10, oferece passar o ponto |

O progresso é salvo no Preparo, no início do Dia de Feira (checkpoint) e no fechamento (RN-55). Sair
no meio do dia descarta o dia; ao voltar, ele recomeça às 07h com as compras feitas e um **novo
sorteio** de clientes, ofertas e eventos surpresa (JA-06).

---

## 4. O Dia de Feira

### 4.1 Relógio e corte seco (RN-01, RN-07)

- O dia vai das 07h às 14h e dura 240 s reais (1 hora de jogo ≈ 34 s). A simulação anda em passos
  fixos de 1/60 s; o 2× roda dois passos por quadro.
- **Corte seco às 14h:** não chega mais ninguém. Quem está na fila, nas mesas ou na fila de pagamento
  vai embora sem pagar **e sem falha**. Pedidos em produção, pastéis prontos e comandas não retiradas
  se perdem sem falha; pastéis prontos e montados contam como desperdício.
- Moedas que ficaram no balcão sem cobrar não entram no caixa: cobre antes das 14h.

### 4.2 Clientes, fila e paciência (RN-02 a RN-06b)

- Intervalo médio entre clientes: 12 s no dia 1, caindo 4% ao dia, mínimo 4 s. Das 10h às 12h a
  chegada é 1,5×. Reputação abaixo de 2 reduz a chegada em 30%.
- Fila do balcão: no máximo **6**. Quem chega com a fila cheia vai embora (falha de peso 0,5).
- Pedido: 1 a 2 pastéis e 0 a 1 caldo (chance base de caldo 40%), só do cardápio com insumo. Cada
  cliente pode pedir um **doce** além dos salgados: 25% (35% a partir das 11h).
- **Paciência** do primeiro da fila: Econômico 90 s, Padrão 80 s, Exigente 70 s **(P)**. Quem está
  atrás gasta mais devagar: ×1,0; 0,8; 0,6; 0,4; 0,3 por posição (RN-06b). A paciência **só começa a
  contar quando o pedido é anotado** (antes disso o cliente espera na fila sem desistir; a fila cheia,
  RN-04, segue limitando) e corre até o pedido completo ser entregue. Esgotada, o cliente vai embora sem
  pagar (falha de peso 1,0).
- Modificadores: perfil Boa-praça +15%; mesa ×1,5; curso de Atendimento de quem anota +5%; barraca
  com sujeira ≥ 60 gasta a paciência 25% mais rápido.

### 4.3 Perfis e preço (RN-10 a RN-19)

| Perfil | Teto de preço (× referência) | Nota mínima aceita |
|---|---|---|
| Econômico | 0,9 | 30 |
| Padrão | 1,2 | 50 |
| Exigente | 1,6 | 70 |

- Preço de venda: 50% a 250% da referência, em passos de R$ 0,50 (aba Cardápio). O preço padrão é
  90% da referência, arredondado para baixo.
- Mistura base: 50% Econômico, 40% Padrão, 10% Exigente. Quanto mais caro o cardápio, menos
  Econômicos e mais Exigentes; com preço médio ≥ 1,3× chega a 20/50/30.
- Reputação 4 sobe o teto de todos em 10%; reputação 5, em 20%.
- Cliente cujo item passa do teto vai embora sem pedir: não afeta a reputação, conta como "perdido
  por preço".
- Todo cliente pede um **sabor específico**; o Exigente pede também a versão. Entregar outro é item
  errado (RN-63). O jogador nunca oferece troca: ela só acontece quando o sabor esgota (RN-35):
  Econômico leva o da mesma categoria com mais estoque, Padrão um de preço igual ou menor, Exigente
  vai embora (falha 0,5).
- A partir do dia 6 a fatia de Exigentes sobe ao longo do dia (das 10h às 12h), até +100% no dia 20
  e no modo livre (RN-19).

### 4.4 Fluxo do pedido e ações do pasteleiro (RN-40 a RN-42)

`anotar` (balcão) → `montar` (bancada) → `colocar` (tacho) → `tirar no ponto` (tacho) →
[`estufa`] → [`caldo`] (moenda) → `entregar` (balcão) → `cobrar` (balcão).

**Selo do sabor:** cada pedido no balão, pastel no balcão, na bancada, na estufa e no tacho, e controle de
pastel no painel mostra um selo redondo com o desenho do sabor (bife, queijo com furos, fatia de pizza…),
para reconhecer o sabor pela forma e não só pela cor. Os pontinhos dourados no selo indicam a versão
melhorada (+1, +2). No balão, a linha já entregue fica clara com um visto. No Cardápio, o selo aparece ao
lado de cada receita.

| Ação | Como |
|---|---|
| Anotar | **ANOTAR** no balcão: anota o primeiro da fila ainda não anotado |
| Montar | toque em cada **recheio** e em **FECHAR** (temperos e massa entram sozinhos). **LIMPAR** esvazia a bandeja. Até 6 pastéis montados esperando |
| Colocar | toque num **CESTO** livre do tacho (o pastel selecionado ou o primeiro montado) |
| Tirar | toque no cesto ocupado |
| Estufa | toque no pastel pronto no painel da estufa |
| Caldo | **segure** o sabor na moenda: 6 s na manual, 2,5 s na motorizada, +0,3 s por nível de chorinho. Soltar guarda o progresso |
| Entregar | toque no item pronto no painel do balcão e depois no cliente |
| Cobrar | **COBRAR** (moedas) e **PAGAR** (fila de pagamento das mesas) |
| Trocar óleo | **segure TROCAR OLEO** por 8 s (soltar antes ou sair do tacho cancela sem custo) |
| Varrer | **segure VASSOURA** por 4 s: −25 de sujeira |
| Limpar mesa | **segure LIMPAR** nas mesas por 3 s |

**Deslocamento:** 0,4 s entre estações vizinhas, +0,2 s por estação a mais no caminho. Ele só age
onde está. Tocar outra estação durante o caminho troca o destino, sem enfileirar.

### 4.5 Fritura, nota e valor pago (RN-20 a RN-28)

- Nota na saída do óleo: **cru** (antes da janela) 40; **no ponto** 80; **passado** (depois da janela,
  antes de queimar) 55; **queimado** não vende, perde os insumos, suja a barraca (+3) e bloqueia o
  cesto até alguém tirar.
- Modificadores: Óleo de Algodão +10, Escorredor +10, óleo sujo (≥ 70%) −15, traço Caprichoso +5,
  curso de Fritura +5. Nota de 0 a 100.
- Pronto fora da estufa: perde 1 ponto/s depois de 20 s **(P)**. Na estufa: congelado por 60 s.
  Pastel entregue sem saquinho: −10.
- **Valor pago** = preço × fator de qualidade × prêmio de reputação × prêmio de mesa.
  - Fator de qualidade = 0,8 + 0,4 × nota/100 (de 0,8× a 1,2×).
  - Prêmio de reputação: 1,0 abaixo de 4; 1,10 com 4; 1,20 com 5.
  - Prêmio de mesa: 1,15 (+10% no tema Gourmet).
  - Caldo não tem nota: preço × prêmio de reputação.
- Pedido entregue abaixo da nota mínima do perfil é pago, mas conta como falha.

### 4.6 Óleo e sujeira (RN-46, RN-130 a RN-133)

- Óleo: +4% de sujeira por pastel (+3% com algodão). Em 70% conta como sujo (−15 na nota). Em 100% o
  tacho **trava** até a troca. Troca: R$ 25 (comum) ou R$ 45 (algodão); o tacho fica parado durante a
  troca (8 s pelo pasteleiro, 10 s por funcionário).
- Sujeira da barraca (0–100, começa o dia em 0): +1 por pedido entregue, +2 por cliente de mesa que
  sai, +3 por pastel queimado, +5 por troca de óleo.
- Limpeza: pasteleiro −25 com a vassoura (4 s); Ajudante ocioso −10 a cada 3 s.
- Efeitos: sujeira ≥ 60 deixa todos 20% menos pacientes e afasta Exigentes (75 no tema Popular);
  ≥ 80 soma +0,25 de falha a cada pedido entregue.

### 4.7 Reputação (RN-60 a RN-64)

- De 1,0 a 5,0, mostrada em estrelas de meia em meia. Persiste entre dias.
- Cada pedido termina como **sucesso** ou **falha**. Pesos das falhas: balcão/mesa 1,0; fila cheia ou
  sem insumo 0,5; comanda do app atrasada ou cancelada 3,0; app com nota abaixo de 40 1,0; encomenda
  atrasada 3,0; mesa que sai sem pagar 1,0; pedido entregue com sujeira ≥ 80 +0,25.
- **Encanto**: brinde entregue +1,5 **(P)**; caldo com chorinho +0,1 por nível; fiscal aprovado +2,0.
- Taxa do dia = (sucessos + encanto) ÷ (sucessos + encanto + falhas ponderadas). Variação no
  fechamento = (taxa − 0,75) × 4 acima de 0,75 e × 2 abaixo **(P)**, limitada a ±1,0. Dia sem pedido
  não muda a reputação. No tema Tradicional a variação positiva é +10%.
- Item errado: o cliente recusa, o item volta e o pedido vira falha (uma vez por pedido).

---

## 5. Cardápio, insumos e estoque

### 5.1 Receitas (RN-30)

Montagem = 1 etapa por recheio (temperos não contam). Tempos de fritura em segundos.

| Categoria | Receita | Recheio (+ massa) | Ponto | Queima | Ref. | Desbloqueio |
|---|---|---|---|---|---|---|
| Tradicional | Carne | carne | 5–8 | 10 | R$ 8,00 | inicial |
| Tradicional | Queijo | muçarela | 5–8 | 10 | R$ 8,00 | inicial |
| Tradicional | Frango | frango | 5–8 | 10 | R$ 8,00 | R$ 80 |
| Tradicional | Calabresa | calabresa + cebola | 5–8 | 10 | R$ 8,50 | R$ 80 |
| Tradicional | Bauru | muçarela + presunto + tomate | 6–9 | 11 | R$ 11,00 | R$ 150 |
| Tradicional | Frango com Catupiry | frango + catupiry | 6–9 | 11 | R$ 11,00 | R$ 150 |
| Tradicional | Pizza | tomate + muçarela + orégano | 6–9 | 11 | R$ 12,00 | R$ 150 |
| Nobre | Palmito | palmito + catupiry | 9–10,5 | 11,5 | R$ 16,00 | R$ 400, dia 6 |
| Nobre | Carne Seca | carne seca + queijo coalho | 9–10,5 | 11,5 | R$ 17,00 | R$ 450, dia 8 |
| Nobre | Camarão | camarão + catupiry | 9–10,5 | 11,5 | R$ 20,00 | R$ 600, dia 11 |
| Nobre | Bacalhau | bacalhau + azeitona | 9–10,5 | 11,5 | R$ 22,00 | R$ 700, dia 14 |
| Especial | Especial da Casa | 2 massas + carne + ovo + muçarela + azeitona | 10–12 | 13 | R$ 24,00 | R$ 500, dia 6 |
| Doce | Banana com Canela | banana + açúcar e canela | 4–6 | 7 | R$ 9,00 | R$ 100 |
| Doce | Doce de Leite | doce de leite | 4–6 | 7 | R$ 9,00 | R$ 100 |
| Doce | Romeu e Julieta | muçarela + goiabada | 4–6 | 7 | R$ 10,00 | R$ 150 |
| Doce | Banana com Queijo | banana + muçarela + açúcar e canela | 4–6 | 7 | R$ 10,00 | R$ 150 |
| Doce | Chocolate | chocolate ao leite | 4–6 | 7 | R$ 11,00 | R$ 200 |

- **Especial da Casa:** usa 2 massas e ocupa 2 cestos do mesmo tacho (no tacho pequeno, o tacho inteiro).
- **Melhorias de receita** (RN-30a), compradas em sequência; cada uma cria uma versão nova que
  convive com as anteriores (cada uma ocupa uma vaga). Melhoria 1: R$ 120, referência +20%.
  Melhoria 2: R$ 250, referência +40%. Acrescentar ingrediente soma 1 etapa; trocar mantém.

| Receita | Melhoria 1 | Melhoria 2 |
|---|---|---|
| Carne | + azeitona | + ovo |
| Queijo | muçarela → queijo minas | — |
| Palmito | + muçarela | — |
| Camarão | catupiry → cream cheese | — |
| Carne Seca | queijo coalho → catupiry | — |
| Doce de Leite | + paçoca | — |
| Chocolate | → chocolate branco | → creme de avelã |

- **Bebidas** (não ocupam vaga): Caldo puro (1 dose de cana; R$ 7,00; inicial), Caldo com limão
  (R$ 8,00; R$ 100), Caldo com abacaxi (R$ 9,00; R$ 180). Sem copo, o caldo sai do cardápio.
- **Vagas** (RN-30b): salgados começam com 3 (placas de 4 a 7: R$ 150, 300, 450, 600); doces com 2
  (placa de 3: R$ 150).
- **Fadiga** (RN-30c): com 4 ou mais receitas compradas, a que fica mais de 3 dias seguidos no
  cardápio perde 10% de procura por dia a mais, até −40%. Um dia fora zera.

### 5.2 Insumos e estoque (RN-32 a RN-39a)

- Custo unitário: massa R$ 0,80; carne 1,50; muçarela 1,40; queijo minas 1,60; queijo coalho 1,80;
  frango 1,30; calabresa 1,40; cebola 0,20; presunto 1,60; tomate 0,60; orégano 0,10; ovo 0,50;
  azeitona 0,40; catupiry 2,80; cream cheese 2,20; palmito 3,50; carne seca 3,80; camarão 4,50;
  bacalhau 5,50; banana 0,40; açúcar e canela 0,10; doce de leite 1,00; paçoca 0,50; goiabada 0,70;
  chocolate ao leite 1,20; chocolate branco 1,30; creme de avelã 1,60; cana (dose) 0,70;
  limão 0,30; abacaxi 0,60.
- Consumíveis (não estragam, não ocupam estoque): copo R$ 0,15 (1 por caldo), saquinho R$ 0,05 (1 por
  pastel), embalagem do app R$ 0,40 (1 por comanda).
- Só se compra no Preparo; não há reposição durante o dia. Item cujo insumo acaba sai do cardápio na
  hora.
- **1 massa = 1 pastel.** A massa vale 3 dias (usa-se a mais antiga primeiro). Recheios, cana e
  complementos que sobram **estragam no fechamento**.
- Capacidade: 120 unidades de alimento; +80 por **caixa térmica** (R$ 200, 1 m², máx. 2), onde os
  recheios duram +1 dia (os mais caros entram primeiro).
- **Compra sugerida** nos dias 1 a 3 (ou sempre, com Comprador).
- **Aviso antes de abrir** (RN-36a): falta de insumo, de saquinho ou de copo mostra "Voltar e
  comprar" / "Abrir mesmo assim".
- **Bônus de aproveitamento** (RN-37): se ninguém foi embora por falta de insumo, bônus = receita ×
  max(0; 15% − % de desperdício). Desperdício = unidades estragadas, vencidas e queimadas ÷ compradas.

---

## 6. A barraca: equipamentos, espaço e mesas

A barraca inicial tem 6 m² com balcão, bancada, 1 tacho pequeno (2 cestos) e moenda manual.

| Compra | Preço | Espaço | Efeito |
|---|---|---|---|
| m² extra | R$ 120 | — | +R$ 8/dia de taxa no fechamento. Máx. 24 m² |
| Tacho extra | R$ 350 | 2 m² | máx. 3 tachos |
| Cesto extra | R$ 200 por cesto | — | +1 cesto no primeiro tacho com menos de 4 (enche os tachos em ordem); tacho novo nasce com 2 |
| Termostato | R$ 350 por tacho | — | janela do ponto +50%, queima +3 s |
| Alarme do ponto | R$ 60 por tacho | — | pisca no ponto e 1 s antes de queimar |
| Cesto com timer | R$ 600 por tacho | — | tira sozinho no meio do ponto (nota 80 + equipamento) |
| Óleo de algodão | R$ 300 | — | nota +10, 3% de sujeira por pastel, troca R$ 45 |
| Escorredor profissional | R$ 250 | — | nota +10 |
| Estufa de vidro | R$ 300 | — | 6 vagas, nota congelada 60 s |
| Estufa grande | R$ 350 | — | 12 vagas (requer a estufa) |
| Moenda motorizada | R$ 500 | — | caldo em 2,5 s |
| Moenda automática | R$ 900 | — | um caldo por pedido anotado, sozinha (requer a motorizada) |
| Maquininha de cartão | R$ 300 | — | cobra sozinha o balcão e a fila de pagamento |
| Embalagem térmica | R$ 250 | — | o app não perde nota no transporte |
| Caixa térmica | R$ 200 | 1 m² | +80 de estoque, recheios +1 dia (máx. 2) |
| Mesa (4 lugares) | R$ 150 | 2 m² | máx. 4 |
| Área de delivery | R$ 600 | 3 m² | a partir do dia 5 |
| Escritório | R$ 1.500 | 4 m² | a partir do dia 10 |
| Área de descanso | R$ 120 (+R$ 80 por vaga) | 1 m² | 2 vagas, até 4 |
| Conta Parceira do app | R$ 400 | — | +4 comandas por dia |

Equipamentos de automação param na queda de energia e não somam com funcionário na mesma função
(RN-160 a RN-162).

### Mesas (RN-80 a RN-87)

- Com lugar limpo e livre, 30% dos Padrão e Exigentes escolhem a mesa, em grupos de 1 a 4
  (40/30/20/10%). O grupo faz um pedido só; a paciência é a do mais impaciente (×1,5).
- Sem garçom, o grupo pede e retira no balcão; com garçom (ou com o pasteleiro nas mesas), na mesa.
- Recebido o pedido, o grupo come por 25 s e vai para a **fila de pagamento** (máx. 4 grupos, 20 s
  de paciência; esgotada, sai sem pagar, falha 1,0). A mesa fica suja até alguém limpar.

---

## 7. Equipe e escritório

### 7.1 Funcionários (RN-40 a RN-49, RN-113 a RN-118)

- **Tipos:** Fritador (R$ 75/dia, o único que tira do óleo e troca o óleo; pode ocupar qualquer
  posição) e Geral (R$ 55/dia, todas as posições menos Fritador e Troca de óleo).
- Até 3 candidatos de cada tipo por dia, com 0 a 2 traços. Contratar e dispensar só no Preparo, sem
  passar do número de posições.
- **Traços:** Rápido (tempos −15%, salário +15%), Caprichoso (nota +5, +10%), Resistente (cansa 40%
  menos, +10%), Distraído (5% de errar o sabor, −15%), Pavio curto (reivindica 2×, −10%).
- **Cursos** (1 por funcionário por dia): Boas Práticas de Fritura R$ 120 (nota +5, troca de óleo 30%
  mais rápida, sem fogo na troca); Atendimento R$ 100 (balcão, garçom e expedição 20% mais rápidos,
  +5% de paciência); Higiene R$ 80 (sujeira −30%, limpeza 30% mais rápida).
- **Posições:** Fritador N, Balcão, Montagem N, Troca de óleo, Moenda e, com mesas e delivery, Garçom,
  Ajudante e Expedição (uma Montagem e um Fritador por tacho).
  - **Montagem:** monta na bancada e coloca o pastel em qualquer tacho com cesto livre, do primeiro para o último.
  - **Fritador:** cuida de tudo no tacho dele — coloca os pastéis já montados, tira no ponto, põe na estufa
    e troca o óleo quando passa de 70% —, mas **não monta**: sem ninguém na Montagem, quem monta é você. Os
    Fritadores assumem, em ordem, os tachos livres (sem o pasteleiro e sem fogo); sem tacho livre, fica parado.
  - **Troca de óleo:** só Fritador; volante, troca o óleo de qualquer tacho.
- **Fixo** fica só na posição escolhida; **Automático** ocupa a vaga de maior prioridade: Fritador >
  Balcão > Montagem > Troca de óleo > Moenda > Expedição > Garçom > Ajudante.
- O pasteleiro entra na posição da estação onde está: o funcionário dali cede o lugar (JA-01).
- **Tempos** (energia ≥ 40, sem traço): anotar 1,5 s; montar 0,5 s + 1,5 s por etapa; colocar 0,8 s;
  tirar no meio do ponto (nunca queima); caldo = moenda + 0,5 s; entregar e cobrar 1,5 s; troca de
  óleo 10 s; limpar mesa 3 s.
- **Energia** (desligável na nova campanha: sem cansaço, fica em 100): começa em 100 e cai 0,5/s trabalhando (+25% no verão e no calor forte). Abaixo de 40,
  tempos +25%; abaixo de 15, +60%. Automático vai descansar abaixo de 25; fixo só quando mandado
  (toque nele) ou em 0. Descansa até 80: 4/s na área de descanso, 1/s parado.

### 7.2 Escritório (RN-100 a RN-104)

- R$ 1.500 + 4 m², a partir do dia 10. Com o pasteleiro lá, a equipe fica 15% mais rápida.
- **Cargos** (3 vagas): Contador R$ 90 (relatórios, custo e margem no Preparo), Comprador R$ 80
  (compra sugerida sempre, insumos −8%), Gerente R$ 110 (equipe +10%, reivindicações −50%),
  Despachante R$ 100 (anula 1 multa do fiscal a cada 5 dias, mais ofertas de encomenda e desafio).

---

## 8. Delivery e encomendas

### 8.1 Delivery (RN-90 a RN-96)

- Área de delivery a partir do dia 5; pode ser desligada no Preparo.
- Ofertas do app a cada ~25 s (2 a 4 pastéis), visíveis por 10 s na faixa de avisos; um toque
  aceita, de qualquer lugar. Retirada 35 s depois do aceite; o motoboy espera 25 s (60% disso com
  reputação abaixo de 2) e leva até 2 comandas.
- Teto diário: 3 comandas até 3,5 estrelas, 6 a partir de 3,5, 10 a partir de 4,5 (+4 com Conta
  Parceira). Com Expedição contratada, dá para ligar o aceite automático.
- O app paga preço − 20% de taxa, com fator de qualidade e reputação (sem teto de perfil e sem xepa).
  O transporte tira 20 pontos de nota (zero com embalagem térmica).
- Comanda não pronta quando o motoboy sai: cancelada, insumos perdidos, falha de peso **3,0**. Ligar
  o delivery sem estrutura é uma armadilha de propósito.

### 8.2 Encomendas (RN-102, RN-104)

- Com escritório, o Preparo oferece 0 a 2 encomendas (0 a 3 com Despachante): receita, 10 a 40
  unidades, retirada entre 9h e 13h30, pagamento ≈ 1,3× a referência por unidade, multa de 50%.
- Os pastéis vão para a **caixa da encomenda** (botão **CAIXA** no balcão, com o pastel selecionado),
  que não usa a estufa e congela a nota por 60 s.
- O cliente chega no horário e espera 30 s; a entrega é de quem estiver no balcão ou na expedição.
  Incompleta: multa e falha de peso 3,0.

---

## 9. Promoções, tema e desafios

- **Brinde** (RN-120 a RN-122): "a cada N pastéis, 1 de graça", N de 2 a 6. Vale no balcão, na mesa e
  no app (não na encomenda). Parte dos clientes aumenta o pedido até N (40% com N ≤ 3, 20% com N de 4
  a 6). O brinde consome insumo e produção; dá +1,5 de encanto. O fechamento mostra o custo dos
  brindes em linha própria.
- **Chorinho** (RN-123): nível 0 a 3, +10% de cana por nível (+0,1 dose e +0,3 s na moenda), +0,1 de
  encanto por nível.
- **Xepa** (RN-124, RN-125): das 13h às 14h, desconto de 10% a 50% em tudo, Econômicos +30%. No
  fechamento, os recheios que iam estragar são vendidos a 30% do custo.
- **Tema** (RN-17), escolhido no Preparo a partir do dia 5 (grátis na primeira vez, R$ 500 para
  trocar): Popular (+15 pontos de Econômicos, sujeira só incomoda a partir de 75), Tradicional
  (reputação positiva +10%), Gourmet (+15 pontos de Exigentes, mesa +10%, nota mínima +10).
- **Desafios da Associação** (RN-135 a RN-137), a partir do dia 3, até 2 por dia (3 com Despachante),
  prêmio só na conclusão, sem multa se expirar:

| Desafio | Prêmio | Prazo |
|---|---|---|
| Servir 40 caldos num dia | R$ 150 | 5 dias |
| Ter 2 mesas e um garçom | R$ 200 | 6 dias |
| Nenhuma comanda cancelada por 3 dias | R$ 300 | 8 dias |
| Desperdício abaixo de 10% num dia | R$ 150 | 5 dias |
| Chegar a 4 estrelas | R$ 400 | 10 dias |
| Passar numa fiscalização | R$ 200 | 8 dias |
| Vender 30 Especiais da Casa num dia | R$ 350 | 8 dias |

---

## 10. Estações do ano e eventos

### Estações (RN-140, RN-141)

Ciclos de 5 dias, pelo contador de dias (dia repetido mantém a estação): 1–5 Verão, 6–10 Outono,
11–15 Inverno, 16–20 Primavera; o ciclo recomeça no modo livre (dia 21 = Verão).

| Estação | Caldo | Cansaço | Outros | Chuva |
|---|---|---|---|---|
| Verão | +40% | +25% | — | 25% |
| Outono / Primavera | — | — | — | 15% |
| Inverno | −40% | — | 2 pastéis +20% | 10% |

### Eventos (RN-150 a RN-152)

Podem ser desligados na nova campanha. Ligados, começam no dia 4: no máximo 1 previsto (mostrado na
previsão do Preparo) e 1 surpresa por dia.

| Previsto | Chance | Efeito |
|---|---|---|
| Chuva | pela estação | balcão −40%, app +50%, mesas com metade da procura |
| Calor forte | 20% no verão | caldo +50%, cansaço +25% |
| Subprefeitura | 8% | mesas proibidas no dia |
| Reivindicação | 30% depois de um dia em que alguém chegou a energia 0 (×2 Pavio curto, ×0,5 Gerente) | escolher no Preparo: pausa (exige área de descanso), aumento de 10% por 3 dias ou recusar (equipe −15% no dia) |

| Surpresa | Chance | Efeito |
|---|---|---|
| Fiscal da Vigilância | 12%, entre 9h e 13h | óleo ≥ 70% ou sujeira ≥ 60: multa de R$ 150 e −0,3 de reputação (aplicado antes de conferir a meta); aprovado: +2,0 de encanto |
| Queda de energia | 8%, de 20 a 40 s | moenda motorizada vira manual, estufa para de congelar, automação para |
| Fogo no tacho | 3% por pastel colocado com óleo ≥ 90%; 5% por troca feita por funcionário sem curso | tacho parado 20 s, pastéis perdidos, R$ 80 de reparo |
| Excursão | 8% | 15 clientes em 20 s |
| Funcionário queimado | 2% por pastel tirado por funcionário sem curso | sai por 30 s |

---

## 11. Campanha: metas, falência, modo livre e save

- **Perfil do pasteleiro** (RN-110, fixo na campanha): Tradicional (caixa inicial +R$ 100),
  Negociante (insumos −10%), Chapeiro (janela do ponto +1 s nas ações dele), Boa-praça (paciência
  +15%), Gestor (salários −10%).
- Caixa inicial R$ 200 (+ perfil) e reputação 3,0.
- **Meta do dia N** (RN-50): lucro líquido ≥ R$ 70 × 1,12^(N−1) **(P)** (R$ 70 no dia 1, ≈ R$ 603 no
  dia 20) e reputação ao fim do dia ≥ 2,0 (dias 1–5), 3,0 (6–12) ou 3,5 (13–20). Meta não cumprida: o
  contador não avança (o próximo dia repete a meta e a estação), mas caixa, reputação, compras e
  estoque persistem; o calendário avança (a massa envelhece).
- **Fechamento**: vendas, insumos usados, insumos dos brindes, estragados, sobras da xepa, copos e
  saquinhos, troca de óleo, taxa de espaço, salários, bônus, reparos, multa da fiscalização, multas
  de encomenda, prêmios de desafio e lucro líquido; pedidos atendidos, perdidos e errados; app e
  encomendas (entregues/canceladas); brindes dados; reputação antes → depois.
- **Falência** (RN-52): caixa negativo depois do fechamento encerra a campanha. A partir do dia 10,
  dá para passar o ponto por 25% do que foi investido.
- **Modo livre** (RN-54): cumprida a meta do dia 20, a campanha está zerada e segue sem meta.
- **Passar o ponto** (RN-57): depois de zerar, vende a barraca por caixa + 50% do investido em
  equipamentos, espaço e estruturas. A campanha nova começa com R$ 200 + 20% do valor (+R$ 100 se o
  perfil for Tradicional) e reputação 3,0.
- **Recordes** (RN-56): maior dia concluído e, depois de zerar, maior caixa do modo livre (é o que o
  card do hub mostra: "Recorde dia 7" ou "Recorde R$ 1.962,00"); maior valor de ponto.
- **Tutorial** (RN-170): no dia 1 guia o primeiro pedido; durante cada passo o relógio para, mas os
  comandos funcionam. Com equipe no dia 1 (melhorias liberadas, RN-55a) o relógio não para: as dicas
  continuam e a equipe trabalha. **Desbloqueios** (RN-171) com balão na primeira vez: Equipe (dia 2), Associação
  (3), Delivery e Tema (5), Especial da Casa (6), Escritório (10).

---

## 12. Parâmetros

Valores de `game/constants.ts` (os **(P)** foram calibrados pela simulação sem tela). Catálogos
(receitas, insumos, equipamentos, equipe, eventos, desafios, escritório) ficam em `game/data/*.ts`.
**Mudou um número? Atualize esta tabela, rode os robôs e atualize `calibracao.md`.**

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 640 × 480 | grade lógica (exceção à regra 7 do `CLAUDE.md` raiz) |
| `SCALE` (`game/hires.ts`) | 2 | canvas 1280×960, sprites em alta |
| `STEP` | 1/60 s | passo fixo; acelerar 2× = 2 passos por quadro |
| `MAX_STEPS_PER_FRAME` / `MAX_FRAME_DT` | 5 / 0,05 s | teto por quadro (sem saltos depois de aba em segundo plano) |
| `DAY_SECONDS` (P) | 240 | duração real do dia |
| `ARRIVAL_BASE_INTERVAL` (P) | 12 s | intervalo médio entre clientes no dia 1 |
| `ARRIVAL_DAILY_DECAY` (P) | 4% | o intervalo cai 4% por dia |
| `ARRIVAL_MIN_INTERVAL` (P) | 4 s | piso do intervalo |
| `PEAK_FACTOR` (P) | 1,5 | chegada ×1,5 das 10h às 12h |
| `QUEUE_MAX` | 6 | fila cheia perde cliente (falha de peso 0,5) |
| `ORDER_DRINK_CHANCE` (P) | 0,4 | chance de o pedido levar caldo |
| `ORDER_DESSERT_CHANCE` / `_LATE` (P) | 0,25 / 0,35 | doce por cliente (a partir das 11h) |
| `PATIENCE` (P) | 90 / 80 / 70 s | paciência (Econômico, Padrão, Exigente; spec: 45/40/35) |
| `QUEUE_CALM_STEP` / `QUEUE_CALM_MIN` (P) | 0,2 / 0,3 | quem está atrás na fila gasta a paciência mais devagar |
| `PROFILE_CEILING` (P) | 0,9 / 1,2 / 1,6 | teto de preço × referência |
| `PROFILE_MIN_QUALITY` (P) | 30 / 50 / 70 | nota mínima aceita |
| `QUALITY_RAW` / `QUALITY_PONTO` / `QUALITY_OVERDONE` | 40 / 80 / 55 | nota de cru, no ponto e passado |
| `DECAY_DELAY` / `DECAY_PER_SECOND` (P) | 20 s / 1 ponto/s | decaimento fora da estufa (spec: 10 s / 2) |
| `NO_BAG_PENALTY` | 10 | nota a menos sem saquinho |
| `MOVE_NEIGHBOR` / `MOVE_EXTRA_STATION` | 0,4 / 0,2 s | deslocamento do pasteleiro |
| `HOLD_MILL_MANUAL` / `MILL_MOTOR_SECONDS` | 6 / 2,5 s | tempo de um caldo |
| `HOLD_OIL_MANUAL` | 8 s | troca de óleo pelo pasteleiro |
| `HOLD_BROOM` / `BROOM_POINTS` | 4 s / 25 | vassoura |
| `HOLD_CLEAN_TABLE` | 3 s | limpar mesa |
| `BENCH_CAPACITY` / `BENCH_TRAY_MAX` (P) | 6 / 4 | montados esperando / ingredientes na bandeja |
| `OIL_DIRT_PER_PASTRY` (`_COTTON`) | 4% (3%) | sujeira do óleo por pastel; trava em 100% |
| `OIL_DIRTY_THRESHOLD` / `OIL_DIRTY_QUALITY_PENALTY` | 70% / 15 | óleo sujo |
| `OIL_CHANGE_COST` (`_COTTON`) | R$ 25 (R$ 45) | custo da troca |
| `STOCK_CAPACITY` | 120 (+80 por caixa térmica) | estoque de alimento |
| `FAIL_WEIGHT` | balcão 1; sem estoque e fila cheia 0,5; app 3; app ruim 1; encomenda 3; sujeira 0,25; pagamento 1 | pesos das falhas |
| `CHARM_GIFT` (P) / `CHARM_CHORINHO` / `CHARM_INSPECTION` | 1,5 / 0,1 / 2 | encanto (spec: brinde 0,5) |
| `REPUTATION_TARGET_RATE` | 0,75 | taxa-alvo do dia |
| `REPUTATION_RATE_GAIN_UP` / `_GAIN` (P) | 4 / 2 | ganho acima / perda abaixo da taxa-alvo |
| `REPUTATION_MAX_DAILY_CHANGE` | 1 | variação máxima por dia |
| `TABLE_CHOICE` (P) / `TABLE_PREMIUM` | 0,3 / 1,15 | chance de mesa / prêmio de mesa |
| `TABLE_PATIENCE_FACTOR` / `EAT_SECONDS` | 1,5 / 25 s | mesa |
| `PAY_QUEUE_MAX` / `PAY_PATIENCE` | 4 / 20 s | fila de pagamento |
| `DIRT_PATIENCE_LIMIT` / `DIRT_FAIL_LIMIT` | 60 / 80 | efeitos da sujeira |
| `APP_OFFER_INTERVAL` / `APP_OFFER_SECONDS` (P) | 25 / 10 s | ofertas do app |
| `APP_PICKUP_DELAY` / `APP_MOTO_WAIT` (P) | 35 / 25 s | retirada |
| `APP_FEE` / `APP_TRANSPORT_LOSS` (P) | 20% / 20 | taxa e perda no transporte |
| `APP_CAP_BASE` / `_MID` / `_HIGH` / `_PARTNER` (P) | 3 / 6 / 10 / +4 | teto diário de comandas |
| `GOAL_BASE` (P) | R$ 70 | meta do dia 1 (spec: 80) |
| `GOAL_GROWTH` (P) | 1,12 | crescimento diário da meta (spec: 1,18) |
| `BRINDE_MIN_N`–`BRINDE_MAX_N` | 2–6 | faixa do brinde |
| `CHORINHO_MAX` / `CHORINHO_DOSE` / `CHORINHO_SECONDS` | 3 / 0,1 / 0,3 s | chorinho |
| `XEPA_START_HOUR` / `XEPA_LEFTOVER_VALUE` | 13 / 30% | xepa |
| `THEME_MIN_DAY` / `THEME_CHANGE_COST` | 5 / R$ 500 | tema |

---

## 13. Arquitetura

Detalhes e diagramas C4/sequência (PlantUML) em [`plan.md`](../../../docs/specs/pastel-de-feira/plan.md).
Mapa dos arquivos no [`CLAUDE.md`](./CLAUDE.md) do jogo.

```
Campaign ──toDayConfig──▶ DaySim(config, semente) ──passo 1/60 s──▶ DayResult ──closeDay──▶ Campaign
   ▲  Preparo (React DOM)      ▲ Command (toque/teclado)                 Fechamento (React DOM)
   └──────── save.ts (localStorage) ◀──────────────────────────────────────────┘
```

| Camada | Pasta | Regra |
|---|---|---|
| Simulação do dia | `game/sim/` | TypeScript puro, determinístico (passo fixo + `Rng` semeado). Entrada só por `Command` |
| Campanha | `game/campaign/` | Imutável e serializável. Ações devolvem `{ ok, campaign }` ou `{ ok: false, motivo }` |
| Catálogos | `game/data/` | Receitas, insumos, equipamentos, equipe, eventos, desafios, escritório |
| Apresentação | `game/render/`, `game/input.ts`, `game/ui.ts` | Lê o estado da simulação; só o `UiState` é dela |
| Telas | `Game.tsx`, `components/` | Máquina de telas; Preparo e menus em React DOM |
| Sem tela | `sim/` | Cenários, replay, jogador automático, robôs (fora do bundle) |
| Testes E2E | `e2e/pastel-de-feira/` (raiz do repo) | Playwright; gancho `game/e2eHook.ts` |

**Mesma `config` + mesma semente + mesmos comandos por passo = mesmo `DayResult`.** É isso que permite
os cenários, o replay, os robôs e a reprodução de um dia jogado no navegador.

Chaves do `localStorage`: `pastel-de-feira:campanha` (save versionado), `:recorde`, `:recorde-caixa`,
`:recorde-ponto`, `:som`, `:musica`, `:visto` (balões já mostrados). Tudo em `try/catch`.

### 13.1 Visual e arte

Barraca aconchegante em pixel art 16 bits: paleta quente, contorno marrom-escuro (`#2e1c12`), molduras de
madeira com fundo de pergaminho. A fila fica na calçada de mosaico paulistano e cada estação é um objeto
(balcão de madeira, bancada de inox, fogão com tacho, moenda verde). Só o visual: nenhuma regra, zona de
toque ou fluxo de tela depende da arte (sem os PNGs, o jogo cai em retângulos de cor).

Todos os sprites saem de `tools/pixelart/pastel_de_feira.py` (1×; o jogo aplica Scale2x). Os cachorros
vêm da biblioteca compartilhada (`caes_pe`). Referência visual: `docs/specs/pastel-de-feira/arte-nova/`.

| Sprites (`assets/…`) | O que representam |
|---|---|
| `cenario/fundo` | toldo, bandeirinhas, calçada de mosaico (fila) e assoalho da barraca, inteiro em 640×480 |
| `moveis/{balcao,bancada,fogao,estufa,escrivaninha,banco}_{esq,meio,dir}` | móveis fixos das zonas, em 3 partes (o meio repete) |
| `equip/tacho_*`, `equip/tacho_sujo_*`, `equip/cesto_{grade,alca}` | panela do tacho (limpa ou com óleo sujo) e cestos |
| `equip/moenda_{manual,motor,auto}`, `caixa_termica`, `mesa`, `maquininha` | equipamentos comprados |
| `equip/caixa_encomenda{,_pronta}`, `equip/sacola_app{,_motoboy}` | encomendas e comandas do app |
| `decor/*` | enfeites: rolo, potes, sacos de farinha, caixotes de cana e limão, garrafa de café, migalhas, assento |
| `itens/pastel_{salgado,doce,especial}_{cru,ponto,passado,queimado}`, `copo`, `moeda` | pastéis por estado, caldo e moedas |
| `itens/ing_<insumo>` | um ícone por insumo (bancada, painel e Preparo) |
| `icones/sabor_<receita ou caldo>`, `ui/selo_versao` | selo do sabor (um por receita base e caldo) e o pontinho da versão |
| `icones/ctrl_*` | ícones dos controles do painel |
| `icones/{fiscal,energia,excursao,fogo,queimado,chuva,calor}`, `icones/perfil_*` | eventos e perfis de cliente |
| `ui/moldura`, `ui/aba`, `ui/slot_{normal,selecionado,desligado}`, `ui/balao*` | molduras 9-slice do painel, das telas e do balão de pedido |
| `ui/faixa_{alerta,evento,oferta}`, `ui/placa_*`, `ui/placa_xepa` | faixa de avisos, placas com o nome das zonas e da xepa |
| `ui/hud_*` | ícones do HUD (DOM): estação do dia, caixa, fila, reputação, som, música, 2×, pausa |
| `capa.png` | card do hub |

---

## 14. Como contribuir

### 14.1 Antes de mexer

1. Leia o [`CLAUDE.md` da raiz](../../../CLAUDE.md) (CSS escopado, assets na pasta do jogo, manifest
   leve, StrictMode, `dt` do quadro) e o [`CLAUDE.md` do jogo](./CLAUDE.md) (resolução 640×480,
   arquitetura, armadilhas).
2. Localize a regra na [spec](../../../docs/specs/pastel-de-feira/spec.md) pelo número (`RN-xx`, `JA-xx`) e
   o cenário correspondente em `sim/scenarios/`.
3. Mudança de regra ou de comportamento visível: atualize primeiro a spec (e o `plan.md`, se mudar a
   arquitetura). O fluxo do repositório é SDD: `spec.md` (o quê) → `plan.md` (como) → `tasks.md`
   (backlog).

### 14.2 Regras do código

- `game/sim/` e `game/campaign/` não importam React, DOM, canvas nem `localStorage`; nunca usam
  `Math.random` nem `Date` (só o `Rng` semeado). Aparência e som ficam fora da simulação.
- O jogador só altera o mundo por `Command`. Todo comando de gesto leva `g` (id do gesto): o mesmo id
  vale uma vez (toque duplo).
- Ações do Preparo são funções puras `(campaign, …) → ActionResult`; a tela nunca muda a campanha
  direto. A UI e os robôs usam a mesma lista de ofertas (`campaign/shop.ts`).
- Números de equilíbrio em `game/constants.ts`, citando a RN; catálogos em `game/data/`.
- Mudou o formato do save? Aumente `CURRENT_VERSION` em `campaign/save.ts` e escreva a migração.
- Rótulos de botão de insumo e de pastel saem de `ingredientLabel` e `itemLabel` (únicos, até 8
  letras). Nome novo que colida? Acrescente o rótulo curto no catálogo.
- CSS só com seletores `.pastel-de-feira …`; texto da interface em pt-BR, curto.
- Sprites: edite os geradores (`tools/pixelart/pastel_de_feira.py`, `tools/pixelart/biblioteca/caes_pe.py`),
  nunca o PNG à mão.
- Mudou um valor **(P)**? Rode os robôs (`--bots all --seeds 50`), confira os critérios e atualize
  `calibracao.md` e a [tabela de parâmetros](#12-parâmetros).

### 14.3 Fluxo de entrega

1. Branch a partir da `main` (trunk-based, versões pelo release-please).
2. Commits em Conventional Commits, descrição em pt-BR no imperativo (`fix(pastel-de-feira): …`,
   `test(e2e): …`), um assunto por commit.
3. Rode a [checagem completa](#15-testes) antes de abrir a PR.
4. PR para a `main` explicando o porquê e o que mudou (RN afetadas).

### 14.4 Checklist antes da PR

- [ ] `npm run typecheck`, `npm run typecheck:e2e` e `npm run build` sem erros.
- [ ] Cenários sem tela: `--scenario all` passa (e há cenário novo para regra nova ou bug corrigido).
- [ ] `npm run test:e2e` passa.
- [ ] Mudou progressão, economia ou metas? `npm run test:e2e:campanha` passa.
- [ ] Mudou valor (P)? Robôs rodados e `calibracao.md` atualizado.
- [ ] README (este manual) e `CLAUDE.md` do jogo atualizados se regra, parâmetro ou controle mudou.
- [ ] Testado no navegador em desktop e a ≈ 390 px; a barra "← Sampa Challenges" volta ao hub.

---

## 15. Testes

São três camadas, do mais rápido ao mais completo.

### 15.1 Simulação sem tela (regras)

Cenários por grupo de RN em `sim/scenarios/` (um arquivo por grupo, registrado em
`sim/scenarios/index.ts`), rodados em node com o mesmo código do jogo:

```bash
npx esbuild src/games/pastel-de-feira/sim/run.ts --bundle --platform=node --format=esm --outfile=/tmp/pf-sim.mjs
node /tmp/pf-sim.mjs --scenario all            # todos os grupos
node /tmp/pf-sim.mjs --list                    # grupos disponíveis
node /tmp/pf-sim.mjs --scenario fechamento     # um grupo
node /tmp/pf-sim.mjs --replay <arquivo.json>   # reexecuta um dia gravado e compara o hash
node /tmp/pf-sim.mjs --bots all --seeds 50     # robôs de calibração (solo, armadilha, brinde-max, equilibrado)
```

Saída 0 = tudo passou; 1 = algum cenário falhou; 2 = grupo inexistente. Para escrever um cenário,
use os utilitários de `sim/harness.ts` (`makeSim`, `advance`, `runDay`, `check`, `checkEq`,
`checkNear`) e o `devConfig()` de `sim/testConfig.ts`.

### 15.2 Ponta a ponta no navegador (Playwright)

Na raiz do repositório (`e2e/`, guia completo em [`e2e/README.md`](../../../e2e/README.md)):

```bash
npx playwright install chromium     # uma vez
npm run test:e2e                    # suíte rápida: desktop + 390 px (~3 min)
npm run test:e2e -- pastel-de-feira/fritura    # um arquivo
npm run test:e2e -- -g "RN-41"                 # pelo nome
npm run test:e2e:campanha           # campanha inteira pela tela (~10 min)
npm run test:e2e:tudo               # as duas
npx playwright show-report playwright-report   # relatório com traces das falhas
```

- Os testes jogam pela tela: cliques reais no canvas e nas abas. O `requestAnimationFrame` é
  controlado pelo teste (1 quadro = 1 passo de 1/60 s), então os tempos não dependem da máquina.
- O gancho `window.__pf` (`game/e2eHook.ts`) expõe o estado do dia só para leitura e só existe
  quando a página de teste define `window.__PF_E2E__`.
- A **campanha completa** joga do dia 1 ao 20, dois dias de modo livre e o passar o ponto: o Preparo
  pelas abas (`support/strategy.ts`) e o dia por um piloto que transforma as decisões do jogador
  automático em toques. A cada dia, o fechamento exibido e o save são comparados com o `closeDay`.
- No macOS, rode a campanha com `caffeinate -dimsu npm run test:e2e:campanha` (com a máquina
  ociosa o Chrome é suspenso). `PF_PILOT_DEBUG=1` mostra o ritmo dos gestos.
- Cada dia da campanha grava `dia-cal<N>.json` (campanha inicial, comandos e `DayResult`) em
  `test-results/e2e-campanha/`; os comandos reproduzem o dia sem tela.

### 15.3 Manual

`npm run dev` e abra `#/jogos/pastel-de-feira`, em desktop e a ≈ 390 px.

---

## 16. Depuração

- `localStorage['pastel-de-feira:forcar'] = 'fiscal' | 'energia' | 'excursao' | 'fogo' | 'queimado'`
  força o evento surpresa do dia (liga os eventos para esse dia).
- Apague `pastel-de-feira:visto` para rever os balões de novidade.
- Save inválido ou de versão desconhecida é descartado com o aviso "Progresso salvo inválido — nova
  campanha".
- Para investigar um dia: grave com `DaySim.startLog()` e `recordReplay` (`sim/replay.ts`) e rode
  `--replay`; o hash tem que sair igual em duas execuções.
