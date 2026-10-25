# Especificação Funcional: Testes de ponta a ponta e manuais completos dos jogos

> Fase 1 do SDD — O Que e Porque. Status: **aprovado (revisão 1)**.
> Escopo: os 7 jogos sem testes de ponta a ponta (Cachorro Loko, Capacete Voador, Corredor SP,
> Fuga da Rocam, Pinball Paulista, Sinuca de Bar, Xadrez Paulistano), o hub e a extração da base
> comum hoje presa ao Pastel de Feira. Entrega única (um PR).

## 1. Visão Geral e Objetivo

- **O Problema:** só o Pastel de Feira tem testes que jogam pela tela, com evidência visual de cada
  ação e um jogador automático que joga a campanha inteira. Os outros 7 jogos e o hub não têm nenhuma
  verificação no navegador: uma regressão em controle, pontuação, recorde, pausa ou tela de celular
  só aparece quando alguém joga. Os manuais também são desiguais: o README da Fuga da Rocam tem 11
  linhas, o CLAUDE.md dela 16, e nenhum README fora o do Pastel numera as regras, então não há como
  dizer qual regra um teste prova. A base dos testes do Pastel (relógio controlado, sorteio
  previsível, evidências) está escrita só para ele e não serve aos outros jogos.
- **A Solução (O Que):**
  1. **Manual completo por jogo:** o README de cada um dos 7 jogos vira o manual completo do jogo
     (início rápido, controles, telas, regras e mecânicas numeradas, parâmetros, arquitetura,
     testes), no mesmo nível e estrutura do manual do Pastel de Feira. O CLAUDE.md de cada um fica
     completo para quem for mexer no código.
  2. **Base comum de testes:** relógio controlado, sorteio previsível e evidências com cabeçalho
     passam a servir a todos os jogos; o Pastel de Feira passa a usar a mesma base, sem perder nada
     do que faz hoje.
  3. **Suíte por jogo:** cada regra numerada do manual tem pelo menos um teste que joga pela tela e
     cita o número da regra; cada jogo tem um jogador automático que joga partidas inteiras.
  4. **Suíte do hub:** home, rotas, barra de volta, troca de jogo, isolamento visual e recorde nos
     cards.
- **O Valor (Porque):** toda mudança em qualquer jogo passa a ter rede de proteção e prova visual
  (o PNG da evidência mostra o que a tela exibia em cada ação). O manual numerado vira o contrato:
  regra sem teste ou teste sem regra ficam visíveis. Bugs achados no caminho são corrigidos na
  mesma entrega, como no PR #14 do Pastel (10 bugs).

## 2. Jornadas do Usuário

### Atores

| Ator | Papel |
|---|---|
| **Pessoa desenvolvedora** | Muda um jogo, roda as suítes, lê as evidências e o relatório |
| **Agente de IA** | Lê README/CLAUDE.md do jogo antes de mexer; escreve e roda testes |
| **Suíte rápida** | Conjunto de testes de regras, rodado a cada mudança |
| **Suíte longa** | Partidas inteiras pelos jogadores automáticos, rodada à parte |
| **Jogador automático (piloto)** | Decide jogadas como um jogador e as executa só por toque/teclado/clique |
| **Manual (README)** | Fonte única das regras numeradas de cada jogo |

### Jornada Principal — mudar um jogo com segurança

1. A pessoa (ou o agente) abre o README do jogo e acha a regra pelo número (ex.: `CL-RN-07`).
2. Muda o código ou o número de equilíbrio e atualiza a regra/tabela do README no mesmo commit.
3. Roda a suíte rápida de todos os jogos (ou só a daquele jogo, ou só uma regra pelo número).
4. Cada teste abre o jogo pelo hub, joga pela tela com o relógio controlado e grava um PNG por ação,
   com cabeçalho dizendo teste, ação, passo do fluxo e o estado da tela.
5. Se algo falha, o relatório aponta a regra violada e a última evidência (`falha`) mostra a tela no
   instante da falha.
