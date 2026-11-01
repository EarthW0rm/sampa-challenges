# Especificação Funcional: Comandas e Expedição com balcão próprio (Pastel de Feira)

> Fase 1 do SDD — O Que e Porque. Status: **aprovada (revisão 1), incorporada na revisão 5 da [spec principal](../spec.md)**.
> Documento **delta** sobre a [spec principal](../spec.md) (revisão 4). Ele lista as regras **novas**
> (RN-180 a RN-196), as **alteradas** (texto novo completo) e as **removidas**. A implementação
> incorpora este delta na `spec.md` principal (revisão 5) e no `README.md` do jogo, no mesmo PR.
> Valores **(P)** seguem a convenção da spec principal: base aprovada e calibrada pelos robôs da
> simulação sem tela.
>
> Referências visuais: [mockups/expedicao.png](mockups/expedicao.png) e
> [mockups/layout-faixa-inferior.png](mockups/layout-faixa-inferior.png).

## 1. Visão Geral e Objetivo

- **O Problema:** o fluxo de pedidos e de expedição não se deixa ler na tela.
  - O motoboy é desenhado com o mesmo sprite de cliente. A fita verde dele quase coincide com a do
    perfil Econômico, e ele fica na mesma zona do funcionário da Expedição. Não dá para distinguir
    motoboy, cliente e funcionário.
  - Ao anotar um pedido do app, o jogador não vê os sabores: a oferta diz só "3 PASTEIS" e a comanda
    aparece como um contador. Não existe a ação "pôr na comanda". O pastel tocado vai sozinho para
    a primeira comanda que aceita o sabor.
  - No balcão, entregar é tocar no pastel e depois no cliente, e nada na tela liga o pastel a um
    destino. Não se sabe para quem entregar nem quem já recebeu.
- **A Solução (O Que):**
  - Todo pedido vira uma **comanda** com número, pendurada num **trilho**: o do balcão (clientes de
    balcão e de mesa) e o da Expedição (app e encomendas). Um selo de sabor marca cada item.
  - O jogador **põe** cada pastel ou caldo pronto **na comanda**. A comanda completa é entregue
    sozinha ao dono.
  - Internamente, os pedidos dos dois trilhos formam **uma única lista de produção**, ordenada pela
    entrada do pedido, que a equipe segue.
  - A Expedição ganha **balcão próprio**, uma **fila de motoboys** com paciência e um **motoboy com
    sprite próprio**.
- **O Valor (Porque):** fica visível para quem é cada item, o que falta e quem já recebeu. Isso
  elimina o erro de leitura sem tirar a decisão do jogador, que escolhe a comanda. Pedidos do
  balcão, do app e das encomendas passam a seguir o mesmo mecanismo. Com isso a Expedição vira um
  gargalo real e visível, em vez de uma armadilha escondida.

## 2. Jornadas do Usuário

### Atores (alterados)

| Ator | Papel (novo texto) |
|---|---|
| **Motoboy do app** | Chega à **fila do balcão da Expedição** 35 s depois do aceite, para retirar **uma** sacola. Tem paciência e vai embora quando ela acaba (sacola cancelada). Tem visual próprio (capacete, jaqueta e baú do app) e uma placa com o número da comanda |
| **Cliente da encomenda** | Chega no horário de retirada à fila do balcão da Expedição e espera 30 s **(P)** |
| **Atendente da Expedição** | O funcionário na posição Expedição ou o pasteleiro no balcão da Expedição. Preenche as comandas do trilho da Expedição e entrega as completas a quem está na fila |

### Jornada Principal — passo 2.3 (substitui o fluxo do pedido de balcão)

1. O cliente chega e entra na fila. O balão mostra "?" até o pedido ser anotado.
2. **Anotar** (balcão) cria a **comanda #N** no trilho do balcão, com um selo de sabor por item.
   - O balão do cliente passa a mostrar os selos e a placa **#N**.
   - Os itens da comanda entram no fim da **lista de produção**.
3. A produção segue o fluxo atual: **montar** → **colocar no óleo** → **tirar no ponto**, e o pastel
   vai para a estufa ou para o balcão, mais o **caldo** na moenda. Os funcionários seguem a lista de
   produção.
