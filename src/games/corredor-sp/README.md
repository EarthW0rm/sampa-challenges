# Corredor SP

Enduro de motoboy em pixel art, com visão por trás da moto (pseudo-3D, como os jogos de corrida
dos anos 80/90). Não há linha de chegada: você costura o trânsito de uma avenida de São Paulo, pega
pacotes e tenta durar o máximo possível com 3 vidas.

Rota no hub: `#/jogos/corredor-sp`.

## Antes de correr

| Escolha | Opções |
|---|---|
| Pista | Av. 23 de Maio · Radial Leste · Av. das Nações Unidas |
| Cachorro (só visual) | vira-lata caramelo · pitbull · pincher · border collie |
| Categoria | CêGezinha 150cc (baú) · Hornetão 600cc (mochila térmica) · Tratorzão 1000cc (malas) |
| Modelo | 3 por categoria (tabela abaixo) |
| Cor | vermelho, azul, preto, branco, amarelo, verde (pinta a moto e o baú/top case) |

A última escolha fica salva no navegador.

### Modelos (`game/data.ts`)

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

"Direção" é a velocidade lateral máxima em meias-larguras de pista por segundo. Categorias maiores
são mais rápidas e por isso mais difíceis: o trânsito é o mesmo, mas chega mais rápido.

## Controles

| Teclado | Celular | Ação |
|---|---|---|
| ↑ / W | (automático) | acelerar |
| ↓ / S | FREIO | frear |
| ← → / A D | ◀ ▶ | mudar de faixa / entrar no corredor |
| Espaço (segurar) | GRAU | dar grau |
| X / Enter | CAPACETE | arremessar capacete |
| P / Esc | botão Pausar | pausa (pausa sozinho se a janela perde o foco) |
| — | botão Som | liga/desliga os efeitos sonoros (lembrado no navegador) |

### Sons

Sintetizados no navegador (WebAudio, sem arquivos), a partir do primeiro toque ou tecla: motor grave que sobe de tom
com a velocidade (um pouco mais alto no grau e no turbo, mais forte ao acelerar) e, na velocidade máxima,
faz o corte de giro ("br-br-br" do limitador de rotação), ronco ao sair para a terra,
chiado da garoa, sirene da ambulância que cresce ao se aproximar, bipes da contagem e da largada, sons
diferentes para cada item, arremesso e capacetada, buraco, cone, batida, sopro nas ultrapassagens
rentes, subida de nível e fanfarra de recorde (ou trombone triste) no fim do turno.

## Regras

- **Pontos = (segundos na pista + metros rodados ÷ 10) × (1 + pacotes).** Cada metro vale igual nas 3 categorias, então quem anda mais rápido roda mais e pontua mais (a 100 km/h são ~2,8 pontos/s de distância, a 235 km/h ~6,5, além de 1 ponto/s de tempo). 100 unidades de pista = 1 m (`UNITS_PER_METER`). O HUD mostra a distância em metros sob os pontos. Recorde separado por pista (recordes antigos, no cálculo só por tempo, ficam abaixo dos novos).
- **3 vidas.** Bateu: a moto cai, fica 2 s no chão e volta do zero (o cronômetro continua);
  depois, 3 s piscando sem tomar dano.
- **Corredor e faixa azul:** a pista tem 4 faixas e 3 corredores entre elas; o corredor da
  esquerda é a faixa azul (só de motos), mais larga que os outros: entre dois carros lado a lado
  sobra espaço para a moto passar com folga (0,35 de vão contra 0,25 nos outros corredores). Ultrapassar alguém andando num corredor carrega o grau;
  na faixa azul carrega mais.
- **Grau:** segurando, a moto empina: +20% de velocidade máxima, +30% de aceleração e direção pela
  metade. Gasta a barra enquanto durar.
- **Capacete:** guarda até 3. Arremessado, segue reto na linha da moto e tira da frente o primeiro
  carro, táxi, SUV, moto, motoboy na contramão ou cone. Ônibus, caminhões e ambulâncias são grandes
  demais (o capacete quica). Com 3 guardados o item continua aparecendo e pode ser pego, mas não
  muda nada.
