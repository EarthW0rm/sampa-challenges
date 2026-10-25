# Especificação Funcional: Pastel de Feira

> Fase 1 do SDD — O Que e Porque. Status: **rascunho para aprovação (revisão 4)**.
> Valores numéricos marcados com **(P)** estão aprovados como base e serão **calibrados por
> simulação sem tela** na implementação, até os critérios de sucesso da seção 5 passarem. Depois
> ficam concentrados num único ponto de equilíbrio do jogo.

## 1. Visão Geral e Objetivo

- **O Problema:** o hub Sampa Challenges não tem nenhum jogo de gestão. Todos os jogos atuais são
  de reflexo ou estratégia de turno curto. Falta um jogo de sessão longa, com progressão entre dias,
  que use o tema de São Paulo (feira livre, pastel e caldo de cana) e converse com o universo já
  existente (motoboys do app Cachorro Loko).
- **A Solução (O Que):** jogo de gestão e tempo real com o tema de barraca de pastel de feira. O
  jogador começa sozinho, fazendo todas as funções da barraca. Com o lucro de cada dia compra
  insumos, receitas, equipamentos, espaço e contrata e treina funcionários. A cada dia ele precisa
  bater uma meta de lucro e de reputação, enfrentando estações do ano e eventos da cidade.
  Conforme cresce, o pasteleiro deixa de operar e passa a administrar (escritório e cargos de gestão).
- **O Valor (Porque):** o jogo gira em torno de **gargalos**. O fluxo de valor vai do pedido anotado
  à entrega cobrada. A reputação muda o quanto o cliente aceita pagar, então o jogador é incentivado a
  vender **com qualidade** e não só volume. Abrir o delivery antes de ter estrutura é uma armadilha
  de progressão que testa planejamento. A compra de espaço obriga a escolher entre produção (tachos),
  conforto (mesas) e suporte (estoque, descanso, escritório).

## 2. Jornadas do Usuário

### Atores

| Ator | Papel |
|---|---|
| **Jogador** | Controla o **pasteleiro** (dono) e toma todas as decisões de gestão |
| **Pasteleiro** | Personagem do jogador na barraca. Ocupa **uma posição por vez** e não cansa. Tem um **perfil** fixo por campanha |
| **Funcionário** | Contratado entre candidatos, com **traços**. Executa sozinho a função da posição que ocupa, cansa e pode ser treinado |
| **Cargo de gestão** | Contador, Comprador, Gerente ou Despachante. Trabalha no escritório e nunca opera estações |
| **Cliente de balcão** | Chega, entra na fila, faz o pedido, espera, paga e vai embora |
| **Cliente de mesa** | Escolhe comer no local quando há lugar limpo e livre. Espera mais, paga mais, ocupa o lugar até terminar, paga no balcão ao sair e deixa sujeira |
| **Motoboy do app** | Retira pedidos de delivery (um ou mais) num horário. Cancela se atrasar |
| **Encomenda** | Pedido grande com prazo e multa, aceito no escritório |
| **Associação da Feira** | Vende espaço, cobra a taxa diária e propõe **desafios** com prêmio |
| **Cidade** | Fonte de **estações** e **eventos** (clima, fiscalização, energia, subprefeitura) |

### Jornada Principal — um dia de campanha

0. **Nova campanha** (uma vez): o jogador escolhe o **perfil do pasteleiro** (RN-110), se os
   **eventos** ficam ligados (RN-150) e se faz o **tutorial** (RN-170).
1. **Preparo** (fora do relógio): o jogador vê caixa, reputação, dia, estação, previsão do dia
   (eventos previstos) e a **meta do dia**.
   - Compra **insumos** e **consumíveis** dentro da capacidade de estoque. Nos dias 1 a 3 (ou
     sempre, com Comprador) o jogo mostra a **compra sugerida**.
   - Define o **preço de venda** de cada item, a **promoção do brinde**, o **chorinho** do caldo e
     se a **xepa** abre às 13h.
   - Compra melhorias (receitas, bebidas, equipamentos, espaço, mesas, delivery, escritório, estoque,
     descanso).
   - Escolhe candidatos, contrata ou dispensa funcionários, define posição fixa ou modo automático e
     paga **treinamentos**.
   - Com escritório: contrata cargos, aceita **encomendas** e consulta **relatórios** (com Contador).
   - Aceita ou recusa **desafios da Associação**.
2. **Dia de Feira** (07h às 14h no relógio do jogo, ≈ 4 min reais **(P)**):
   1. Clientes chegam e entram na fila do balcão. O balão de cada um mostra o pedido e a paciência.
   2. O jogador clica numa estação. O pasteleiro **se desloca** até ela e passa a agir ali. Uma estação sem
      ninguém fica parada.
   3. Fluxo de um pedido de balcão:
      **anotar** (balcão) → **montar** (massa + recheio; 1 etapa por ingrediente; o Especial da Casa tem 4) →
      **colocar no óleo** (tacho) → **tirar no ponto** (tacho) → [**estufa**, opcional] →
      **caldo** (moenda, se pedido) → **entregar** (com o brinde, se houver) → **cobrar** (balcão).
   4. O óleo **suja** a cada pastel frito e precisa ser **trocado**. Durante a troca o tacho fica parado.
   5. A barraca e as mesas **sujam** e alguém precisa limpar.
   6. Os funcionários **cansam**, perdem rendimento e precisam descansar.
   7. Pode ocorrer um **evento** (clima, fiscal, queda de energia, fogo no tacho, excursão, acidente).
   8. A qualidade do pastel (nota 0–100) nasce na fritura e cai enquanto ele espera pronto.
   9. Das 13h às 14h, com xepa ligada, vale o preço de xepa.
3. **Fechamento** (14h, corte seco, RN-07): o jogo mostra
   - receita, custo de insumos e consumíveis, salários, taxa de espaço, bônus de aproveitamento,
     multas, prêmios de desafio, venda de sobras na xepa e lucro líquido;
   - pedidos atendidos, perdidos, errados e atrasados (balcão, mesa e app separados), brindes dados;
   - variação da reputação;
   - insumos descartados (estragados, vencidos, queimados) e estoque que passa para o dia seguinte;
   - resultado da meta: **cumprida** (avança o dia) ou **não cumprida** (repete o mesmo dia, ver RN-50).
4. O progresso é salvo e o jogo volta ao Preparo.

### Jornadas Alternativas

- **JA-01 Pasteleiro assume uma função:** a qualquer momento o jogador clica numa estação ocupada
  (ex.: troca de óleo de um tacho). O pasteleiro entra na posição e o funcionário dali sai e vai para
  outra posição vaga (se estiver em automático) ou fica parado ao lado (se estiver fixo) até a
  posição liberar.
- **JA-02 Cliente de mesa:** havendo lugar limpo e livre, parte dos clientes escolhe a mesa. Com
  garçom, o pedido é anotado e entregue na mesa. Sem garçom, o cliente da mesa entra na fila do
  balcão para pedir e retirar e depois volta à mesa. Ao terminar, o grupo vai para a fila de
  pagamento do balcão (RN-87). Quando ele sai da mesa, o lugar fica sujo.
- **JA-03 Delivery:** com a área de delivery, comandas do app aparecem com horário de retirada. O
  motoboy chega, espera e leva uma ou mais comandas. Uma comanda atrasada é cancelada.
- **JA-04 Encomenda:** no Preparo (com escritório) o jogador aceita uma encomenda com quantidade,
  receita, horário de entrega, pagamento e multa. Durante o dia ela é produzida junto com os
  pedidos normais.
- **JA-05 Gestão pelo escritório:** o pasteleiro vai para o escritório e deixa de operar estações. Enquanto
  ele estiver lá os funcionários ganham bônus de velocidade.
- **JA-06 Pausa e saída:** o jogador pausa (botão, tecla ou perda de foco da aba). O menu de pausa
  tem Continuar, Som/Música e Sair. Se sair no meio do dia, ao voltar ele recomeça esse Dia de Feira
  do início, com as compras do Preparo já feitas e um **novo sorteio** de clientes, ofertas e eventos
  surpresa.
- **JA-07 Fim de campanha:** cumprida a meta do dia 20 a campanha está **zerada** e o jogo segue em
  **modo livre** (sem meta, recorde de caixa). Falência encerra a campanha (RN-52).
- **JA-08 Passar o ponto:** depois de zerar, o jogador pode vender a barraca e começar uma
  campanha nova com parte do valor (RN-57).
- **JA-09 Evento durante o dia:** um aviso aparece na tela e o jogador reage (ex.: tirar o
  funcionário queimado do tacho, limpar antes do fiscal, cobrir o tacho em chamas).
- **JA-10 Descanso:** um funcionário cansado em modo automático vai para a área de descanso,
  deixando a posição vaga até voltar.
- **JA-11 Tutorial:** no dia 1 de uma campanha com tutorial, o jogo conduz o primeiro pedido passo
  a passo. Nos dias seguintes, cada sistema é apresentado quando é desbloqueado (RN-170, RN-171).