4. **Pôr na comanda:** o jogador toca num pastel ou caldo pronto e depois na comanda (ou no próprio
   cliente, como atalho).
   - Com um item selecionado, as comandas que aceitam aquele sabor ficam destacadas e as demais
     esmaecem.
   - O item entra na comanda, e o selo dele ganha um visto na comanda e no balão.
5. **Entrega automática:** quando o último item entra, a comanda é entregue. O cliente deixa as
   moedas no balcão e vai embora, e a comanda sai do trilho.
6. **Cobrar** (balcão), como hoje.

### Jornadas Alternativas (alteradas)

- **JA-02 Cliente de mesa:** o pedido do grupo vira a comanda **M** com o número da mesa, no trilho
  do balcão.
  - Com garçom, ele anota na mesa e preenche a comanda com os prontos do balcão. Completa, a
    comanda é entregue na mesa e o grupo come.
  - Sem garçom, o grupo pede na fila do balcão (RN-83). Completa, a comanda é entregue e o grupo
    volta à mesa para comer.
  - O pagamento segue na fila de pagamento (RN-87).
- **JA-03 Delivery:**
  1. A faixa de oferta mostra os **selos dos sabores** pedidos.
  2. O jogador aceita com um toque, de qualquer lugar. Com o aceite automático (RN-95), o aceite é
     sozinho quando há insumo.
  3. O aceite cria a comanda **APP N** no trilho da Expedição e uma **sacola** no balcão da
     Expedição. Os itens entram no fim da lista de produção.
  4. O atendente da Expedição pega os prontos do balcão e da estufa e os põe na sacola.
  5. O motoboy chega e entra na fila. Com a sacola completa e um atendente presente, ele recebe a
     sacola (1,5 s) e sai.
  6. Se a paciência dele acaba, a sacola é cancelada.
- **JA-04 Encomenda:**
  1. A encomenda é aceita no Preparo. Com o aceite automático e um funcionário na Expedição, o
     aceite é sozinho se o estoque cobre as unidades.
  2. Às 07h do dia ela vira a comanda **E N** no trilho da Expedição, com a **caixa da encomenda**
     no balcão da Expedição, e as unidades entram na lista de produção nessa hora.
  3. O cliente chega no horário e entra na fila da Expedição. Com a caixa completa e um atendente,
     ele recebe a caixa e sai.

## 3. Regras de Negócio e Restrições

### 3.21 Comandas e trilhos (novas)