6. Antes de entregar, roda a suíte longa: cada piloto joga partidas inteiras até o fim de jogo e as
   contas (placar, recorde, resultado) batem com as do próprio jogo.

### Jornadas Alternativas

- **Reduzir evidências:** a pessoa escolhe o nível (todas as ações, só os marcos, nenhuma) por uma
  variável de ambiente; o nome que o Pastel usa hoje continua valendo.
- **Reproduzir uma falha do piloto:** a partida do piloto grava semente e sequência de comandos;
  repetir com a mesma semente dá a mesma partida.
- **Celular:** os testes de controle por toque e de layout rodam também na largura de 390 px.
- **Criar um jogo novo:** o `_modelo` já nasce com o README e o CLAUDE.md na estrutura do manual
  e com o esqueleto do gancho de testes e de uma suíte mínima.

## 3. Regras de Negócio e Restrições

### 3.1 Manuais (README e CLAUDE.md)

| # | Regra | Tipo |
|---|---|---|
| RN-01 | O README de cada um dos 7 jogos é o **manual completo**: Sumário, Início rápido, Controles (teclado, mouse, toque), Telas e fluxo de uma partida, Regras e mecânicas (com seções por tema), Pontuação/recorde, Opções do menu, Parâmetros (todos os números de `constants`/topo do motor, valor e efeito), Arquitetura, Como contribuir, Testes. Mesma ordem de seções do manual do Pastel de Feira, omitindo só o que não existe no jogo | Obrigatória |
| RN-02 | Toda regra ou mecânica do manual tem um **identificador** `<SIGLA>-RN-NN` no título da seção ou na linha da regra. Siglas: `CL` Cachorro Loko, `CV` Capacete Voador, `CS` Corredor SP, `FR` Fuga da Rocam, `PP` Pinball Paulista, `SB` Sinuca de Bar, `XP` Xadrez Paulistano, `HUB` hub. Os IDs `RN-NN` do Pastel continuam como estão | Obrigatória |
| RN-03 | O manual descreve o comportamento **real** do jogo. Comportamento que existe no código e não está no README (ex.: limites de campo, entradas inválidas, empates, perda de foco) é escrito no README antes de ser testado | Obrigatória |
| RN-04 | Divergência entre manual e código encontrada durante o trabalho: se o código está errado (bug), corrige o código; se o manual está desatualizado, corrige o manual. A decisão de qual lado vale, quando não for óbvia, é levada ao utilizador | Condicional |
| RN-05 | O README da Fuga da Rocam é reescrito inteiro a partir do código (mapas, controles, calor/estrelas, cotas, viaturas e personas, pedidos, itens, garagem, pontuação, parâmetros) | Obrigatória |
| RN-06 | O CLAUDE.md de cada jogo fica completo com as seções do `_modelo` (Mapa dos arquivos, Resolução, Sprites, Como o jogo funciona, Receitas, Armadilhas conhecidas, Como verificar) mais **Testes de ponta a ponta** (gancho, o que ele expõe, como rodar a suíte do jogo, como o piloto decide) | Obrigatória |
| RN-07 | O `_modelo` (README, CLAUDE.md) passa a ter a estrutura do manual e as seções de testes, para jogos novos nascerem no padrão | Obrigatória |
| RN-08 | A seção "Testes" do manual de cada jogo lista a cobertura por arquivo de teste (como a tabela "Cobertura" do Pastel) e a tabela regra → teste fica completa: nenhuma RN do manual sem teste | Obrigatória |

### 3.2 Base comum de testes