## 3. Regras de Negócio e Restrições

### 3.1 Relógio e chegada de clientes

| # | Regra | Tipo |
|---|---|---|
| RN-01 | O dia dura de 07h a 14h no relógio do jogo, ≈ 240 s reais **(P)** | Obrigatória |
| RN-02 | Intervalo médio entre clientes: 12 s no dia 1, caindo 4% ao dia, mínimo 4 s **(P)**. Pico das 10h às 12h com ×1,5 de chegada **(P)**. Estação e eventos modificam a chegada (RN-140, RN-151) | Obrigatória |
| RN-03 | Reputação abaixo de 2 estrelas reduz a chegada de clientes em 30% **(P)** | Condicional |
| RN-04 | A fila do balcão tem no máximo 6 clientes **(P)**. Cliente que chega com a fila cheia vai embora (pedido perdido, peso 0,5 na reputação) | Restritiva |
| RN-05 | Cada cliente pede de 1 a 2 pastéis e de 0 a 1 caldo **(P)**, só entre os itens ativos do cardápio com insumo disponível. Estação (RN-140) e promoção do brinde (RN-121) modificam essas quantidades | Obrigatória |
| RN-06 | Paciência base (do fim da fila ao recebimento do pedido completo): Econômico 45 s, Padrão 40 s, Exigente 35 s **(P)**. Esgotada a paciência, o cliente vai embora sem pagar (falha) | Obrigatória |
| RN-07 | **Corte seco às 14h:** nenhum cliente novo chega. Quem está na fila, nas mesas ou na fila de pagamento vai embora sem pagar e **sem falha**. Pedidos em produção, pastéis prontos não entregues e comandas não retiradas são perdidos **sem falha**. Os pastéis prontos e montados contam como desperdício | Obrigatória |

### 3.2 Perfis de cliente e preço

| # | Regra | Tipo |
|---|---|---|
| RN-10 | Cada item tem um **preço de referência** e um **preço de venda** definido pelo jogador no Preparo (de 50% a 250% da referência, passo de R$ 0,50 **(P)**) | Obrigatória |
| RN-11 | Perfis: **Econômico** (aceita até 0,9× a referência, exige qualidade ≥ 30), **Padrão** (até 1,2×, ≥ 50), **Exigente** (até 1,6×, ≥ 70) **(P)** | Obrigatória |
| RN-12 | Mistura base de perfis: 50% Econômico, 40% Padrão, 10% Exigente **(P)**. Quanto maior o índice médio de preço do cardápio, menos Econômicos e mais Exigentes. A preço médio ≥ 1,3× chega a 20/50/30 **(P)** | Obrigatória |
| RN-13 | Cliente cujo item desejado custa acima do teto do seu perfil vai embora sem pedir. Não afeta a reputação e conta como "cliente perdido por preço" no fechamento | Condicional |
| RN-14 | A reputação sobe o teto de preço de todos os perfis: +10% com 4 estrelas e +20% com 5 **(P)** | Condicional |
| RN-15 | Pedido entregue com qualidade abaixo da exigência do perfil é pago, mas conta como falha na reputação | Condicional |
| RN-16 | Exigentes não entram na fila se a sujeira da barraca for ≥ 60 (RN-133) | Condicional |
| RN-17 | **Tema da barraca:** escolhido uma vez no Preparo do dia 5 **(P)**. Trocar depois custa R$ 500 (reforma) **(P)**. Efeitos **(P)**: **Popular** (+15 pontos percentuais de Econômicos na mistura, limiar de sujeira de RN-133 sobe de 60 para 75); **Tradicional** (mistura base, variação positiva de reputação +10%); **Gourmet** (+15 pontos percentuais de Exigentes, prêmio de mesa +10%, exigência de qualidade de todos os perfis +10). O deslocamento do tema é somado ao da RN-12 | Obrigatória |
| RN-18 | **Sabor pedido e troca por perfil.** Todo cliente pede um **sabor específico** (e o Exigente, também a versão). Se o sabor está disponível, só ele é correto: entregar outro é item errado (RN-63). O jogador **nunca oferece troca**. A troca só acontece automaticamente, quando o sabor pedido esgota (RN-35), e segue o perfil: **Econômico** leva o sabor da mesma categoria com **mais unidades disponíveis no estoque**, dentro do teto dele; **Padrão** leva outro da mesma categoria de **preço igual ou menor**; **Exigente** não aceita troca. A troca é paga normalmente e não gera encanto nem falha | Obrigatória |
| RN-19 | **Exigentes no fim do dia:** a partir do dia 6, a fatia de Exigentes da mistura (RN-12, RN-17) sobe ao longo do dia. Ela fica na base até 10h e cresce até um acréscimo máximo das 12h às 14h, tirando a diferença dos Econômicos. O acréscimo máximo cresce de forma linear de 0% no dia 6 até +100% no dia 20, e fica em +100% no modo livre **(P)** | Obrigatória |

### 3.3 Valor pago e qualidade

| # | Regra | Tipo |
|---|---|---|
| RN-20 | Valor pago por pastel = preço de venda × fator de qualidade × prêmio de reputação × prêmio de mesa | Obrigatória |
| RN-21 | Fator de qualidade = 0,8 + 0,4 × (nota/100), ou seja de 0,8× a 1,2× **(P)** | Obrigatória |
| RN-22 | Prêmio de reputação: 1,0 abaixo de 4 estrelas, 1,10 com 4 e 1,20 com 5 **(P)** | Condicional |
| RN-23 | Nota na saída do óleo: **cru** (antes da janela) 40; **no ponto** 80; **passado** (depois da janela, antes de queimar) 55; **queimado** não pode ser vendido e os insumos são perdidos **(P)** | Obrigatória |
| RN-24 | Modificadores na fritura: Óleo de Algodão +10, Escorredor Profissional +10, óleo sujo (≥ 70% de sujeira) −15, traço Caprichoso +5, curso de Fritura +5. Nota limitada a 0–100 **(P)** | Obrigatória |
| RN-25 | Decaimento: um pastel pronto fora da estufa perde 2 pontos/s depois de 10 s de espera **(P)**. Pedido de app perde 20 pontos no transporte, perda anulada pela Embalagem Térmica **(P)** | Obrigatória |
| RN-26 | Caldo de cana não tem nota de qualidade. É pago pelo preço de venda × prêmio de reputação | Obrigatória |
| RN-27 | **Estufa de vidro:** guarda até 6 pastéis prontos **(P)**, ou 12 com a Estufa grande. Lá dentro a nota fica congelada por 60 s e depois cai 1 ponto/s **(P)**. Sem energia (evento) vale o decaimento normal. A estufa é **compartilhada** entre balcão, mesa e app (RN-96) | Condicional |
| RN-28 | Pastel entregue sem saquinho de papel (consumível esgotado) perde 10 pontos de nota na entrega **(P)** | Condicional |

### 3.4 Receitas, bebidas, insumos e estoque

| # | Regra | Tipo |
|---|---|---|
| RN-30 | **Catálogo de receitas (P).** Montagem = 1 etapa por ingrediente de recheio. Temperos (orégano, açúcar e canela) não contam como etapa. Pastéis salgados e doces ocupam vagas separadas no cardápio (RN-30b) | Obrigatória |

| Categoria | Receita | Insumos (1 unidade cada) | Etapas | Fritura no ponto | Queima após | Ref. | Desbloqueio |
|---|---|---|---|---|---|---|---|
| Tradicional | Carne | massa + carne | 1 | 5–8 s | 10 s | R$ 8,00 | inicial |
| Tradicional | Queijo | massa + muçarela + orégano | 1 | 5–8 s | 10 s | R$ 8,00 | inicial |
| Tradicional | Frango | massa + frango | 1 | 5–8 s | 10 s | R$ 8,00 | R$ 80 |
| Tradicional | Calabresa | massa + calabresa + cebola | 2 | 5–8 s | 10 s | R$ 8,50 | R$ 80 |
| Tradicional | Bauru | massa + presunto + muçarela | 2 | 6–9 s | 11 s | R$ 11,00 | R$ 150 |
| Tradicional | Frango com Catupiry | massa + frango + catupiry | 2 | 6–9 s | 11 s | R$ 11,00 | R$ 150 |
| Tradicional | Pizza | massa + muçarela + presunto + tomate + orégano | 3 | 6–9 s | 11 s | R$ 12,00 | R$ 150 |
| Nobre | Palmito | massa + palmito + catupiry | 2 | 9–10,5 s | 11,5 s | R$ 16,00 | R$ 400, dia 6 |
| Nobre | Carne Seca | massa + carne seca + queijo coalho | 2 | 9–10,5 s | 11,5 s | R$ 17,00 | R$ 450, dia 8 |
| Nobre | Camarão | massa + camarão + catupiry | 2 | 9–10,5 s | 11,5 s | R$ 20,00 | R$ 600, dia 11 |
| Nobre | Bacalhau | massa + bacalhau + azeitona | 2 | 9–10,5 s | 11,5 s | R$ 22,00 | R$ 700, dia 14 |
| Especial | **Especial da Casa** (pastel grande) | 2 massas + carne + ovo + muçarela + azeitona | 4 | 10–12 s | 13 s | R$ 24,00 | R$ 500, dia 6 |
| Doce | Banana com Canela | massa + banana + açúcar e canela | 1 | 4–6 s | 7 s | R$ 9,00 | R$ 100 |
| Doce | Doce de Leite | massa + doce de leite | 1 | 4–6 s | 7 s | R$ 9,00 | R$ 100 |
| Doce | Romeu e Julieta | massa + muçarela + goiabada | 2 | 4–6 s | 7 s | R$ 10,00 | R$ 150 |
| Doce | Banana com Queijo | massa + banana + muçarela + açúcar e canela | 2 | 4–6 s | 7 s | R$ 10,00 | R$ 150 |
| Doce | Chocolate | massa + chocolate ao leite | 1 | 4–6 s | 7 s | R$ 11,00 | R$ 200 |