| # | Regra | Tipo |
|---|---|---|
| RN-180 | **Comanda:** todo pedido gera uma comanda no momento em que **entra**. Pedido de balcão e de mesa entra ao ser anotado; comanda do app, ao ser aceita; encomenda, às 07h do dia em que vence. A comanda tem um **número** visível, sequencial no dia a partir de 1 (prefixos: nenhum no balcão, **M** na mesa, **APP** no app, **E** na encomenda), um **dono** (cliente, grupo, motoboy ou cliente da encomenda) e um **item** por unidade pedida, brinde incluído (RN-120) | Obrigatória |
| RN-181 | **Dois trilhos:** as comandas de balcão e de mesa ficam no **trilho do balcão**, acima do balcão, sempre visível. As do app e das encomendas ficam no **trilho da Expedição**. Cada comanda mostra o número, um **selo de sabor** por item (os mesmos selos do jogo, com os pontinhos de versão), um visto em cada item preenchido e a estrela nos brindes. O trilho do balcão mostra as 6 comandas mais antigas **(P)** e as demais como "+N" | Obrigatória |
| RN-182 | **Pôr na comanda:** um pastel ou caldo pronto entra na comanda escolhida se ela tiver um item livre do **mesmo sabor** (RN-18). Sabor sem item livre é **recusado sem custo**: o item continua onde estava, a comanda treme e toca um aviso. Para o Exigente, sabor certo com versão diferente **entra**, mas marca o pedido como item errado (RN-63) | Obrigatória |
| RN-183 | **Quem preenche cada trilho:** o trilho do balcão pelo pasteleiro no balcão (ou nas mesas, para as comandas M), pelo funcionário do Balcão e pelo Garçom (comandas M). O trilho da Expedição pelo pasteleiro no balcão da Expedição e pelo funcionário da Expedição. Os prontos vêm sempre do balcão e da estufa: não existem prontos na Expedição | Obrigatória |
| RN-184 | **Destaque do destino:** com um item pronto selecionado, as comandas que têm item livre para aquele sabor ganham contorno dourado e as demais ficam esmaecidas, nos dois trilhos e no painel | Obrigatória |
| RN-185 | **Placa de número:** o dono de cada comanda leva uma placa com o mesmo número (sobre o cliente na fila, o grupo na mesa, o motoboy e o cliente da encomenda). Tocar numa comanda sem item selecionado faz a placa do dono piscar. O balão do cliente mostra os selos, o visto dos itens preenchidos e a placa | Obrigatória |
| RN-186 | **Entrega automática:** quando o último item entra, a comanda é entregue. Cliente de balcão: paga (moedas no balcão) e sai. Grupo de mesa: come (RN-82) e depois paga (RN-87). Sacola do app e caixa da encomenda: são entregues pelo atendente da Expedição quando o dono está na frente da fila (RN-191). Não há entrega parcial | Obrigatória |
| RN-187 | **Lista de produção:** os itens de todas as comandas abertas formam uma lista única, ordenada pela **entrada** do pedido (RN-180) e, dentro da comanda, pela ordem dos itens. O que já existe pronto, montado, no óleo ou na moenda é descontado. A Montagem, o Fritador, a Moenda e a moenda automática seguem essa ordem. A encomenda entra às 07h, sem prioridade especial | Obrigatória |
| RN-188 | **Equipe preenche a mais antiga:** os funcionários do Balcão, do Garçom e da Expedição põem cada pronto na comanda **mais antiga** do seu trilho que aceita o sabor, em 1,5 s (RN-43; −20% com o curso de Atendimento). O jogador pode escolher outra comanda a qualquer momento | Obrigatória |
| RN-189 | **Decaimento na comanda:** o pastel na comanda do balcão decai como pastel pronto fora da estufa (RN-25). Na **sacola do app** e na **caixa da encomenda**, o decaimento é multiplicado por 0,25 **(P)** desde a entrada do primeiro pastel até a retirada. A nota usada para pagar é a da retirada | Obrigatória |

### 3.22 Expedição com balcão próprio (novas)

| # | Regra | Tipo |
|---|---|---|
| RN-190 | **Balcão da Expedição:** a zona Expedição tem um balcão próprio, onde ficam as sacolas e as caixas de encomenda (com o número e a barra de progresso), o atendente (funcionário ou pasteleiro) e, à frente, a **fila da Expedição**. É ali que o jogador toca para agir | Obrigatória |
| RN-191 | **Fila da Expedição:** motoboys e clientes de encomenda entram na fila por ordem de chegada. Quem está na frente recebe a sua sacola ou caixa quando ela está completa **e** há atendente no balcão da Expedição. A entrega leva 1,5 s **(P)** e o dono sai. Sem atendente, a fila cresce. A fila não tem limite: o teto diário (RN-95) e as encomendas aceitas já a limitam | Obrigatória |
| RN-192 | **Paciência na fila da Expedição:** conta desde a chegada. Motoboy 25 s **(P)** (60% com reputação abaixo de 2); cliente de encomenda 30 s **(P)**. Esgotada, o dono vai embora e a comanda é **cancelada**: os itens já preenchidos se perdem e valem a RN-94 (app, falha 3,0) ou a RN-104 (encomenda, multa e falha 3,0) | Obrigatória |
| RN-193 | **Motoboy leva uma sacola:** cada comanda do app tem o seu motoboy, que chega 35 s **(P)** depois do aceite (RN-91) | Obrigatória |
| RN-194 | **Visual do motoboy:** sprite próprio na biblioteca compartilhada do hub (cachorro com capacete, jaqueta e baú do app), diferente do sprite de cliente e do uniforme de funcionário. Não usa fita de perfil | Obrigatória |
| RN-195 | **Oferta com sabores:** a faixa da oferta do app mostra os selos dos sabores pedidos e o tempo que falta | Obrigatória |
| RN-196 | **Layout da faixa inferior:** Mesas 200, Expedição 200, Escritório 100 e Descanso 100 de largura lógica, nessa ordem e com 6 de espaço entre as zonas. As mesas ficam em 2×2, mais próximas | Obrigatória |

### Regras alteradas (texto novo completo)

