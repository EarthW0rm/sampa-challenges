# Sampa Challenges

Hub de jogos em pixel art com tema de São Paulo. Um único site estático (React 18 + TypeScript +
Vite 5) em que cada jogo vive na própria pasta, com código, estilos e imagens próprios. O hub
descobre os jogos sozinho; para adicionar um, basta criar a pasta.

| Jogo | Pasta | Resumo |
|---|---|---|
| **Capacete Voador** | `src/games/capacete-voador` | O Gorillas do QBasic com dois cachorros motoboys arremessando capacetes por cima de prédios de SP. 2 jogadores, contra o computador (3 dificuldades) ou treino. |
| **Cachorro Loko** | `src/games/cachorro-loko` | Arcade de esteiras: o vira-lata motoboy pega os pedidos do LOKO DOG antes que caiam na rua. Poderes, bombas e recorde. |
| **Corredor SP** | `src/games/corredor-sp` | Enduro pseudo-3D na 23 de Maio, Radial Leste e Nações Unidas: costure o trânsito pelo corredor, dê grau, arremesse capacetes e pegue pacotes. |
| **Pinball Paulista** | `src/games/pinball-paulista` | Mesa de pinball vertical na Avenida Paulista: bumpers-semáforo, Minhocão que prende a bola, letras MOTOBOY, multiball, tilt e recorde. |

Cada jogo tem um `README.md` (como jogar, regras, parâmetros) e um `CLAUDE.md` (guia técnico para
quem for mexer no código, pessoa ou IA).

## Rodando

```bash
npm install
npm run dev          # http://localhost:5173  (no celular, mesma rede: npm run dev -- --host)
npm run typecheck    # TypeScript em modo estrito
npm run build        # checa os tipos e gera o site estático em dist/
npm run preview      # serve o dist/ localmente
```

Precisa de Node 18 ou mais novo. As fontes (Press Start 2P e IBM Plex Mono) vêm do Google Fonts;
sem internet o site cai para fontes monoespaçadas do sistema.

## Publicando

`npm run build` gera `dist/` com caminhos relativos (`base: './'` no `vite.config.ts`) e rotas por
hash (`#/jogos/<id>`), então funciona em qualquer hospedagem estática (GitHub Pages, Netlify,
Vercel, S3, uma pasta qualquer) sem configurar redirecionamentos.

O repositório segue o GitHub Flow: a `main` é protegida e só recebe pull request com o check
`build` (workflow `CI`: `npm ci` + `npm run build`) passando, e o título do PR precisa ser um
Conventional Commit (`feat: …`, `fix: …`; workflow `pr-title`), porque no squash merge ele vira
o commit da `main`.