| # | Regra | Tipo |
|---|---|---|
| RN-30d | **Especial da Casa:** pastel grande que usa 2 massas e ocupa **2 cestos** do mesmo tacho durante a fritura (num tacho pequeno, o tacho inteiro) **(P)** | Obrigatória |
| RN-30e | **Doces como sobremesa:** cada cliente de balcão ou mesa pede 0 ou 1 doce **além** dos salgados. A chance é de 25%, ou 35% das 11h às 14h **(P)**. O doce não substitui o salgado e não vale para o brinde (RN-120). Comandas do app e encomendas não têm doce **(P)** | Obrigatória |
| RN-30a | **Melhorias de receita:** só as receitas abaixo têm melhorias, compradas em sequência. Cada melhoria cria uma **nova versão** que convive com as anteriores (cada uma ocupa uma vaga). Melhoria que **acrescenta** ingrediente soma 1 etapa. Melhoria que **troca** ingrediente mantém as etapas. Melhoria 1: R$ 120, referência +20%. Melhoria 2: R$ 250, referência +40% sobre a base **(P)** | Obrigatória |

| Receita | Melhoria 1 | Melhoria 2 |
|---|---|---|
| Carne | + azeitona | + ovo |
| Queijo | troca muçarela por queijo minas | — |
| Palmito | + muçarela | — |
| Camarão | troca catupiry por cream cheese | — |
| Carne Seca | troca queijo coalho por catupiry | — |
| Doce de Leite | + paçoca | — |
| Chocolate | troca por chocolate branco | troca por creme de avelã |

| # | Regra | Tipo |
|---|---|---|
| RN-30b | **Vagas de cardápio:** salgados começam com 3 vagas **(P)**, com placas maiores para 4, 5, 6 e 7 vagas (R$ 150, R$ 300, R$ 450 e R$ 600) **(P)**. Doces têm vagas próprias: 2, com placa de 3 vagas por R$ 150 **(P)**. Bebidas não ocupam vaga. O cardápio do dia é montado no Preparo | Restritiva |
| RN-30c | **Fadiga de cardápio:** só vale quando o jogador tem **4 ou mais receitas** compradas, salgadas e doces somadas (as versões não contam como receitas novas). Com isso, a receita que fica no cardápio mais de 3 dias seguidos perde 10% de procura por dia a mais, até −40% **(P)**. A fadiga é contada pela receita base, somando todas as versões dela **(P)**. Um dia sem nenhuma versão da receita no cardápio zera a fadiga. Procura = peso de escolha do item pelos clientes | Obrigatória |
| RN-31 | Bebidas **(P)**: Caldo puro (1 dose de cana; R$ 7,00; inicial), Caldo com Limão (cana + limão; R$ 8,00; R$ 100), Caldo com Abacaxi (cana + abacaxi; R$ 9,00; R$ 180) | Obrigatória |
| RN-32 | Custo unitário dos insumos **(P)**: massa R$ 0,80; carne R$ 1,50; muçarela R$ 1,40; queijo minas R$ 1,60; queijo coalho R$ 1,80; frango R$ 1,30; calabresa R$ 1,40; cebola R$ 0,20; presunto R$ 1,60; tomate R$ 0,60; orégano R$ 0,10; ovo R$ 0,50; azeitona R$ 0,40; catupiry R$ 2,80; cream cheese R$ 2,20; palmito R$ 3,50; carne seca R$ 3,80; camarão R$ 4,50; bacalhau R$ 5,50; banana R$ 0,40; açúcar e canela R$ 0,10; doce de leite R$ 1,00; paçoca R$ 0,50; goiabada R$ 0,70; chocolate ao leite R$ 1,20; chocolate branco R$ 1,30; creme de avelã R$ 1,60; cana (1 dose) R$ 0,70; limão R$ 0,30; abacaxi R$ 0,60 | Obrigatória |
| RN-33 | Insumos e consumíveis só podem ser comprados no Preparo. Durante o dia não há reposição | Restritiva |
| RN-34 | **1 massa = 1 pastel.** A massa vale 3 dias **(P)** e é consumida da mais antiga para a mais nova. Recheios, cana e complementos que sobram **estragam no fechamento**, exceto o que estiver na caixa térmica (RN-39) | Obrigatória |
| RN-35 | Item cujo insumo acabou sai do cardápio do dia na hora. Quem já tinha pedido esse item reage pelo perfil (RN-18): o **Econômico** passa para o item da mesma categoria com mais unidades disponíveis no estoque, dentro do teto (empate: o de menor preço **(P)**); o **Padrão** passa para outro da mesma categoria de preço igual ou menor (empate: o de maior estoque **(P)**); o **Exigente** vai embora (falha, peso 0,5). Sem item possível, Econômico e Padrão também vão embora (falha, peso 0,5) | Condicional |
| RN-36 | Dias 1 a 3 (ou qualquer dia, com Comprador contratado): o Preparo mostra a compra sugerida de cada insumo e consumível para a demanda esperada do dia | Condicional |
| RN-37 | **Bônus de aproveitamento:** se nenhum cliente foi embora por falta de insumo durante o dia (RN-35), bônus = receita × max(0; 15% − % de desperdício) **(P)**. % de desperdício = unidades descartadas (estragadas, vencidas e queimadas) ÷ unidades compradas no dia. Brindes não contam como desperdício. O bônus nunca é negativo | Condicional |
| RN-38 | **Capacidade de estoque:** a barraca guarda até 120 unidades de alimento (massa + recheios + cana + complementos) **(P)**. A compra do Preparo não pode passar a capacidade livre. Consumíveis não ocupam capacidade | Restritiva |
| RN-39 | **Caixa térmica** (R$ 200, 1 m², máximo 2 **(P)**): +80 unidades de capacidade cada. Recheios, cana e complementos guardados nela duram **+1 dia** e estragam no fechamento do dia seguinte. Ao fechar, o jogo põe primeiro na caixa os itens mais caros | Condicional |
| RN-39a | **Consumíveis (P):** copo R$ 0,15 (1 por caldo; sem copo o caldo sai do cardápio), saquinho de papel R$ 0,05 (1 por pastel; sem saquinho vale RN-28), embalagem do app R$ 0,40 (1 por comanda; sem embalagem nenhuma comanda nova é aceita). Não estragam | Obrigatória |

### 3.5 Estações, posições e funções