| # | Regra (novo texto) | Tipo |
|---|---|---|
| RN-07 | **Corte seco às 14h:** nenhum cliente novo chega. Quem está na fila do balcão, na fila da Expedição, nas mesas ou na fila de pagamento vai embora sem pagar e **sem falha**. Comandas abertas, pedidos em produção e pastéis prontos não entregues são perdidos **sem falha**. Os pastéis prontos, montados e os que estão nas comandas contam como desperdício | Obrigatória |
| RN-25 | Decaimento: um pastel pronto fora da estufa perde 1 ponto/s depois de 20 s de espera **(P)**. Na sacola do app e na caixa da encomenda vale a RN-189. O pedido de app perde 20 pontos no transporte, perda anulada pela Embalagem Térmica **(P)** | Obrigatória |
| RN-27 | **Estufa de vidro:** melhoria do **balcão**, uma vitrine em cima dele, e não uma estação. O pastel tirado do óleo (pelo pasteleiro, pelo Fritador ou pelo timer) vai **direto** para ela enquanto houver vaga; cheia ou sem energia, fica no balcão. Guarda até 6 pastéis prontos **(P)**, ou 12 com a Estufa grande. Lá dentro a nota fica congelada por 60 s e depois cai 1 ponto/s **(P)**. Sem energia (evento) vale o decaimento normal. A estufa guarda prontos ainda **sem comanda**: ao entrar numa comanda, o pastel sai da estufa | Condicional |
| RN-40 | (trecho alterado) **Expedição** (só com a área de delivery: preenche as comandas do trilho da Expedição e entrega na fila da Expedição, RN-190/RN-191). **Balcão** (anotar, pôr na comanda do trilho do balcão, cobrar). **Garçom** (só com mesas: anota na mesa e preenche as comandas M). O resto da RN-40 não muda | Obrigatória |
| RN-42 | (trecho alterado) **pôr na comanda** = clicar no item pronto e depois na comanda (ou no dono). Substitui o "entregar = clicar no item pronto e depois no cliente". A entrega é automática (RN-186) | Obrigatória |
| RN-43 | (trecho alterado) **pôr na comanda** e **entregar na fila da Expedição**: 1,5 s cada. Substitui o "entregar 1,5 s" | Obrigatória |
| RN-63 | **Item errado:** o sabor errado é recusado na comanda, sem custo (RN-182). A versão errada para o Exigente entra na comanda; na entrega, o pedido conta como **falha** de peso 1,0 (uma vez por pedido) e é pago normalmente | Obrigatória |
| RN-74 | (trecho alterado) A faixa inferior segue a RN-196 | Obrigatória |
| RN-75 | (trecho alterado) A visão geral mostra também os dois trilhos de comandas, a fila da Expedição e as placas de número. O trilho do balcão fica acima da faixa coberta pelo painel. Com o painel da Expedição aberto, as comandas da Expedição aparecem também como controles do painel | Obrigatória |
| RN-83 | Sem garçom, o cliente de mesa entra na fila do balcão para pedir. A comanda **M** fica no trilho do balcão e, completa, é entregue a ele, que volta à mesa para comer. Com garçom, o pedido é anotado na mesa, o garçom preenche a comanda M e, completa, ela é entregue na mesa. Nos dois casos o pagamento é no balcão (RN-87) | Condicional |
| RN-91 | **Oferta de comanda:** o app oferece uma comanda a cada 25 s em média **(P)** (a chuva aumenta a frequência, RN-151), com 2 a 4 pastéis. A oferta fica visível por 10 s **(P)** e mostra os sabores (RN-195). O jogador aceita com um toque, de qualquer posição. O aceite cria a comanda APP e a sacola (RN-180), e o motoboy chega 35 s depois (RN-193). Oferta ignorada expira sem penalidade | Obrigatória |
| RN-92 | O motoboy chega e entra na fila da Expedição (RN-191), com a paciência da RN-192. Leva só a sacola dele (RN-193). Sacola não completa quando a paciência acaba = cancelada | Obrigatória |
| RN-95 | **Teto diário de comandas aceitas (P):** 3 até reputação 3,5; 6 com reputação ≥ 3,5; 10 com reputação ≥ 4,5. +4 com o upgrade **Conta Parceira** do app (R$ 400). Atingido o teto, o app para de oferecer no dia. **Aceite automático** (opção do Preparo, que só pode ser ligada com um funcionário na posição Expedição): aceita a oferta sozinho quando há embalagem, o teto não foi atingido e há **insumo para todos os itens**, descontando o que a lista de produção já reservou. Sem insumo, a oferta expira sem penalidade | Obrigatória |
| RN-102 | (trechos alterados) **Encomendas exigem o escritório e a área de delivery** (a Expedição é onde a encomenda é montada e retirada, RN-104). Com os dois, aparecem no Preparo 0 a 2 ofertas **(P)**, com as mesmas condições de hoje. Desligar o delivery no Preparo (RN-90) desliga só as ofertas do app: a Expedição continua atendendo as encomendas do dia. Com o aceite automático ligado e um funcionário na Expedição, a encomenda oferecida no Preparo é aceita sozinha quando o estoque comprado cobre as unidades, somadas às das outras encomendas aceitas. Sem estoque, fica para o aceite manual | Condicional |
| RN-104 | **Caixa de encomenda:** a encomenda é a comanda **E** do trilho da Expedição (RN-180), com a caixa no balcão da Expedição, que comporta a encomenda inteira e não ocupa a estufa. Lá o decaimento segue a RN-189, e o pagamento continua o da RN-102. O cliente da encomenda chega no horário e entra na fila da Expedição (RN-191, RN-192). Encomenda incompleta quando ele vai embora = multa e falha de peso 3,0 | Condicional |
| RN-160 | (linha da Moenda automática) Extrai sozinha os caldos da lista de produção (RN-187), na ordem, com o chorinho configurado. Não põe o copo na comanda | Obrigatória |
| RN-165 | (trecho alterado) Os motoboys do app têm sprite próprio (RN-194). Os clientes continuam sorteados entre os cachorros da biblioteca | Obrigatória |
| RN-170 | (trecho alterado) O passo "entregar" do tutorial vira "toque no pastel pronto e depois na **comanda #N**", com a seta apontando a comanda | Condicional |