| # | Regra | Tipo |
|---|---|---|
| RN-10 | **Relógio controlado:** nos testes nada anda sozinho; o teste avança o jogo em quadros de duração fixa. Os tempos do jogo (poderes, nível, pausa, relógio do pedido) são medidos em quadros, sem depender da velocidade da máquina | Obrigatória |
| RN-11 | **Sorteio previsível:** todo sorteio do jogo (inclusive os feitos fora da página principal, como a busca da IA do Xadrez e da Sinuca, e sementes derivadas da hora, como na Fuga da Rocam) segue a semente do teste. Mesma semente + mesmos comandos = mesma partida | Obrigatória |
| RN-12 | **Evidências:** toda ação (clique, tecla, toque, segurar, arrastar) e todo marco (jogo aberto, início e fim de partida/rodada, fim do teste, falha) vira um PNG numerado na pasta do teste, com cabeçalho: teste, ação/marco, passo do fluxo, tela (rota, tela, diálogo, mensagem) e o estado próprio do jogo (ver 3.4). Mesmo layout, nomes de arquivo e níveis do Pastel | Obrigatória |
| RN-13 | Níveis de evidência `acoes` (padrão), `marcos`, `off`, por variável de ambiente genérica; `PF_EVIDENCIAS` continua aceita. A suíte longa usa `marcos` | Obrigatória |
| RN-14 | Uma evidência que falha ao gravar só gera aviso; nunca derruba o teste | Restritiva |
| RN-15 | **Comandos só pela tela:** o teste joga por toque, clique, arraste e teclado. O gancho de cada jogo serve para **ler** estado e **localizar alvos** (onde clicar). Escrita direta no estado só para preparar pré-condição rara, comentada no teste | Restritiva |
| RN-16 | O gancho de cada jogo só existe quando a página de teste o liga antes de carregar o jogo; para o jogador ele não existe, não muda desempenho visível nem entra no bundle de forma que altere o comportamento | Restritiva |
| RN-17 | O Pastel de Feira passa a usar a base comum sem perder teste, sem mudar resultado e com evidências equivalentes (mesmo cabeçalho e campos do dia) | Obrigatória |
| RN-18 | Os números esperados nos testes vêm das constantes e dados do próprio jogo, não de valores copiados à mão; o nome de cada teste cita a RN que prova | Obrigatória |
| RN-19 | Todo teste de jogo roda com som e música desligados por padrão e o armazenamento do navegador limpo, salvo quando o teste é sobre eles | Obrigatória |

### 3.3 Jogadores automáticos (piloto)

| # | Regra | Tipo |
|---|---|---|
| RN-20 | Cada um dos 7 jogos tem um piloto que joga **partidas inteiras** até o fim de jogo pela tela | Obrigatória |
| RN-21 | O piloto decide com o estado lido do gancho e executa cada decisão como gesto real; gesto sem alvo (clique que não acerta nada) é registrado e faz o teste falhar | Restritiva |
| RN-22 | Ao fim de cada partida do piloto, o teste confere: placar/resultado exibido = o calculado pelo jogo a partir dos eventos da partida; recorde salvo e mostrado no card do hub quando bateu; nenhum erro no console | Obrigatória |
| RN-23 | Cada partida do piloto grava semente, comandos e resultado num arquivo de diagnóstico na saída do teste | Obrigatória |
| RN-24 | Partidas do piloto, por jogo (mínimo): **Cachorro Loko** até perder as 3 vidas, passando pelo menos do nível 3; **Capacete Voador** partida completa em cada modo (2 jogadores com piloto nos dois lados, contra o computador em cada nível, treino); **Corredor SP** um turno até o fim das vidas em cada pista, passando pelo menos do nível 2; **Fuga da Rocam** até ser pego 3 vezes em cada mapa, chegando a pelo menos 3 estrelas; **Pinball Paulista** as 3 bolas até o fim de jogo; **Sinuca de Bar** partida completa em cada modalidade contra o computador e uma de 2 jogadores; **Xadrez Paulistano** partida até o resultado contra o computador em níveis baixo, médio e alto, e uma de 2 jogadores | Obrigatória |

### 3.4 Estado no cabeçalho da evidência, por jogo