- **Nível:** sobe a cada 45 s: mais veículos, trânsito mais rápido, mais fechadas sem seta, mais
  buracos, cones, contramãos e ambulâncias.
- **Dia e noite:** ciclo de 4 min (tarde → pôr do sol → noite → madrugada → manhã). À noite aparecem
  lanternas, postes acesos e o farol da moto.
- **Garoa:** de vez em quando; a direção responde mais devagar e o freio rende 25% menos.

### Itens

| Item | Efeito |
|---|---|
| Pacote | +1 no multiplicador de pontos |
| Capacete | +1 capacete (até 3) |
| Grau | +50% na barra |
| Velocidade | velocidade máxima +15% por 8 s |
| Vida | +1 coração (até 5; se já tiver 5, vira pacote) |

Sorteio: pacote 55%, capacete 15%, grau 15%, velocidade 10%, vida 5%; um item a cada 1,8–3,2 s.

### Trânsito e perigos

| Quem | Comportamento |
|---|---|
| Carros, táxis, SUVs | mantêm a faixa e seguem o da frente; para trocar dão seta antes (2,2 s − km/h ÷ 70, entre 0,6 e 2 s) |
| Fechada sem seta | parte das trocas é sem seta, mais comum perto do jogador e a cada nível |
| Motos | andam nos corredores (de preferência na faixa azul) e nas faixas, mais rápidas que os carros |
| Caminhões | só nas duas faixas da direita, lentos, seta mais longa e troca mais devagar |
| Ônibus | só na faixa da direita; param no ponto com pisca-alerta |
| Ambulância (nível 2+) | vem por trás a 150 km/h com aviso; os carros da frente abrem passagem |
| Contramão (nível 2+) | motoboy vindo de frente pelo corredor, com aviso |
| Buraco | acima de 55% da velocidade máxima derruba; abaixo, faz a moto balançar e perder velocidade |
| Cones | grupos de 3 numa faixa; tiram 30% da velocidade |

Peso de cada tipo de veículo no sorteio, por pista:

| Pista | carro | táxi | SUV | moto | ônibus | caminhão |
|---|---|---|---|---|---|---|
| 23 de Maio | 50 | 8 | 12 | 18 | 6 | 6 |
| Radial Leste | 40 | 6 | 10 | 16 | 14 | 14 |
| Nações Unidas | 46 | 6 | 16 | 18 | 6 | 8 |

## Parâmetros principais