| # | Regra | Tipo |
|---|---|---|
| RN-40 | Posições da barraca (cada uma comporta **uma** pessoa): **Balcão** (anotar, entregar, cobrar), **Colocador** do tacho N (montar + colocar no óleo), **Fritador** do tacho N (tirar no ponto e pôr na estufa), **Trocador de óleo** (volante, atende todos os tachos), **Moenda** (caldo), **Garçom** (só com mesas), **Ajudante** (limpa mesas e barraca), **Expedição** (só com delivery: embalar e entregar ao motoboy), **Escritório** (só o pasteleiro e os cargos de gestão) | Obrigatória |
| RN-41 | O pasteleiro ocupa uma posição por vez. Clicar numa estação o desloca até ela: 0,4 s entre estações vizinhas e 0,2 s por estação a mais no caminho **(P)**. Ele só age onde está | Obrigatória |
| RN-42 | Ações manuais do pasteleiro: anotar = clicar no cliente da frente; montar = clicar em cada ingrediente e depois em "fechar"; colocar = clicar num cesto livre; tirar = clicar no cesto; estufa = arrastar ou clicar o pastel pronto até a estufa; caldo = segurar a moenda (6 s manual, 2,5 s motorizada **(P)**); entregar = clicar no item pronto e depois no cliente; cobrar = clicar nas moedas; trocar óleo = segurar o tacho por 8 s **(P)**; limpar = segurar a mesa (3 s) ou a vassoura (4 s, −25 de sujeira) **(P)** | Obrigatória |
| RN-43 | Tempos dos funcionários, com energia ≥ 40 e sem traços **(P)**: anotar 1,5 s; montar 0,5 s + 1,5 s por etapa (1 etapa = 2 s; 4 etapas = 6,5 s); colocar 0,8 s; tirar no meio da janela do ponto (nunca queima); caldo pelo tempo da moenda + 0,5 s; entregar e cobrar 1,5 s; troca de óleo 10 s; limpar mesa 3 s | Obrigatória |
| RN-44 | Fritador sem colocador no mesmo tacho acumula as duas funções: monta, coloca e tira, com o tempo de montagem e de colocação somado ao ciclo | Condicional |
| RN-45 | Funcionário **fixo** fica só na posição escolhida. Funcionário em **automático** ocupa a posição vaga de maior prioridade **que o tipo dele permite** (RN-49): Fritador > Balcão > Colocador > Moenda > Expedição > Garçom > Ajudante. Um Fritador em automático vira Trocador de óleo quando um tacho chega a 70% de sujeira e não há trocador | Obrigatória |
| RN-46 | Óleo: +4% de sujeira por pastel frito (+3% com Óleo de Algodão) **(P)**. A partir de 70% conta como sujo (RN-24). Em 100% o tacho trava até a troca. A troca custa R$ 25 (comum) ou R$ 45 (algodão) **(P)** e deixa o tacho parado durante a operação | Obrigatória |
| RN-47 | Salário diário base **(P)**: **Fritador R$ 75** (o maior), **Geral R$ 55**. Os traços modificam o salário (RN-114). Debitado no fechamento | Obrigatória |
| RN-48 | Contratar e dispensar só no Preparo e sem custo extra, entre os candidatos do dia (RN-113). O número de funcionários não pode passar o número de posições existentes | Restritiva |
| RN-49 | Existem **dois tipos de contratação**. **Fritador**: perfil único do tacho, o único que pode ocupar as posições de **Fritador** (tirar do óleo) e **Trocador de óleo**. Também pode ocupar qualquer outra posição. **Geral**: ocupa qualquer posição operacional, exceto Fritador e Trocador de óleo. O Colocador (montar + colocar) aceita os dois tipos | Obrigatória |

### 3.6 Metas, campanha e economia

| # | Regra | Tipo |
|---|---|---|
| RN-50 | **Meta do dia N** = lucro líquido ≥ R$ 80 × 1,18^(N−1) e reputação ao fim do dia ≥ 2,0 (dias 1–5), 3,0 (dias 6–12) ou 3,5 (dias 13–20) **(P)**. Meta não cumprida = o **contador de dias não avança** (próximo dia repete a mesma meta), mas caixa, reputação, compras, insumos e salários pagos **persistem** | Obrigatória |
| RN-51 | Caixa inicial R$ 200 e reputação inicial 3,0 **(P)**, mais o efeito do perfil do pasteleiro (RN-110) e de um ponto anterior (RN-57) | Obrigatória |
| RN-52 | **Falência:** caixa negativo depois do fechamento (custos maiores que o caixa) encerra a campanha. A partir do dia 10 **(P)**, a falência oferece **passar o ponto com desconto** (RN-57) | Restritiva |
| RN-53 | No Preparo nenhuma compra pode deixar o caixa negativo | Restritiva |
| RN-54 | Campanha de 20 metas. Cumprida a do dia 20, a campanha está zerada e entra em **modo livre** (dias sem meta; recorde = maior caixa) | Obrigatória |
| RN-55 | O progresso é salvo no Preparo, no início do Dia de Feira (checkpoint) e no fechamento. Só existe uma campanha salva, e "Nova campanha" pede confirmação antes de apagar a atual | Obrigatória |
| RN-56 | O card do hub mostra como recorde o maior dia concluído e, em modo livre, o maior caixa | Obrigatória |
| RN-57 | **Passar o ponto:** disponível no Preparo só depois de zerar. Valor do ponto = caixa + 50% do que foi gasto em equipamentos, espaço, mesas e estruturas **(P)**. Encerra a campanha atual e abre uma nova com caixa inicial R$ 200 + 20% do valor do ponto **(P)**, novo perfil e reputação 3,0. O maior valor de ponto fica registrado como recorde secundário. **Na falência** (dia ≥ 10): valor do ponto = 25% do que foi gasto em equipamentos, espaço, mesas e estruturas, sem somar o caixa negativo **(P)** | Condicional |

### 3.7 Reputação

| # | Regra | Tipo |
|---|---|---|
| RN-60 | Reputação de 1,0 a 5,0, mostrada em estrelas de meia em meia. Persiste entre dias | Obrigatória |
| RN-61 | Cada pedido termina como **sucesso** (correto, no prazo, qualidade ≥ exigência) ou **falha**. Pesos da falha **(P)**: balcão/mesa 1,0; fila cheia ou sem insumo 0,5; **app atrasado ou cancelado 3,0**; app com qualidade abaixo de 40 1,0; encomenda atrasada 3,0; pedido entregue com sujeira ≥ 80 +0,25 | Obrigatória |
| RN-62 | **Pontos de encanto (B):** brinde entregue +0,5; caldo com chorinho +0,1 por nível; fiscal aprovado +2,0 **(P)**. Taxa do dia = (sucessos + B) ÷ (sucessos + B + soma dos pesos das falhas). Variação no fechamento = (taxa − 0,75) × 4 quando a taxa passa de 0,75 e × 2 quando fica abaixo, limitada a ±1,0 estrela por dia **(P)** | Obrigatória |
| RN-63 | Entregar o item errado (fora do que o perfil aceita, RN-18): o cliente recusa, o item volta para a bancada e o pedido fica marcado como falha (uma vez só por pedido), mesmo que depois seja entregue certo | Obrigatória |
| RN-64 | Dia sem nenhum pedido não altera a reputação | Condicional |

### 3.8 Equipamentos e espaço

| # | Regra | Tipo |
|---|---|---|
| RN-70 | A barraca inicial tem 6 m² com balcão, 1 tacho pequeno, bancada e moenda manual **(P)** | Obrigatória |
| RN-71 | Metro quadrado extra: R$ 120 por m² na compra + R$ 8 por m² de taxa diária à associação, debitada no fechamento. Máximo 24 m² **(P)** | Obrigatória |
| RN-72 | Espaço exigido **(P)**: tacho extra 2 m²; mesa com 4 cadeiras 2 m²; área de delivery 3 m²; escritório 4 m²; caixa térmica 1 m²; área de descanso 1 m². Estufa, escorredor e moenda motorizada não ocupam espaço extra | Restritiva |
| RN-73 | Equipamentos **(P)**: Tacho grande (de 2 para 4 cestos) R$ 400 por tacho; tacho extra R$ 350 (máximo 3 tachos); moenda motorizada R$ 500; Óleo de Algodão R$ 300; Escorredor Profissional R$ 250; Embalagem Térmica R$ 250; Estufa de vidro R$ 300; Estufa grande (6 → 12 vagas, requer a estufa) R$ 350; Alarme do ponto R$ 60 por tacho (aviso visual e sonoro quando um pastel entra no ponto e 1 s antes de queimar); Termostato R$ 350 por tacho (janela do ponto +50% e "queima após" +3 s). Automação por equipamento na seção 3.19 | Obrigatória |
| RN-74 | **Área de jogo de 640×480 unidades lógicas (4:3)**, com layout fixo e sem câmera móvel. A **visão geral** ocupa a área inteira e mostra cada espaço comprado como zona nova (tacho, mesas, delivery, escritório, estoque, descanso). **Painel retrátil da estação:** quando o pasteleiro chega à estação tocada (RN-41), um painel de ≈ 640×180 **(P)** sobe por cima da faixa inferior com os controles detalhados (cestos e barras de fritura, ingredientes, moenda, comandas). Ele recolhe ao tocar fora dele ou depois de 4 s sem interação **(P)** | Obrigatória |
| RN-75 | A visão geral mostra o estado de todas as estações ao mesmo tempo (barra de fritura resumida por cesto, sujeira do óleo, fila, paciência, comandas do app, estufa), para o jogador acompanhar o que não está no painel. As zonas de uso mais frequente (fila, balcão, tachos, estufa) ficam acima da faixa que o painel cobre, e os avisos (oferta de comanda, eventos, alarme do ponto) ficam sempre visíveis, também com o painel aberto | Obrigatória |

### 3.9 Mesas