| # | Jogo | Campos além de rota/tela/diálogo/mensagem | Tipo |
|---|---|---|---|
| RN-30 | Cachorro Loko | placar, vidas, nível, poderes ativos e tempo, posição do cachorro, pacotes nas esteiras, estado dos 3 desvios, pausa | Obrigatória |
| RN-31 | Capacete Voador | modo, rodada, placar, de quem é a vez, vento, ângulo/velocidade digitados, vida das motos, capacete em voo | Obrigatória |
| RN-32 | Corredor SP | pista, pontos, metros, multiplicador, vidas, nível, velocidade, faixa/corredor, grau, capacetes, invulnerável/caído | Obrigatória |
| RN-33 | Fuga da Rocam | mapa, pontos, vidas, estrelas/calor, pedido atual e tipo, itens, posição do jogador, viaturas | Obrigatória |
| RN-34 | Pinball Paulista | bola atual, placar, multiplicador, letras MOTOBOY, semáforos, bolas na mesa, segura-bola, tilt | Obrigatória |
| RN-35 | Sinuca de Bar | modalidade, vez, grupos, bolas na mesa, mira, força, bola na mão, falta da última tacada | Obrigatória |
| RN-36 | Xadrez Paulistano | modo, nível, vez, último lance, xeque, peça selecionada, cursor, IA pensando | Obrigatória |

### 3.5 Cobertura de regras por jogo

Cada linha vira uma ou mais RN no manual do jogo (RN-01/RN-02) e cada RN do manual tem teste (RN-08).
Lista mínima, a partir dos manuais atuais:

| # | Jogo | Temas que têm teste | Tipo |
|---|---|---|---|
| RN-40 | Cachorro Loko | título e início; andar (setas/A-D) e limites da rua; toque segurando lado esquerdo/direito; esteiras e sentido; desvio que troca a cada pacote (bomba conta) e aviso de 0,5 s; pega pelo baú/corpo; ponto por pacote; vida perdida por pacote na rua; bomba (vida, tontura 1 s, explode na rua sem dano, só após 15 entregas); cada poder (turbo, grau, ímã, vida até 5, dobro) e reinício do tempo ao repegar; nível a cada 10 entregas e curva de velocidade/intervalo; pausa (P, Esc, foco); fim de jogo e recorde | Obrigatória |
| RN-41 | Capacete Voador | menu e cada opção (modo, dificuldade, nomes até 14, pontos 1–10, gravidade e atalhos, garoa); campos ângulo 0–180 e velocidade 1–200, Enter e botão; entrada inválida; tiro para trás; vento; acerto na moto (3 estágios e destruição), na cabeça, na própria moto/cabeça; prédio (cratera), lateral, chão, sol; alternância de quem começa; cidade e vento novos por rodada; computador nos 3 níveis conforme a tabela; treino; fim de partida; som e sua persistência | Obrigatória |
| RN-42 | Corredor SP | tela de escolha (pista, cachorro, categoria, modelo, cor) e persistência da escolha; contagem e largada; acelerar, frear, faixa/corredor (teclado e botões de toque); pontuação pela fórmula; 3 vidas, queda de 2 s e 3 s de proteção; faixa azul e carga de grau por ultrapassagem; grau; capacete (até 3, o que derruba e o que quica); cada item e o limite; nível a cada 45 s; buraco acima/abaixo de 55%; cones; contramão e ambulância a partir do nível 2; garoa; pausa; som; fim de turno e recorde por pista | Obrigatória |
| RN-43 | Fuga da Rocam | título e mapas; direção até a próxima esquina (teclado e deslizar/direcional); turbo e óleo; pegar e entregar pedido; tipos de pedido (frágil sem turbo ×2, urgente com tempo e bônus, pesado lento ×3); estrelas sobem/descem e garagem; viaturas por estrela; captura e vidas; capacete como escudo; itens; pausa; fim de jogo e recorde por mapa | Obrigatória |
| RN-44 | Pinball Paulista | título; flippers (teclado e metades da tela); lançador com força proporcional ao tempo (fraco não sobe a rampa); sacudir e tilt; semáforos e Onda Verde; raias e multiplicador até ×5; letras MOTOBOY e Multiball; Minhocão (prêmios em ordem, bola extra só 1 vez, entupido 4 s); spinner; segura-bola 12 s; bônus de fim de bola × multiplicador; 3 bolas, fim de jogo e recorde; pausa | Obrigatória |
| RN-45 | Sinuca de Bar | menu (modalidade, adversário e nível, quem sai); mira por clique/arraste, botões e teclado (fino com Shift); força; tacada; saída atrás da linha de cabeceira; mesa aberta e definição de grupo; continuar/passar a vez; cada falta e bola na mão (arrastar e WASD); bola castigo na hora certa (vence) e cada forma de perder na hora; castigo na saída volta para a marca; computador nos 3 níveis; alternância da saída entre partidas | Obrigatória |
| RN-46 | Xadrez Paulistano | menu (modo, cor/sorteio, nível 1–100, nomes, girar sozinho) e persistência; lance por clique, por arraste (soltar fora volta) e por teclado (setas, Enter/Espaço, Esc); roque curto e longo e roque proibido por casa atacada; en passant; promoção com escolha; xeque e xeque-mate; afogamento, 50 lances, repetição tripla, material insuficiente; notação em português na lista de lances; Desfazer, Desistir e Nova partida com confirmação; Girar; Som; computador por faixa de nível | Obrigatória |
| RN-47 | Todos os 7 | perda de foco pausa (onde o manual diz); quadro com tempo negativo ou gigante não quebra o jogo; armazenamento bloqueado e recorde/config corrompidos não quebram o jogo; montagem dupla de desenvolvimento não duplica laço nem listeners; sair pelo "← Sampa Challenges" no meio da partida e voltar; 390 px sem rolagem lateral, toque mapeado, HUD legível | Obrigatória |

