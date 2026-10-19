# Biblioteca de sprites (`src/shared/sprites`)

Os personagens, itens e efeitos que aparecem em mais de um jogo moram aqui, desenhados uma vez só,
para os jogos terem o mesmo visual e a mesma qualidade.

**Estilo: 16 bits em alta definição.** O desenho é o pixel art 1× original (formas chunky, poucas
cores, contorno escuro), ampliado com Scale2x para o dobro de pixels, com cantos e diagonais
suaves. O desenho 1× fica em `tools/pixelart/biblioteca/fonte16/`; para mudar um sprite, edite lá e
regere. Não acrescente detalhes de "alta resolução" (sombras degradê, raios finos): o visual tem que
ser o mesmo nos três jogos.

## Regras

- **Resolução nativa 2×:** 1 pixel lógico do jogo = 2×2 pixels do PNG. Um cachorro que ocupa
  40×40 unidades lógicas é um PNG de 80×80. Esses PNGs **não passam pelo Scale2x**: o jogo desenha
  como estão, no tamanho `largura / LIB_SCALE` (veja `isNativeHd` no `game/assets.ts` e o `upscaleAll`
  do `game/hires.ts` de cada jogo).
- **Não edite os PNGs à mão.** Eles são gerados por `tools/pixelart/biblioteca/` (Python + Pillow, ampliando o desenho de `fonte16/`):

  ```bash
  cd tools/pixelart && python3 -m biblioteca.gerar ../../src/shared/sprites/assets
  ```

- **Carregar:** `loadLibrary(['caes', 'itens'])` devolve `{ 'lib/caes/p1_normal_0': HTMLImageElement, … }`
  (só as pastas pedidas; sem argumento, tudo). Cada jogo cria apelidos para as chaves que o motor
  já usa (ex.: `cachorro_0` → `lib/caes/p1_normal_0`) e marca-os em `isNativeHd`.
- **Sprite novo compartilhado:** crie em `tools/pixelart/biblioteca/<módulo>.py` (use `prim.py` e
  `paleta.py`), gere, e documente a chave aqui. Sprites que só um jogo usa (cenário, trânsito,
  prédios, fundos) continuam na pasta `assets/` do jogo, em 1× com Scale2x.

## Conteúdo

| Pasta | Chaves (`lib/<pasta>/<nome>`) | Tamanho PNG | Quem usa |
|---|---|---|---|
| `caes` | `p1_*` (caramelo, moto azul, baú vermelho) e `p2_*` (branquinho, moto verde, baú amarelo): `dano{0,1,2}`, `dano{0,1,2}_{arremesso,ko,grau}`, `destruida`, `destruida_ko`; só o `p1` tem também `normal_0/1`, `turbo_0/1`, `grau_0/1`, `tonto` | 80×80 | Cachorro Loko (`p1_normal/turbo/grau/tonto`), Capacete Voador (`dano*`, `destruida*`) |
| `caes_costas` | `<raça>_<150\|600\|1000>_<reto\|esq\|dir\|grau\|queda>` com raça = caramelo, pitbull, pincher, collie; cores-chave magenta (`#ff00ff`, `#b000b0`, `#ff9cff`) trocadas pelo jogo | 80×88 (queda 96×88) | Corredor SP |
| `itens` | `caixa_{caixa,turbo,grau,ima,vida,dobro}`, `pizza`, `sacola`, `bomba_{0,1}` | 24×24 | Cachorro Loko |
| `itens` | `pickup_{capacete,pacote,vida,velocidade,grau}` | 32×32 | Corredor SP |
| `capacete` | `p1_{0..3}`, `p2_{0..3}` (4 rotações; cor do boné de cada jogador) | 16×16 | Capacete Voador, Corredor SP |
| `hud` | `coracao_cheio`, `coracao_vazio` | 14×12 | Cachorro Loko, Corredor SP |
| `fx` | `explosao_{0,1,2}` (48×48), `brilho_{0,1,2}` (24×24), `poeira_{0,1,2}` (24×16), `caixa_amassada` (28×12) | — | Cachorro Loko (todos), Capacete Voador (`explosao`) |

Hitboxes e posições dos jogos continuam em unidades lógicas (PNG ÷ 2). Se mudar o desenho de um
cachorro, confira `PILOT_BOX`/`MOTO_BOX` (Capacete Voador) e `CATCH_RECT` (Cachorro Loko).