### Regras removidas

| # | Motivo |
|---|---|
| RN-96 | "Comanda pronta espera na estufa" deixa de existir: os itens do app ficam na sacola (RN-189), e a estufa guarda só prontos sem comanda (RN-27) |

## 4. Casos de Borda e Fluxos de Exceção

| Cenário | Comportamento esperado | Severidade |
|---|---|---|
| Tocar numa comanda com um item que não casa com nenhum item livre dela | Recusa sem custo (RN-182). O item continua selecionado | Média |
| Item selecionado some antes do toque na comanda (entrou noutra comanda pela equipe, queimou ou o dia acabou) | A seleção é limpa e o toque na comanda só faz a placa do dono piscar | Média |
| Toque duplo ou repetido no mesmo gesto | O item entra uma vez só (gesto com id único, regra atual) | Alta |
| Comanda cancelada (paciência esgotada) com itens dentro | Os itens se perdem e contam como desperdício. Valem as falhas da RN-06 (balcão/mesa), RN-94 (app) ou RN-104 (encomenda) | Alta |
| Sabor esgota com a comanda aberta (RN-35) | O item ainda livre troca de sabor pelo perfil do dono (RN-18), e o selo na comanda e no balão muda. O Exigente vai embora e a comanda é cancelada (falha 0,5) | Média |
| Distraído monta o sabor errado (RN-114) | O pastel errado fica pronto sem dono e só entra numa comanda que tenha item livre daquele sabor. A lista de produção volta a pedir o sabor que faltou | Média |
| Mais comandas que o trilho do balcão mostra | As 6 mais antigas aparecem e as demais ficam em "+N". O atalho de tocar no dono preenche qualquer comanda | Baixa |
| Fila da Expedição sem atendente | A fila cresce e cada dono gasta a sua paciência. Não há aviso que impeça (a armadilha do delivery continua) | Média |
| Sacola completa e motoboy ainda não chegou | A sacola espera no balcão da Expedição com o decaimento da RN-189 | Baixa |
| Motoboy chega e a sacola já está completa, mas não há atendente | Ele espera na fila gastando paciência até alguém atender | Média |
| Oferta aceita manualmente sem insumo suficiente | Aceite permitido (regra atual). A lista de produção não consegue produzir o item, e a sacola é cancelada quando a paciência do motoboy acaba (RN-94) | Média |
| Aceite automático com insumo só para parte da oferta | Não aceita. A oferta expira sem penalidade | Média |
| Queda de energia (RN-152) | A estufa para (RN-27). Sacolas e caixas não dependem de energia | Baixa |
| Encomenda grande às 07h | Entra na lista de produção às 07h, sem prioridade (RN-187). A equipe a produz antes dos clientes que chegarem depois | Média |
| Corte seco às 14h com comandas abertas | RN-07 (sem falha) | Baixa |
| Delivery desligado no Preparo com encomenda aceita para o dia | A Expedição funciona só para a encomenda: sem ofertas do app, com a fila da Expedição e o aceite automático de encomenda valendo | Média |
| Save com escritório, sem área de delivery e com encomenda aceita (campanha anterior à mudança) | Ao carregar, a encomenda é descartada sem multa e sem falha, e o Preparo avisa uma vez | Alta |
| Tela estreita (≈ 390 px) | Cada comanda tem alvo de toque de pelo menos 28×24 unidades lógicas **(P)**. Se não couber, o trilho do balcão mostra 4 comandas e "+N" | Alta |