### 3.6 Hub

| # | Regra | Tipo |
|---|---|---|
| RN-50 | A home lista um card por jogo (8), na ordem do registro, com título, capa e recorde quando houver | Obrigatória |
| RN-51 | `#/jogos/<id>` abre o jogo; id inexistente ou fora do padrão mostra a resposta prevista do hub; voltar pelo navegador e pela barra "← Sampa Challenges" retorna à home | Obrigatória |
| RN-52 | Trocar de jogo desmonta o anterior: nenhum laço, som ou listener do jogo anterior continua | Obrigatória |
| RN-53 | Estilo não vaza: a home e cada jogo têm a mesma aparência antes e depois de abrir qualquer outro jogo | Obrigatória |
| RN-54 | Erro de carregamento ou de execução de um jogo cai no tratamento de erro do hub, sem tela branca | Obrigatória |
| RN-55 | Home e barra de volta em 390 px sem rolagem lateral | Obrigatória |

### 3.7 Entrega

| # | Regra | Tipo |
|---|---|---|
| RN-60 | Tudo num PR: base comum, migração do Pastel, ganchos, suítes e pilotos dos 7 jogos, hub, manuais e CLAUDE.md, `_modelo`, correções de bugs encontrados | Obrigatória |
| RN-61 | Bug de jogo encontrado pelos testes é corrigido no mesmo PR; se a correção muda regra, o manual muda junto; cada bug corrigido fica listado na descrição do PR (sintoma, causa, regra) | Obrigatória |
| RN-62 | O README da raiz do e2e (`e2e/README.md`) passa a cobrir todos os jogos e o hub (como rodar, base comum, evidências, cobertura por jogo) | Obrigatória |

## 4. Casos de Borda e Fluxos de Exceção (Zero Trust)