Em `game/constants.ts` (e no topo de `game/engine.ts` / `game/traffic.ts` quando indicado).

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W × H` | 640 × 400 | resolução interna (o HUD é desenhado em 320×200 e ampliado 2×) |
| `SEG_LEN` | 200 | comprimento de um segmento de pista |
| `ROAD_W` | 1000 | meia largura da pista (x normalizado −1…+1) |
| `CAM_H`, `FOV` | 1150, 100° | altura e abertura da câmera |
| `DRAW_DIST` | 210 segmentos | quanto se vê à frente (42 000 unidades) |
| `FOG_START` | 0,72 | a partir desta fração da distância, pista e objetos entram na névoa (até 85%) |
| `MIN_OBJ_W` | 8 px | largura mínima de veículos (itens 80%, perigos 70%) lá longe |
| `KMH` | 100 / 3,6 | conversão km/h → unidades/s (1 m = 100 unidades) |
| `SPRITE_UNITS` | 6,25 | unidades por pixel de sprite (tamanho nativo na altura do jogador) |
| `PLAYER_DRAW_SCALE` | 1,5 | o jogador é desenhado 50% maior |
| `CENTRIFUGAL` | 0,03 | quanto a curva empurra para fora (leve: uma faixa em ~5 s na curva mais forte) |
| `LANES` / `CORRIDORS` | −0,85, −0,25, 0,25, 0,75 / −0,55, 0, +0,5 | faixas e corredores; −0,55 é a faixa azul |
| `BLUE_HALF` | 0,075 | meia largura da pintura azul |
| `CORRIDOR_TOL` | 0,1 | distância do centro do corredor que conta como "no corredor" |
| `PLAYER_HALF_W` | 0,05 | meia largura de colisão da moto |
| colisão dos veículos (`traffic.ts`) | 72% da largura desenhada | folga para passar no corredor |
| `OFFROAD_SPEED` | 0,35 | fora do asfalto, fração da velocidade máxima |
| `START_LIVES` / `MAX_LIVES` | 3 / 5 | vidas |
| `MAX_HELMETS` | 3 | capacetes guardados |
| `CRASH_TIME` / `INVULNERABLE_TIME` | 2 s / 3 s | tempo caído / proteção ao voltar |
| `GRAU_START` / `GRAU_DRAIN` | 0,3 / 0,22 por s | barra inicial / gasto |
| `GRAU_SPEED` / `GRAU_ACCEL` / `GRAU_STEER` | 1,2 / 1,3 / 0,5 | efeito do grau |
| `GRAU_CHARGE_CORRIDOR` / `GRAU_CHARGE_BLUE` | 0,08 / 0,14 | recarga por ultrapassagem |
| `GRAU_ITEM`, `SPEED_ITEM_FACTOR`, `SPEED_ITEM_TIME` | 0,5 / 1,15 / 8 s | itens |
| `HELMET_SPEED` / `HELMET_RANGE` | +6000 u/s / 14000 | capacete arremessado |
| `LEVEL_TIME` | 45 s | duração de um nível |
| `DAY_CYCLE` | 240 s | ciclo dia/noite |
| `SPAWN_AHEAD_MIN/MAX` | 22000–36000 | onde o trânsito novo aparece (itens, buracos e cones aparecem no mínimo) |
| veículos à frente (`engine.ts`) | (6 + 3 × nível) × 1,3 (máx. 42) | densidade |
| velocidade do trânsito (`engine.ts`) | × (1 + 0,06 × (nível − 1)), máx. 1,6 | aceleração do trânsito por nível |
| chance de fechada sem seta (`engine.ts`) | 8% + 5% por nível (máx. 50%) | perigo |
| intervalo de buracos / cones (`engine.ts`) | máx(3, 9 − nível) / máx(5, 14 − nível) s | perigo |
| contramão / ambulância (`engine.ts`) | máx(14, 40 − 4·nível) / máx(30, 70 − 5·nível) s | a partir do nível 2 |

Em testes com um piloto automático simples (que não pega itens), as partidas duraram de 20 s a 1 min
e 40 s (igual antes e depois da versão 640×400). Ainda falta testar com pessoas jogando para calibrar a dificuldade.

## Visual em alta (640×400)

O jogo era desenhado em 320×200 e a visão de longe era ruim: um carro a 20 m virava 2 ou 3 pixels.
Agora:

- **Resolução dobrada (640×400).** A pista, as faixas e o horizonte têm o dobro de linhas.
- **Sprites com o dobro de detalhe.** Os cachorros motoboys vêm da biblioteca única de sprites
  (`src/shared/sprites`, desenhados em 2× nativo por `tools/pixelart/biblioteca/caes_costas.py`) e
  entram como estão. Os demais PNGs continuam em 1× e `game/hires.ts` aplica o Scale2x, que
  arredonda curvas e diagonais sem criar cores novas.
- **Mipmaps.** Para longe, cada sprite tem versões reduzidas com média de cor, então o carro
  distante vira uma silhueta estável em vez de pixels que piscam.
- **Leitura de longe:** câmera mais alta, distância de desenho 40% maior, tamanho mínimo para
  veículos e itens, lanternas sempre marcadas em quem está longe (de dia também) e faróis que
  atravessam a névoa à noite.
- **Névoa no fim da pista.** Quem surge lá no fundo aparece aos poucos, em vez de "pipocar".

## Rodando só este jogo

Ele roda dentro do hub: `npm run dev` na raiz e abra `#/jogos/corredor-sp`.