| # | Regra | Tipo |
|---|---|---|
| RN-80 | Mesa R$ 150 com 4 lugares, máximo 4 mesas **(P)** | Obrigatória |
| RN-81 | Com lugar livre e limpo, 30% dos clientes Padrão e Exigentes escolhem a mesa **(P)** | Condicional |
| RN-82 | Cliente de mesa: paciência ×1,5, paga +15% (prêmio de mesa) e ocupa o lugar por 25 s depois de receber o pedido **(P)** | Obrigatória |
| RN-83 | Sem garçom, o cliente de mesa entra na fila do balcão para pedir e retirar (JA-02). Com garçom, o pedido é anotado e entregue na mesa. Nos dois casos o pagamento é no balcão (RN-87) | Condicional |
| RN-84 | **Lugar sujo:** quando o cliente sai, o lugar fica sujo e ninguém senta ali até a mesa ser limpa (Ajudante, ou pasteleiro em 3 s por mesa). Limpar uma mesa limpa todos os lugares dela | Obrigatória |
| RN-85 | **Grupos:** clientes de mesa chegam em grupos de 1 a 4 (40% / 30% / 20% / 10% **(P)**). O grupo só senta numa mesa com lugares livres e limpos para todos. Sem mesa assim, o grupo vai para a fila do balcão como clientes individuais | Obrigatória |
| RN-86 | O grupo faz **um** pedido conjunto, entregue de uma vez. A paciência do grupo é a do integrante com menor paciência, e todos saem juntos | Obrigatória |
| RN-87 | **Pagamento da mesa:** ao terminar, o grupo deixa a mesa (o lugar fica sujo) e entra na **fila de pagamento** do balcão, separada da fila de pedidos, com no máximo 4 grupos **(P)**. Cobrar é ação de quem está no Balcão. Com a Maquininha de cartão, a cobrança é automática. Na fila de pagamento a paciência é de 20 s **(P)**. Esgotada, o grupo vai embora sem pagar (falha de peso 1,0). Com a fila de pagamento cheia, o grupo espera na mesa, que continua ocupada | Obrigatória |

### 3.10 Delivery (motoboys do app Cachorro Loko)

| # | Regra | Tipo |
|---|---|---|
| RN-90 | Área de delivery: R$ 600 + 3 m², a partir do dia 5 **(P)**. Pode ser **desligada** no Preparo para não receber pedidos do app naquele dia | Obrigatória |
| RN-91 | **Oferta de comanda:** o app oferece uma comanda a cada 25 s em média **(P)** (a chuva aumenta a frequência, RN-151), com 2 a 4 pastéis e retirada 35 s **depois do aceite** **(P)**. A oferta fica visível por 10 s **(P)**. O jogador aceita com um toque, de qualquer posição. Oferta ignorada expira sem penalidade | Obrigatória |
| RN-95 | **Teto diário de comandas aceitas (P):** 3 até reputação 3,5; 6 com reputação ≥ 3,5; 10 com reputação ≥ 4,5. +4 com o upgrade **Conta Parceira** do app (R$ 400). Atingido o teto, o app para de oferecer no dia. Com Expedição contratada, o Preparo permite ligar o **aceite automático** (aceita toda oferta até o teto) | Obrigatória |
| RN-96 | **Comanda pronta espera na estufa:** cada pastel de uma comanda pronta ocupa 1 vaga da estufa até o motoboy retirar. Sem vaga, a comanda fica na bancada da Expedição com o decaimento normal (RN-25). Pastel de balcão e de comanda disputam as mesmas vagas | Obrigatória |
| RN-92 | O motoboy chega no horário da retirada e espera até 25 s **(P)**, ou 60% disso com reputação abaixo de 2. Leva todas as comandas prontas que forem dele (até 2 por motoboy **(P)**). Comanda não pronta quando ele sai = cancelada | Obrigatória |
| RN-93 | O app paga o preço de venda menos 20% de taxa **(P)**, já com os fatores de qualidade e de reputação. O preço do app não passa pelo teto de perfil (RN-13). O brinde vale no app (RN-120). A xepa não vale no app | Obrigatória |
| RN-94 | Comanda cancelada: não é paga, os insumos já usados são perdidos e conta como falha de peso 3,0 (RN-61) | Restritiva |

### 3.11 Escritório e cargos de gestão

| # | Regra | Tipo |
|---|---|---|
| RN-100 | Escritório: R$ 1.500 + 4 m², a partir do dia 10 **(P)**. Tem 1 lugar para o pasteleiro e 3 vagas de cargo **(P)** | Obrigatória |
| RN-101 | **Bônus de gestão:** com o pasteleiro no escritório, os funcionários ficam 15% mais rápidos **(P)**. Lá ele não opera nenhuma estação | Condicional |
| RN-102 | **Encomendas:** só o escritório é exigido. Com ele, aparecem no Preparo 0 a 2 ofertas **(P)** (receita, quantidade 10–40, horário de retirada entre 09h e 13h30, pagamento ≈ 1,3× a referência por unidade e multa de 50% do pagamento **(P)**). Brinde e xepa não valem em encomenda | Condicional |
| RN-104 | **Caixa de encomenda:** os pastéis prontos da encomenda vão para uma caixa própria, que não ocupa a estufa e comporta a encomenda inteira. Lá a nota fica congelada por 60 s e depois cai 1 ponto/s **(P)**. O cliente da encomenda chega no horário e espera 30 s **(P)**. A entrega é feita por quem estiver no Balcão ou na Expedição. Encomenda incompleta quando ele vai embora = multa e falha de peso 3,0 | Condicional |
| RN-103 | **Cargos (P):** contratados no Preparo, só ocupam vagas do escritório, não cansam e não operam estações | Obrigatória |

| Cargo | Salário/dia **(P)** | Efeito |
|---|---|---|
| Contador | R$ 90 | Libera os **relatórios** (histórico por dia de lucro, reputação, vendas por receita, desperdício e falhas por tipo) e mostra custo e margem por item no Preparo |
| Comprador | R$ 80 | Compra sugerida em qualquer dia (RN-36) e insumos 8% mais baratos |
| Gerente | R$ 110 | Funcionários +10% de velocidade mesmo sem o pasteleiro no escritório (acumula com RN-101). Reivindicações 50% menos frequentes |
| Despachante | R$ 100 | Anula 1 multa de fiscalização a cada 5 dias e aumenta para 0–3 as ofertas de encomenda e de desafio |

### 3.12 Perfil do pasteleiro

| # | Regra | Tipo |
|---|---|---|
| RN-110 | Ao criar a campanha o jogador escolhe um perfil, fixo até o fim dela **(P)**: **Tradicional** (sem bônus, caixa inicial +R$ 100), **Negociante** (insumos −10%), **Chapeiro** (janela do ponto +1 s nas ações do pasteleiro), **Boa-praça** (paciência dos clientes +15%), **Gestor** (salários −10%) | Obrigatória |

### 3.13 Funcionários: candidatos, traços, cansaço, descanso e treinamento

| # | Regra | Tipo |
|---|---|---|
| RN-113 | No Preparo aparecem até 3 candidatos de cada tipo (Fritador e Geral) **(P)**, sorteados a cada dia, cada um com 0 a 2 traços visíveis | Obrigatória |
| RN-114 | Traços **(P)**: **Rápido** (tempos −15%, salário +15%), **Caprichoso** (nota +5 no que montar ou fritar, salário +10%), **Resistente** (cansa 40% menos, salário +10%), **Distraído** (5% de chance de montar o sabor errado, salário −15%), **Pavio curto** (reivindica 2× mais, salário −10%) | Obrigatória |
| RN-115 | **Energia** do funcionário: começa o dia em 100 e cai 0,5 por segundo trabalhando **(P)**. Com energia < 40 os tempos ficam +25%. Com energia < 15, +60% **(P)** | Obrigatória |
| RN-116 | Funcionário em automático com energia < 25 vai descansar e deixa a posição vaga. Na **área de descanso** recupera 4 por segundo até 80. Sem área, descansa parado onde está a 1 por segundo **(P)**. Funcionário fixo só descansa se o jogador mandar (clique nele) ou com energia em 0 | Obrigatória |
| RN-117 | **Área de descanso** (R$ 120, 1 m², 2 vagas; +1 vaga por R$ 80, máximo 4 **(P)**) | Condicional |
| RN-118 | **Treinamento (P):** pago no Preparo, efeito imediato e permanente para aquele funcionário, no máximo 1 curso por funcionário por dia | Obrigatória |

| Curso | Custo **(P)** | Efeito |
|---|---|---|
| Boas Práticas de Fritura | R$ 120 | Nota +5 no que ele fritar, troca de óleo 30% mais rápida e elimina a chance de fogo na troca (RN-152) |
| Atendimento | R$ 100 | Balcão, Garçom e Expedição 20% mais rápidos. Clientes atendidos por ele têm +5% de paciência |
| Higiene | R$ 80 | Sujeira gerada nas ações dele −30% e limpeza 30% mais rápida |

### 3.14 Promoções: brinde, chorinho e xepa