| Cenário | Comportamento Esperado | Severidade |
|---|---|---|
| IA roda fora da página principal (Xadrez, Sinuca) e não segue a semente | Teste falha por divergência entre duas execuções com a mesma semente; a IA tem que obedecer à semente nos testes (RN-11) | Crítica |
| Processo da IA falha ao iniciar | O jogo usa o caminho de reserva já existente; há teste que força a falha e confere que a partida continua | Alta |
| Resposta da IA chega atrasada (lance desfeito, nova partida) | Resposta antiga é descartada; há teste com Desfazer/Nova partida durante "pensando" | Alta |
| Física sensível ao passo (Pinball, Sinuca, Capacete) | Com relógio controlado o resultado é idêntico entre execuções; teste repetido 3 vezes dá o mesmo resultado | Alta |
| Máquina ociosa/suspensa (Chrome suspenso no macOS) | Suíte longa documenta o uso de `caffeinate`; tempos medidos em quadros não mudam o resultado | Média |
| Entrada inválida nos campos (Capacete: ângulo 181, velocidade 0, texto, vazio; nomes > 14) | Comportamento atual do jogo, escrito no manual (RN-03) e testado | Média |
| Armazenamento bloqueado (modo privado) | Jogo abre e joga; recorde/config não persistem; sem erro na tela | Alta |
| Recorde ou config corrompido no armazenamento | Jogo ignora o valor ruim e segue com o padrão | Alta |
| Primeiro quadro com tempo negativo ou aba voltando após muito tempo | Jogo não quebra nem pula estado de forma inválida (limite de quadro) | Alta |
| Piloto trava (partida não termina) | Teste falha por limite de quadros da partida, com evidência e arquivo de diagnóstico | Média |
| Gesto do piloto sem alvo | Falha do teste (RN-21), com a evidência do gesto | Média |
| Erro no console durante qualquer teste | Teste falha, com a mensagem no relatório | Alta |
| Evidência não consegue gravar (disco, página fechada) | Aviso no console; teste segue (RN-14) | Baixa |
| Migração do Pastel muda algum resultado | Bloqueia a entrega: a suíte do Pastel tem que passar inteira, com o mesmo número de testes | Crítica |

## 5. Critérios de Sucesso e SLAs

**Critérios Funcionais:**
- [ ] 7 READMEs no padrão de manual (RN-01) com todas as regras numeradas; README da Fuga da Rocam reescrito; 7 CLAUDE.md completos; `_modelo` atualizado.
- [ ] Tabela regra → teste completa em cada manual: 100% das RN de cada jogo e do hub com teste.
- [ ] Piloto de cada jogo cumpre RN-24 e RN-22.
- [ ] Suíte do Pastel passa inteira sobre a base comum (mesmo número de testes, campanha completa incluída).
- [ ] Todo teste grava evidências com o cabeçalho do jogo (RN-12, 3.4).
- [ ] `npm run typecheck`, `npm run typecheck:e2e` e `npm run build` sem erros.

**Tempos (máquina de desenvolvimento atual, evidências em `acoes`):**
- Suíte rápida (8 jogos + hub, desktop + celular): **≤ 10 min**.
- Suíte longa (pilotos dos 7 jogos, evidências em `marcos`): **≤ 30 min**. A campanha do Pastel continua no projeto próprio.

**Estabilidade:**
- [ ] Suíte rápida verde em 3 execuções seguidas, sem repetição automática de teste.
- [ ] Mesma semente → mesmo resultado em cada piloto (2 execuções comparadas pelo arquivo de diagnóstico).

## 6. Fora de Escopo

- Testes sem tela de regras puras (simulação em linha de comando) para os 7 jogos.
- Integração contínua (pipeline); a entrega roda local.
- Mudança de mecânica ou de equilíbrio que não seja correção de bug.
- Testes de som além de liga/desliga e persistência.
- Comparação de pixels contra imagens de referência.

## 7. Glossário

| Termo | Definição neste contexto |
|---|---|
| **Manual** | README do jogo: fonte única das regras numeradas |
| **RN** | Regra numerada do manual (`<SIGLA>-RN-NN`); o teste que a prova cita o número no nome |
| **Gancho** | Ponto de leitura de estado e de alvos que o jogo expõe só na página de teste |
| **Relógio controlado** | O jogo só avança quando o teste manda, em quadros de duração fixa |
| **Evidência** | PNG de uma ação ou marco, com cabeçalho descrevendo teste, ação e estado |
| **Marco** | Momento relevante sem ação do teste: jogo aberto, início/fim de partida, fim do teste, falha |
| **Piloto** | Jogador automático que decide pelo estado e age só por gestos de tela |
| **Suíte rápida / longa** | Testes de regras (a cada mudança) / partidas inteiras dos pilotos (antes de entregar) |
| **Base comum** | Relógio, semente, evidências e utilitários usados por todos os jogos |