## 5. Critérios de Sucesso e SLAs

**Critérios funcionais:**

- [ ] O motoboy, o cliente e o funcionário são distinguíveis à primeira vista. Na revisão visual, a
      captura da Expedição segue o [mockup](mockups/expedicao.png).
- [ ] Cada comanda mostra os sabores, o que falta e quem é o dono (número igual na comanda e na
      placa). Um pedido entregue some do trilho no mesmo quadro.
- [ ] O pastel só entra na comanda pelo gesto do jogador ou pela regra da equipe (RN-188). Não
      existe mais o preenchimento implícito da primeira comanda que aceita.
- [ ] RN-180 a RN-196 e as regras alteradas verificáveis pela simulação sem tela com semente fixa
      (cenários novos e migrados), e cada uma citada por pelo menos um teste de ponta a ponta
      (`test:e2e:cobertura` sem pendência).
- [ ] Os critérios da seção 5 da spec principal continuam passando: piso de equilíbrio nos dias 1
      a 3, armadilha do delivery, trade-off do brinde e barraca cheia cabendo no layout da RN-196.
- [ ] Robôs de calibração (`--bots all --seeds 50`) passam em pelo menos 80% das sementes, depois de
      calibrar os valores (P) novos (RN-181, RN-189, RN-191, RN-192) e os afetados pela lista de
      produção e pelo fim do item errado de sabor.
- [ ] A campanha inteira pela tela (`test:e2e:campanha`) passa.

**Desempenho:** os mesmos alvos da spec principal (60 quadros/s em desktop, ≥ 30 em celular
intermediário), com o pior caso acrescido de 6 comandas no trilho do balcão, 4 no da Expedição e
4 motoboys na fila.

**Qualidade:** textos em pt-BR curtos. Jogável a ≈ 390 px. O README do jogo (manual) e o
`CLAUDE.md` do jogo atualizados no mesmo PR.

## 6. Fora de Escopo

- Mostrar a lista de produção ao jogador ou permitir reordená-la.
- Entrega parcial de comanda.
- Motoboy levando mais de uma sacola.
- Mudar o pagamento da encomenda (continua fixo, RN-102).
- Prontos guardados na Expedição: eles ficam no balcão e na estufa.

## 7. Glossário

| Termo | Definição neste contexto |
|---|---|
| **Comanda** | Registro de um pedido, com número, dono e um item por unidade pedida. Fica num trilho até ser entregue ou cancelada |
| **Trilho** | Faixa onde as comandas ficam penduradas: o do balcão (balcão e mesa) e o da Expedição (app e encomenda) |
| **Item da comanda** | Uma unidade pedida (pastel, caldo ou brinde), livre ou preenchida |
| **Pôr na comanda** | Ação que move um pronto do balcão ou da estufa para um item livre da comanda |
| **Dono** | Quem recebe a comanda: cliente, grupo de mesa, motoboy ou cliente da encomenda |
| **Sacola** | Embalagem da comanda do app no balcão da Expedição, onde o decaimento é reduzido |
| **Caixa da encomenda** | Embalagem da comanda E no balcão da Expedição, com o mesmo decaimento da sacola |
| **Lista de produção** | Ordem interna dos itens a produzir, pela entrada dos pedidos, que a equipe segue |
| **Fila da Expedição** | Fila de motoboys e de clientes de encomenda diante do balcão da Expedição |
| **Atendente da Expedição** | O funcionário na posição Expedição ou o pasteleiro no balcão da Expedição |