A versão e a publicação no GitHub Pages (<https://earthw0rm.github.io/sampa-challenges/>) são
automáticas, pelo workflow `release-please`:

1. Cada merge na `main` abre ou atualiza o Release PR (`chore(main): release X.Y.Z`), com a
   versão do `package.json` e o `CHANGELOG.md` calculados pelos commits (`feat` = minor,
   `fix` = patch, `!`/`BREAKING CHANGE` = major).
2. O merge do Release PR cria a tag `vX.Y.Z` e o GitHub Release, e publica no Pages.

Para republicar a `main` sem versão nova: Actions → `release-please` → Run workflow.

## Como está organizado

```
index.html                 fontes, favicon e o <div id="root">
public/favicon.png
src/
  main.tsx                 monta o React e o CSS do hub
  App.tsx                  escolhe entre a home e um jogo pela rota
  vite-env.d.ts            tipos do Vite (import.meta.glob, import de .png)
  hub/
    types.ts               GameManifest e GameProps: o contrato de um jogo
    registry.ts            encontra todo src/games/<pasta>/manifest.ts (menos pastas com "_")
    useHashRoute.ts        rotas #/ e #/jogos/<id>
    HubHome.tsx            página inicial com os cards
    GameHost.tsx           barra "← Sampa Challenges", carregamento sob demanda, erro e 404
    hub.css                estilos globais e do hub
  games/
    capacete-voador/       um jogo (veja o README.md dele)
    cachorro-loko/         outro jogo
    corredor-sp/           o enduro (pseudo-3D)
    _modelo/               modelo usado por `npm run novo-jogo` (fica fora do hub)
scripts/novo-jogo.mjs      cria um jogo a partir do _modelo
tools/pixelart/            scripts Python que desenharam os sprites (veja abaixo)
```

### O contrato de um jogo

Cada pasta `src/games/<id>/` precisa de:

| Arquivo | Papel |
|---|---|
| `manifest.ts` | `export default` um `GameManifest`: `id` (igual ao nome da pasta), `title`, `description`, `cover` (PNG importado), `tags`, `accent` (cor do card), `order` (opcional), `getRecord` (opcional) e `load: () => import('./Game')`. |
| `Game.tsx` | `export default` do componente raiz. Recebe `{ onExit }` (volta para o hub). O `<div>` raiz tem `className="<id>"`. |
| `styles.css` | Todos os seletores prefixados com `.<id>`, para não vazar para o hub nem para outros jogos. |
| `assets/` | As imagens do jogo. |
| `README.md`, `CLAUDE.md` | Documentação do jogo. |

O `manifest.ts` é carregado junto com o hub (é ele que monta o card); o resto do jogo só baixa
quando alguém abre a rota dele. Por isso o manifest deve importar só a capa e, se houver, a função
de recorde.

## Adicionando um jogo

```bash
npm run novo-jogo -- metro-lotado "Metrô Lotado"
```

Cria `src/games/metro-lotado/` a partir do `_modelo`: um canvas 640×400 (o padrão do hub, com
lógica em 320×200 e sprites em alta) com um quadrado que anda com as setas, já com `README.md` e
`CLAUDE.md` para preencher. O jogo aparece no hub na hora.
Depois: troque `assets/capa.png`, preencha o `manifest.ts` e escreva o jogo a partir do `Game.tsx`.

Para tirar um jogo do hub, apague a pasta ou renomeie para começar com `_`.

## Convenções

- **Textos da interface em português do Brasil.** Código e nomes de arquivos podem ser em
  português ou inglês, mas siga o que o jogo já usa.
- **Pixel art em 640×400.** Os sprites da biblioteca compartilhada (`src/shared/sprites`: cachorros,
  caixas, itens, efeitos) já são desenhados em alta definição (2× nativo); os demais (cenário,
  trânsito, prédios) são 1× e ganham o dobro de detalhe com o Scale2x ao carregar (`game/hires.ts`
  de cada jogo). O Cachorro Loko mantém a lógica em 320×200 e desenha com `ctx.setTransform(2, …)`;
  Capacete Voador e Corredor SP trabalham em 640×400; o Pinball Paulista é vertical (lógica em 240×400, canvas 480×800).
  O canvas é ampliado pelo CSS com
  `image-rendering: pixelated` e `ctx.imageSmoothingEnabled = false`. Coordenadas e tamanhos de
  sprites são sempre em pixels lógicos (PNG da biblioteca ÷ 2; demais PNGs em 1×).
- **Paleta comum** (fim de tarde paulistano): fundo `#16121f`, painéis `#221b30`/`#2e2540`, texto
  `#f4efe2`, texto secundário `#c9c0d8`, destaque `#f5b860` e `#ffd36b`, contorno dos sprites `#1b1220`.
- **`localStorage` com prefixo do jogo** (ex.: `cachorro-loko:recorde`) e sempre dentro de
  `try/catch`.
- **Sem dependências novas** além de React sem necessidade clara: os jogos usam só canvas 2D.
- **Acessibilidade básica**: botões de verdade, alvos de toque com 44 px, foco visível, `alt` nas
  imagens, `aria-label` no canvas.

## Sprites (`tools/pixelart/`)

Os PNGs foram desenhados por código (Python + Pillow), pixel a pixel:

| Script | Gera |
|---|---|
| `cenario_predios.py` | céu, garoa, prédios modulares de SP, sol, vento, explosões (Capacete Voador) |
| `biblioteca/` (`python3 -m biblioteca.gerar <pasta>`) | **biblioteca única** em HD 2×: cachorros de lado (`caes_lado.py`) e de trás (`caes_costas.py`), caixas/itens/capacetes/HUD (`itens.py`) e efeitos (`fx.py`); saída em `src/shared/sprites/assets/` |
| `motoboys.py` | versão antiga em 1× dos cachorros do Capacete Voador (substituída pela biblioteca) |
| `cachorro_loko.py` | esteiras, restaurante, chapeiro e fundo do Cachorro Loko (os cachorros, caixas e efeitos antigos em 1× foram substituídos pela biblioteca) |
| `pinball_paulista.py` | fundo da mesa (240×400), bumpers-semáforo e capa do Pinball Paulista |
| `corredor_sp.py` | trânsito, cenário das avenidas e horizontes do Corredor SP (motos e itens antigos em 1× foram substituídos pela biblioteca) |

```bash
pip install pillow
cd tools/pixelart && python3 -m biblioteca.gerar ../../src/shared/sprites/assets
```

Os scripts antigos gravam numa pasta de saída; copie para `src/games/<id>/assets/` só o que mudou.
A biblioteca grava direto em `src/shared/sprites/assets/` (veja o `README.md` de lá). Se mudar o
desenho dos cachorros, confira as áreas de acerto em `capacete-voador/game/constants.ts`.

## Verificação

Ainda não há testes automatizados. Antes de entregar uma mudança:

1. `npm run typecheck` sem erros;
2. `npm run build` sem erros;
3. abrir o hub, entrar em cada jogo alterado, jogar uma partida curta, voltar para o hub e conferir
   que o visual do hub e dos outros jogos não mudou;
4. testar em largura de celular (≈390 px).