| # | Regra | Tipo |
|---|---|---|
| RN-120 | **Promoção do brinde:** no Preparo o jogador escolhe "a cada N pastéis, 1 de brinde", com N de 2 a 6 ou desligado **(P)**. Pedido de balcão, mesa ou **comanda do app** com N ou mais pastéis pagos recebe 1 pastel a mais, do mesmo sabor de menor preço do pedido. Encomendas não recebem brinde | Obrigatória |
| RN-121 | Com a promoção ligada, uma parte dos clientes aumenta o pedido até N: 40% com N ≤ 3 e 20% com N de 4 a 6 **(P)**, se o teto de preço permitir. Nas comandas do app o tamanho não muda (2 a 4 pastéis) | Condicional |
| RN-122 | O brinde consome insumos, consumível e produção como qualquer pastel. O pedido só fica completo com o brinde entregue (o prazo e a paciência valem para ele). O brinde entregue dá +0,5 de encanto (RN-62). O custo do brinde aparece separado no fechamento | Obrigatória |
| RN-123 | **Chorinho do caldo:** nível 0 a 3 escolhido no Preparo, com +10%, +20% ou +30% de cana por copo **(P)**. Cada nível consome 0,1 dose a mais e acrescenta 0,3 s na extração **(P)**. Cada caldo entregue com chorinho dá +0,1 de encanto por nível (RN-62) | Obrigatória |
| RN-124 | **Hora da xepa:** se ligada no Preparo, das 13h às 14h todos os itens saem com o desconto escolhido (10% a 50%, passo de 10% **(P)**). A chegada de clientes Econômicos sobe 30% **(P)** e os tetos de perfil passam a ser calculados sobre o preço de xepa | Condicional |
| RN-125 | Com xepa ligada, no fechamento os recheios e complementos que iam estragar (fora da caixa térmica) são vendidos a 30% do custo **(P)** e não contam como desperdício (RN-37) | Condicional |

### 3.15 Sujeira da barraca

| # | Regra | Tipo |
|---|---|---|
| RN-130 | A barraca tem nível de sujeira de 0 a 100. Começa cada dia em 0 **(P)** | Obrigatória |
| RN-131 | Sujeira sobe **(P)**: +1 por pedido entregue, +2 por cliente de mesa que sai, +3 por pastel queimado, +5 por troca de óleo | Obrigatória |
| RN-132 | O Ajudante ocioso limpa 10 pontos a cada 3 s. O pasteleiro limpa 25 pontos segurando a vassoura por 4 s **(P)** | Obrigatória |
| RN-133 | Efeitos **(P)**: sujeira ≥ 60 reduz a paciência de todos em 20% e afasta Exigentes (RN-16). Sujeira ≥ 80 soma +0,25 de falha a cada pedido entregue (RN-61) | Condicional |

### 3.16 Desafios da Associação da Feira

| # | Regra | Tipo |
|---|---|---|
| RN-135 | No Preparo aparecem até 2 desafios **(P)** (3 com Despachante), com objetivo, prazo em dias e prêmio pago na conclusão. Aceitar é opcional. Não cumprir no prazo não traz penalidade: o desafio só expira | Obrigatória |
| RN-136 | Catálogo inicial **(P)**: "Servir 40 caldos num dia" (R$ 150); "Ter 2 mesas e um garçom" (R$ 200); "Nenhuma comanda cancelada por 3 dias" (R$ 300); "Desperdício abaixo de 10% num dia" (R$ 150); "Chegar a 4 estrelas" (R$ 400); "Passar numa fiscalização" (R$ 200); "Vender 30 Especiais da Casa num dia" (R$ 350) | Obrigatória |
| RN-137 | Um desafio só é oferecido se for atingível com o que a barraca pode comprar (ex.: o de mesas não aparece antes de haver espaço possível) | Restritiva |

### 3.17 Estações do ano

| # | Regra | Tipo |
|---|---|---|
| RN-140 | Ciclo de 4 estações de 5 dias **(P)**: dias 1–5 Verão, 6–10 Outono, 11–15 Inverno, 16–20 Primavera. O ciclo se repete no modo livre. O dia que se repete por meta não cumprida mantém a estação do contador | Obrigatória |
| RN-141 | Efeitos **(P)**: **Verão**: chance de pedir caldo +40%, cansaço +25%, chance de chuva 25%. **Inverno**: chance de pedir caldo −40%, chance de 2 pastéis +20%, chance de chuva 10%. **Outono/Primavera**: neutros, chance de chuva 15% | Obrigatória |

### 3.18 Eventos

| # | Regra | Tipo |
|---|---|---|
| RN-150 | Eventos podem ser **desligados** ao criar a campanha. Ligados, só ocorrem a partir do dia 4 **(P)**, no máximo 1 previsto e 1 surpresa por dia **(P)**. Eventos previstos aparecem na previsão do Preparo | Obrigatória |
| RN-151 | Eventos previstos **(P)**: | Condicional |

| Evento | Chance | Efeito |
|---|---|---|
| Chuva | por estação (RN-141) | Chegada no balcão −40%, comandas do app +50%, mesas com metade da procura |
| Calor forte | 20% no Verão | Pedido de caldo +50% (acumula com a estação), cansaço +25% |
| Subprefeitura | 8% | Mesas proibidas na calçada no dia (zona de mesas inativa) |
| Reivindicação | 30% depois de um dia em que algum funcionário chegou a energia 0, ×2 com Pavio curto, ×0,5 com Gerente | Equipe pede pausa (exige área de descanso no dia) ou aumento de 10% por 3 dias. Recusar = −15% de velocidade no dia |

| # | Regra | Tipo |
|---|---|---|
| RN-152 | Eventos surpresa **(P)**: | Condicional |

| Evento | Chance / gatilho | Efeito |
|---|---|---|
| Fiscal da Vigilância | 12% por dia, entre 09h e 13h | Inspeção instantânea. Óleo ≥ 70% em qualquer tacho ou sujeira ≥ 60 = multa de R$ 150 e −0,3 de reputação. Aprovado = +2,0 de encanto (RN-62) |
| Queda de energia | 8% por dia, de 20 a 40 s | Moenda motorizada vira manual, a estufa para de congelar a nota e os equipamentos de automação (seção 3.19) param |
| Fogo no tacho | 3% por pastel colocado com óleo ≥ 90%. 5% por troca de óleo feita por funcionário sem curso de Fritura | Tacho parado por 20 s, pastéis dentro perdidos e R$ 80 de reparo |
| Excursão | 8% por dia | 15 clientes chegam em 20 s (podem estourar a fila) |
| Funcionário queimado | 2% por pastel tirado por funcionário sem curso de Fritura | O funcionário sai 30 s, posição vaga |

### 3.19 Automação por equipamento

Alternativa aos funcionários: custo único alto, sem salário e sem cansaço, mas com função limitada e
parada em queda de energia.

| # | Regra | Tipo |
|---|---|---|
| RN-160 | Equipamentos de automação **(P)**: | Obrigatória |

| Equipamento | Custo **(P)** | Substitui | Faz | Não faz |
|---|---|---|---|---|
| Cesto com timer | R$ 600 por tacho | Fritador | Tira sozinho cada pastel do seu tacho no meio da janela do ponto | Montar, colocar, trocar óleo, pôr na estufa (o pastel tirado fica no escorredor) |
| Moenda automática | R$ 900 (requer moenda motorizada) | Moenda | Extrai sozinha um caldo por pedido anotado, com o chorinho configurado | Entregar o copo |
| Maquininha de cartão | R$ 300 | Parte do Balcão | Cobra sozinha cada pedido entregue no balcão | Anotar e entregar |

| # | Regra | Tipo |
|---|---|---|
| RN-161 | Equipamento de automação e funcionário na mesma função não se somam: com o equipamento ativo, a posição correspondente vira opcional. O funcionário que estiver lá passa só a executar as outras tarefas da posição | Obrigatória |
| RN-162 | Pastel tirado pelo cesto com timer recebe a nota base "no ponto" (80) mais os modificadores do equipamento. Bônus de traço ou de curso não se aplicam | Obrigatória |

### 3.20 Apresentação, tutorial e controles

| # | Regra | Tipo |
|---|---|---|
| RN-165 | **Personagens são cachorros:** pasteleiro, funcionários, cargos, clientes e motoboys. Os clientes são sorteados com **raças, cores e portes variados** **(P)**. Os motoboys do app usam os cachorros da biblioteca de sprites do hub. O perfil de cliente (Econômico, Padrão, Exigente) e o tipo de funcionário (Fritador, Geral) têm um indicador visual fixo **(P)** | Obrigatória |
| RN-170 | **Tutorial guiado** no dia 1 (opcional ao criar a campanha): conduz o primeiro pedido passo a passo (anotar → montar → colocar → tirar → caldo → entregar → cobrar). Durante cada passo guiado o relógio pausa. O dia 1 conta normalmente para a meta | Condicional |
| RN-171 | **Desbloqueio progressivo:** abas, upgrades e sistemas só aparecem no Preparo quando ficam disponíveis (ex.: delivery no dia 5, tema no dia 5, Especial da Casa no dia 6, escritório no dia 10). Na primeira vez, cada um é apresentado com um balão curto | Obrigatória |
| RN-172 | **Som e música:** efeitos (fritura, alarme do ponto, moedas, avisos) e música de feira, com controle de mudo separado para efeitos e música, guardado entre sessões | Obrigatória |
| RN-173 | **Acelerar 2×:** botão (e tecla) que dobra a velocidade do Dia de Feira. Fica indisponível durante os passos guiados do tutorial. A pausa por perda de foco continua valendo | Obrigatória |
| RN-174 | **Atalhos de teclado (desktop) (P):** números para ir às estações, Espaço/Enter para a ação principal da estação, Esc para recolher o painel, P para pausa, M para mudo, F para acelerar. O toque/clique continua sendo o controle completo | Obrigatória |