## 8. Decisões registradas

Decisões do utilizador no brainstorming e no discovery desta revisão:

| # | Decisão | Regras |
|---|---|---|
| CE-01 | Comanda explícita em trilho (e não só ajustes visuais da entrega direta) | RN-180, RN-182 |
| CE-02 | A comanda completa é entregue sozinha | RN-186 |
| CE-03 | Dois trilhos: balcão (balcão e mesa) e Expedição (app e encomenda) | RN-181 |
| CE-04 | A equipe preenche a comanda mais antiga, e o jogador pode escolher outra | RN-188 |
| CE-05 | Trilho da Expedição atendido pelo funcionário da Expedição ou pelo pasteleiro | RN-183 |
| CE-06 | Motoboy com sprite próprio, número que liga a comanda ao dono e destaque do destino. O registro de saída fica de fora | RN-184, RN-185, RN-194 |
| CE-07 | Mesas e encomendas também entram no modelo de comanda | RN-83, RN-104 |
| CE-08 | Sabor errado bloqueado sem custo; só a versão errada do Exigente passa e conta falha | RN-63, RN-182 |
| CE-09 | Os sabores continuam no balão do cliente, além da placa | RN-185 |
| CE-10 | Sacola do app como "estufa": decaimento reduzido até a retirada, com o valor calculado na retirada | RN-189 |
| CE-11 | Lista única de produção para balcão e Expedição, com o mesmo mecanismo de entrada | RN-187 |
| CE-12 | Balcão próprio da Expedição, com fila de motoboys como a fila de clientes. A comanda completa dispara a saída | RN-190, RN-191 |
| CE-13 | O aceite do app continua na faixa, e o motoboy chega depois | RN-91 |
| CE-14 | Paciência do motoboy como a do cliente, uma sacola por motoboy | RN-192, RN-193 |
| CE-15 | Encomenda igual à sacola do app | RN-104 |
| CE-16 | Aceite automático com toggle mantido; ligado, exige insumo (app e encomenda) | RN-95, RN-102 |
| CE-17 | Os mesmos ícones de sabor do jogo em comandas, balão, oferta e painel | RN-181, RN-195 |
| CE-18 | Delta em pasta própria, incorporado à spec principal na implementação | Cabeçalho |
| CE-19 | Layout da faixa inferior: Mesas 200, Expedição 200, Escritório 100, Descanso 100 | RN-196 |
| CE-20 | Todos os prontos ficam no balcão e na estufa; o atendente da Expedição os põe direto na sacola | RN-183 |
| CE-21 | Encomenda entra na lista às 07h (FIFO puro) | RN-187 |
| CE-22 | Encomenda exige escritório **e** área de delivery (substitui a PA-12 da spec principal) | RN-102 |

**Derivações do agente (conferir na revisão):**

| # | Derivação | Regra |
|---|---|---|
| DCE-01 | Fator de decaimento da sacola e da caixa 0,25 **(P)** | RN-189 |
| DCE-02 | Número da comanda sequencial no dia, com prefixos M, APP e E | RN-180 |
| DCE-03 | A calma por posição (RN-06b) vale só para a fila do balcão. Na fila da Expedição a paciência corre em ritmo normal para todos | RN-192 |
| DCE-04 | A fila da Expedição não tem limite próprio | RN-191 |
| DCE-05 | O trilho do balcão mostra 6 comandas (4 a ≈ 390 px), e o atalho de tocar no dono cobre as escondidas | RN-181 |
| DCE-06 | Na comanda do balcão o pastel decai como pronto fora da estufa e sai da estufa ao entrar na comanda | RN-27, RN-189 |
| DCE-07 | O aceite automático desconta do estoque o que a lista de produção já reservou | RN-95 |
| DCE-08 | A entrega na fila da Expedição leva 1,5 s, igual ao antigo "entregar" | RN-191 |