## 4. Casos de Borda e Fluxos de Exceção

| Cenário | Comportamento esperado | Severidade |
|---|---|---|
| Progresso salvo corrompido ou ilegível | Ignorar o save, avisar "Progresso salvo inválido — nova campanha" e iniciar campanha nova sem travar | Crítica |
| Save de versão anterior do jogo | Converter quando houver conversão conhecida. Se não houver, tratar como corrompido | Alta |
| Armazenamento do navegador indisponível (modo privado) | O jogo funciona normalmente sem salvar e mostra aviso discreto uma vez | Alta |
| Primeiro quadro ou quadro após aba em segundo plano com tempo inválido/enorme | Tempo do quadro limitado a [0; 50 ms]. A perda de foco pausa o dia | Crítica |
| Pastel queimado no cesto | Vira "queimado", não pode ser entregue, conta no desperdício e o cesto fica bloqueado até alguém tirar | Alta |
| Tacho com óleo em 100% | Tacho travado. Cestos com pastel continuam fritando (podem queimar). Nada novo entra até a troca | Alta |
| Fogo no tacho com o pasteleiro ou um funcionário na posição | Ele sai da posição e espera o fim do bloqueio. Não há dano a pessoas | Média |
| Pasteleiro clica na estação enquanto se desloca | O destino é substituído pelo último clique, sem enfileirar ações | Média |
| Clique duplo ou toque repetido na mesma ação | Cada ação vale uma vez por gesto, sem cobrar ou entregar em dobro | Alta |
| Entrega do item certo para outro cliente | Aceita só se o item casar com um pedido pendente daquele cliente, pelas regras do perfil dele (RN-18). Senão é recusado (RN-63) | Média |
| Sabor esgota depois que o pastel trocado já está em produção | A troca vale para o pedido daquele momento. Se o sabor original não volta (não há reposição no dia, RN-33), não acontece nova troca | Baixa |
| Pedido de grupo com perfis diferentes | Cada item do pedido segue o perfil do integrante que o pediu. A paciência do grupo segue a RN-86 | Média |
| Insumo esgota no meio do dia | RN-35 | Média |
| Brinde sem insumo do mesmo sabor | O brinde sai de qualquer receita Tradicional de 1 etapa disponível. Se nenhuma estiver disponível, o brinde é dispensado sem falha | Média |
| Estufa cheia | O pastel pronto fica no balcão (ou na bancada da Expedição, se for de comanda) com decaimento normal | Baixa |
| Oferta de comanda aceita sem insumo suficiente | Aceite permitido. Os pastéis sem insumo fazem a comanda ser cancelada na retirada (RN-94) | Média |
| Oferta de comanda durante pausa | O tempo de exibição da oferta também pausa | Baixa |
| Cesto com timer com o pastel queimado por óleo em 100% | O timer tira o pastel no ponto mesmo com o tacho travado. Se faltar energia, vale a queima normal | Média |
| Compra que passa da capacidade de estoque | O controle limita a quantidade à capacidade livre | Média |
| Caixa térmica cheia no fechamento | O que não coube estraga (ou vai para a xepa, se ligada) | Baixa |
| Funcionário em automático sem posição vaga | Fica parado na barraca, recebe salário e aparece como ocioso no fechamento. Recupera energia a 1 por segundo | Baixa |
| Todos os funcionários descansando ao mesmo tempo | Permitido. O fechamento mostra tempo total de posição vaga por cansaço | Média |
| Mesa com lugares sujos e sem Ajudante | O lugar fica bloqueado até o pasteleiro limpar | Baixa |
| Subprefeitura com clientes já sentados | Evento previsto só começa no início do dia, então não há clientes sentados | Baixa |
| Delivery ligado sem estrutura (armadilha) | Comportamento intencional: filas estouram e a reputação cai. Não há aviso que impeça, só um alerta no fechamento ("app: N cancelados") | Média |
| Caixa insuficiente para os salários no fechamento | RN-52 (falência) | Crítica |
| Preço, desconto, N do brinde ou nível de chorinho fora da faixa | Controle limitado às faixas das RN, sem valor inválido possível | Média |
| Jogador sai do jogo (volta ao hub) no meio do dia | O dia em andamento é descartado. Ao voltar, retoma do checkpoint do início do Dia de Feira (JA-06), com novo sorteio de clientes, ofertas e eventos surpresa. Os eventos previstos do Preparo se mantêm | Alta |
| Encomenda aceita com receita sem insumo suficiente | O Preparo avisa a falta ao aceitar e ao iniciar o dia, mas permite seguir | Média |
| Grupo de mesa na fila de pagamento às 14h | Vai embora sem pagar e sem falha (RN-07) | Baixa |
| Tutorial pulado ou campanha nova após passar o ponto | O jogo não guia o dia 1, mas os balões de desbloqueio (RN-171) aparecem na primeira vez de cada sistema da campanha | Baixa |
| Painel aberto cobrindo uma zona com aviso | Avisos ficam acima do painel (RN-75). Tocar a zona coberta recolhe o painel e desloca o pasteleiro | Média |
| Acelerar 2× ligado ao abrir um evento surpresa | A velocidade continua 2×, e o aviso do evento aparece normalmente | Baixa |
| Passar o ponto com save atual | Pede confirmação. A campanha atual é substituída de forma definitiva | Alta |
| Tela estreita (≈ 390 px) ou toque | Todas as ações por toque. Os alvos de toque do painel da estação têm pelo menos 72×72 unidades lógicas (≈ 44 px CSS a 390 px de largura) **(P)**. Na visão geral, o toque numa zona seleciona a estação inteira. O Preparo é organizado em abas (Insumos, Cardápio, Melhorias, Equipe, Escritório, Associação) | Alta |

## 5. Critérios de Sucesso e SLAs

**Critérios funcionais:**

- [ ] Jornada principal completa (Preparo → Dia → Fechamento) jogável do dia 1 ao dia 20 e no modo livre.
- [ ] Jornadas alternativas JA-01 a JA-11 executáveis.
- [ ] Todas as RN (RN-01 a RN-174) verificáveis por uma simulação do dia sem tela, com semente fixa
      e resultado determinístico (inclusive candidatos, eventos e clima).
- [ ] Partida "só o pasteleiro, sem melhorias, eventos desligados" consegue cumprir as metas dos dias 1
      a 3 jogando bem (piso de equilíbrio).
- [ ] Ligar o delivery no dia 5 sem nenhum funcionário leva a reputação a cair no mesmo dia na
      simulação de referência (a armadilha funciona).
- [ ] Brinde com N = 2 e chorinho 3 todos os dias aumenta a reputação, mas reduz o lucro abaixo da
      meta na simulação de referência (o trade-off funciona).
- [ ] Barraca cheia (3 tachos grandes, 4 mesas, delivery, escritório, 2 caixas térmicas, área de
      descanso, estufa grande) cabe na visão geral de 640×480 sem sobrepor zonas, com as zonas de
      uso frequente fora da faixa coberta pelo painel. O painel de qualquer estação cabe em ≈ 640×180.
- [ ] Os valores (P) foram calibrados pela simulação sem tela até os critérios acima passarem, e
      os valores finais estão na tabela de parâmetros do jogo.

**Desempenho:**

- 60 quadros/s em desktop e ≥ 30 em celular intermediário, com o pior caso: 6 na fila + 15 da
  excursão, 16 em mesas, 4 motoboys, 12 cestos e 14 funcionários.
- Abrir o jogo a partir do hub em < 2 s em conexão doméstica.
- Salvar sem nenhuma pausa perceptível no jogo.

**Qualidade e conformidade com o hub:**

- [ ] O jogo não altera a aparência do hub nem de outros jogos.
- [ ] Textos em pt-BR, curtos.
- [ ] Jogável a ≈ 390 px de largura, inclusive o Preparo.
- [ ] README e documento de agente do jogo com a tabela de parâmetros.

## 6. Fora de Escopo

- Multiplayer, ranking online e qualquer serviço remoto.
- Reposição de insumos durante o dia.
- Revenda avulsa de equipamentos ou espaço (só pela passagem do ponto, RN-57).
- Painel de gestão ao vivo pelo escritório (reatribuir funções e preços durante o dia).
- Várias campanhas salvas ao mesmo tempo.
- Reiniciar o dia pelo menu de pausa.
- Escala de funcionários por turno, pré-preparo antes da abertura, recusa voluntária de pedido,
  modificadores de pedido, ponto pedido no ticket, varal de comandas, carga elétrica, freguês fiel,
  carência de falência, pagamento de desafio em parcelas, encadeamento de ações, recuperação de
  paciência, gorjeta por estação, dia perfeito/buzz, cartas de dificuldade e oferta do fornecedor
  (avaliados e não aprovados).

## 7. Glossário

| Termo | Definição neste contexto |
|---|---|
| **Barraca** | Toda a área controlada pelo jogador na feira, medida em m² |
| **Estação** | Ponto físico da barraca onde se faz uma ação (balcão, bancada, tacho, estufa, moenda, mesa, expedição, escritório, descanso) |
| **Posição** | Vaga de trabalho numa estação. Comporta uma pessoa |
| **Função** | Tipo de trabalho de uma posição (Balcão, Colocador, Fritador, Trocador de óleo, Moenda, Garçom, Ajudante, Expedição) |
| **Tipo de contratação** | Fritador (único que tira do óleo e troca óleo, maior salário) ou Geral (demais posições) |
| **Fila de pagamento** | Fila do balcão onde os grupos de mesa pagam ao sair |
| **Caixa de encomenda** | Armazenamento próprio dos pastéis prontos de uma encomenda |
| **Corte seco** | Encerramento às 14h: tudo o que está em aberto se perde sem falha |
| **Cargo** | Função de gestão exercida no escritório (Contador, Comprador, Gerente, Despachante) |
| **Fixo / Automático** | Modo do funcionário: preso a uma posição ou ocupando a posição vaga de maior prioridade |
| **Traço** | Característica de um candidato que muda rendimento e salário |
| **Energia** | 0–100 por funcionário. Cai trabalhando e sobe descansando |
| **Cesto** | Vaga de fritura de um tacho, um pastel por cesto |
| **Ponto** | Janela de tempo em que o pastel tirado do óleo recebe a nota máxima de fritura |
| **Nota (qualidade)** | 0–100 por pastel. Nasce na fritura, recebe os modificadores e decai na espera e no transporte |
| **Referência** | Preço base de um item, usado para o teto de cada perfil |
| **Comanda** | Pedido do app de delivery, aceito pelo jogador e retirado por um motoboy |
| **Oferta de comanda** | Comanda proposta pelo app que expira em 10 s se não for aceita |
| **Visão geral** | Tela inteira (640×480) com a barraca e o estado resumido de cada estação |
| **Painel da estação** | Painel retrátil que sobe sobre a faixa inferior da tela com os controles detalhados da estação onde o pasteleiro está |
| **Automação** | Equipamento que executa sozinho parte de uma função, sem salário nem cansaço |
| **Encomenda** | Pedido grande aceito no escritório, com prazo e multa |
| **Desafio** | Objetivo opcional proposto pela Associação, com prêmio |
| **Brinde** | Pastel grátis dado pela promoção "a cada N" |
| **Chorinho** | Quantidade a mais de caldo por copo |
| **Xepa** | Última hora da feira (13h–14h), com preço reduzido e venda das sobras |
| **Encanto** | Pontos positivos que aumentam a taxa de reputação do dia (brinde, chorinho, fiscal aprovado) |
| **Sujeira** | 0–100 da barraca. Afeta paciência, perfis e reputação |
| **Desperdício** | Insumo descartado: recheio, cana ou complemento estragado, massa vencida ou pastel queimado |
| **Consumível** | Copo, saquinho de papel ou embalagem do app. Não estraga |
| **Meta do dia** | Lucro líquido mínimo + reputação mínima para avançar o contador de dias |
| **Checkpoint** | Estado salvo no início do Dia de Feira, usado para retomar após saída |
| **Passar o ponto** | Vender a barraca depois de zerar para começar uma campanha nova com vantagem |
| **(P)** | Valor proposto pelo agente, ajustável na revisão e no equilíbrio |

## 8. Decisões registradas

Premissas da revisão 3, validadas pelo utilizador. Nenhuma premissa está pendente.

| # | Decisão | Regras |
|---|---|---|
| PA-01 | O **Colocador** monta e coloca no óleo. Não existe função Montador | RN-40 |
| PA-02 | Existe a função **Expedição** (embalar e entregar ao motoboy) | RN-40 |
| PA-03 | Dois tipos de contratação: **Fritador** (único no tirar do óleo e na troca de óleo, maior salário) e **Geral** | RN-47, RN-49 |
| PA-04 | Bônus de aproveitamento = receita × max(0; 15% − % de desperdício) | RN-37 |
| PA-05 | Condição do bônus: nenhum cliente foi embora por falta de insumo | RN-37 |
| PA-06 | Troca de óleo: 8 s pelo pasteleiro, 10 s por funcionário | RN-42, RN-43 |
| PA-07 | Sem revenda avulsa de equipamento ou espaço | Seção 6 |
| PA-08 | O pasteleiro não cansa | RN-115 |
| PA-09 | O brinde vale no balcão, na mesa e no app. Não vale na encomenda | RN-120, RN-93 |
| PA-10 | O chorinho consome fração de dose de cana (+0,1 por nível) | RN-123 |
| PA-11 | Desafios pagam só na conclusão | RN-135 |
| PA-12 | Encomendas exigem só o escritório | RN-102 |
| PA-13 | Sair e voltar no meio do dia faz um novo sorteio de clientes, ofertas e eventos surpresa | JA-06 |
| PA-14 | Comanda é aceita de qualquer posição | RN-91 |
| PA-15 | O jogo é exceção de resolução (640×480): a regra 7 do `CLAUDE.md` raiz e o `CLAUDE.md` do jogo serão atualizados (tarefa no backlog) | RN-74 |
| PA-16 | Painel da estação retrátil, sobre a visão geral de tela cheia | RN-74, RN-75 |
| PA-17 | As versões de uma receita convivem no cardápio, cada uma ocupando uma vaga | RN-30a |
| PA-18 | Grupos só na mesa | RN-85 |
| PA-19 | Tema da barraca escolhido no dia 5 | RN-17 |
| L1 | Corte seco às 14h, sem falha | RN-07 |
| L2 | Encomenda em caixa própria, retirada no horário | RN-104 |
| L3 | Fadiga só com 4 ou mais receitas | RN-30c |
| L4 | Mesa paga sempre no balcão (fila de pagamento) | RN-87 |
| L5 | Personagens cachorros de raças, cores e portes variados | RN-165 |
| L6 | Tutorial no dia 1 + desbloqueio progressivo | RN-170, RN-171 |
| L7 | Som/música com mudo, acelerar 2×, atalhos de teclado | RN-172–174 |
| L9 | Valores (P) calibrados por simulação sem tela | Cabeçalho, seção 5 |
| R-01 | Catálogo com 17 receitas: 7 tradicionais (inclui Bauru), 4 nobres, Especial da Casa (carne, ovo, queijo e azeitona, maior e mais caro) e 5 doces | RN-30 |
| R-02 | Doces são sobremesa, com vagas próprias (2 → 3) | RN-30b, RN-30e |
| R-03 | Vagas de salgados de 3 a 7 | RN-30b |
| R-04 | Melhorias só nas variações listadas pelo utilizador | RN-30a |
| R-05 | Mantém "Catupiry". "Nutella" vira "creme de avelã" | RN-30a, RN-32 |
| C-01 | Todos pedem sabor específico. Troca só automática, quando o sabor esgota: o Econômico leva o de maior estoque na categoria, o Padrão um de preço igual ou menor, e o Exigente não troca. O jogador nunca oferece troca | RN-18, RN-35, RN-63 |
| C-02 | Exigentes se concentram no fim do dia conforme a progressão da campanha (a partir do dia 6) | RN-19 |

**Derivações do agente (conferir na revisão):**

| # | Derivação | Regra |
|---|---|---|
| D-01 | O Fritador também pode ocupar posições gerais | RN-49 |
| D-02 | A fadiga é contada pela receita base, somando todas as versões | RN-30c |
| D-03 | Fila de pagamento com no máximo 4 grupos e 20 s de paciência | RN-87 |
| D-04 | Horário de retirada da encomenda entre 09h e 13h30, para não cair no corte seco | RN-102 |
| D-05 | O painel recolhe ao tocar fora dele ou depois de 4 s sem interação | RN-74 |
| D-06 | Atalhos de teclado: números, Espaço/Enter, Esc, P, M, F | RN-174 |
| D-07 | Especial da Casa usa 2 massas e ocupa 2 cestos do tacho | RN-30d |
| D-08 | Doce: 25% de chance por cliente (35% das 11h às 14h). Não entra no brinde, no app nem na encomenda | RN-30e |
| D-09 | Etapas de montagem = número de ingredientes de recheio. Temperos não contam. Montagem do funcionário em 0,5 s + 1,5 s por etapa | RN-30, RN-43 |
| D-10 | Item esgotado é trocado por outro da mesma categoria, de preço igual ou menor | RN-35 |
| D-12 | A mesma regra de troca vale para o caldo (sabores com complemento). "Mais disponível" = complemento com mais unidades no estoque | RN-18 |
| D-14 | Curva dos Exigentes: base até 10h e rampa até o máximo às 12h. A diferença sai dos Econômicos | RN-19 |
| D-11 | Melhoria que troca ingrediente (queijo minas, cream cheese, catupiry na carne seca, chocolate branco, creme de avelã) não soma etapa | RN-30a |
