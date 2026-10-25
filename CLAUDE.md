# CLAUDE.md — Sampa Challenges

Guia para agentes de IA (e pessoas) que forem trabalhar neste repositório. Leia este arquivo e
depois o `CLAUDE.md` do jogo que for alterar (`src/games/<id>/CLAUDE.md`).

## O que é

Hub de jogos em pixel art com tema de São Paulo. Site estático, React 18 + TypeScript (strict) +
Vite 5, sem backend, sem roteador externo, sem biblioteca de jogo: cada jogo desenha num
`<canvas>` 2D e usa React só para menus e HUD.

## Comandos

```bash
npm install
npm run dev         # servidor de desenvolvimento
npm run typecheck   # tsc --noEmit (strict, noUnusedLocals, noUnusedParameters)
npm run build       # typecheck + vite build -> dist/
npm run novo-jogo -- <id> "<Título>"   # cria src/games/<id>/ a partir do _modelo
npm run test:e2e    # testes de ponta a ponta no navegador (Playwright, e2e/), suíte rápida
npm run test:e2e:campanha   # campanha inteira do Pastel de Feira pela tela (~10 min; no macOS use caffeinate -dimsu)
npm run typecheck:e2e
```

Sempre rode `npm run typecheck` depois de mudar código. Os testes de ponta a ponta ficam em `e2e/`
(hoje só o Pastel de Feira; veja `e2e/README.md`).

## Arquitetura do hub (`src/hub/`)

- `registry.ts` usa `import.meta.glob(['../games/*/manifest.ts', '!../games/_*/manifest.ts'], { eager: true })`.
  Não existe lista de jogos para editar: criar ou apagar a pasta basta. O nome da pasta prevalece
  sobre `manifest.id` (com aviso no console se forem diferentes).
- `types.ts` define `GameManifest` e `GameProps`. Mudar esse contrato afeta todos os jogos e o
  `_modelo`: atualize os três.
- `useHashRoute.ts`: rotas `#/` e `#/jogos/<id>` (`<id>` = `[a-z0-9-]+`). Não troque por
  history API sem mudar o `base: './'` e a hospedagem.
- `GameHost.tsx`: guarda um `React.lazy` por jogo num `Map` (criar o lazy a cada render remonta o
  jogo), envolve o jogo num error boundary e mostra a barra de volta. Passa `onExit` ao jogo.
- `App.tsx` renderiza `<GameHost key={id}>`, então trocar de jogo desmonta tudo do anterior.

## Regras para mexer em jogos

1. **Isolamento de CSS.** Todo seletor em `src/games/<id>/styles.css` começa com `.<id>`. Nada de
   `:root`, `html`, `body` ou seletores de elemento soltos ali. Animações `@keyframes` com prefixo
   (`<id>-nome`). Estilo global só em `src/hub/hub.css`.
2. **Assets dentro da pasta do jogo.** Carregue com
   `import.meta.glob<string>('../assets/**/*.png', { eager: true, query: '?url', import: 'default' })`
   ou `import url from './assets/x.png'`. Nunca use caminhos soltos como `"assets/x.png"` ou a
   pasta `public/` (quebra com hash de build e com `base: './'`).
3. **O manifest é leve.** Ele entra no bundle principal; importe ali só a capa e funções pequenas
   (ex.: `loadRecord`). O jogo em si vem por `load: () => import('./Game')`.
4. **Listeners globais** (`keydown`, `blur`, `resize`) são registrados em `useEffect` e removidos
   no cleanup. O `requestAnimationFrame` também é cancelado no cleanup.
5. **StrictMode está ligado:** efeitos rodam duas vezes em desenvolvimento. Motores de jogo devem
   ser criados dentro do `useEffect` e descartados no cleanup.
6. **Tempo de quadro:** o primeiro `dt` do `requestAnimationFrame` pode ser negativo. Limite com
   `Math.max(0, Math.min(dt, máximo))` (já houve um bug real de índice de animação negativo).
7. **Resolução e sprites:** os jogos desenham num canvas de 640×400 com sprites em alta (Scale2x de
   `game/hires.ts`). O Cachorro Loko, o Xadrez Paulistano e a Sinuca de Bar têm lógica em 320×200 e o Capacete Voador em 640×400 (o Pinball Paulista é vertical: 240×400 lógico, canvas 480×800); todos
   usam `setTransform(SCALE, …)` + `blit()` no `render()`; leia a seção "Visual em alta" do `CLAUDE.md` do jogo antes
   de desenhar algo novo. O `_modelo` já nasce nesse padrão (seção "Resolução" do `CLAUDE.md` dele).
   **Exceção: o Pastel de Feira** tem lógica em 640×480 e canvas de 1280×960 (`SCALE` = 2), porque a barraca cheia e o
   painel retrátil não cabem em 320×200 (seção "Visual em alta e resolução" do `CLAUDE.md` dele).
8. **Pixel art:** desenhe em coordenadas inteiras (`Math.round`) e mantenha
   `imageSmoothingEnabled = false`. Para espelhar um sprite, use `ctx.translate` + `ctx.scale(-1, 1)`.
9. **Texto da interface em pt-BR**, curto e direto.
10. **`localStorage`** com chave `<id>:<nome>` e sempre em `try/catch`.

## Onde ficam os parâmetros

Cada jogo concentra os números de equilíbrio em `game/constants.ts` e nas primeiras linhas de
`game/engine.ts`. Os `CLAUDE.md` dos jogos listam cada parâmetro, o valor atual e o efeito.
Mudou um número? Atualize a tabela no README/CLAUDE.md do jogo.

## Sprites

**Biblioteca única:** personagens (cachorros de lado e de trás), caixas/itens, capacetes, HUD e
efeitos compartilhados ficam em `src/shared/sprites/` (pixel art 16 bits em alta definição, 2× nativo, gerado por
`tools/pixelart/biblioteca/` a partir do desenho 1× de `fonte16/`). Antes de desenhar um sprite novo que possa servir a mais de um jogo,
veja o `README.md` de lá e acrescente na biblioteca em vez de criar uma cópia no jogo. Cenário,
trânsito, prédios e fundos específicos de um jogo continuam em `src/games/<id>/assets/`.
Sprite próprio de um jogo que precisa de detalhe em pixel de tela (ex.: as bolas numeradas da
Sinuca de Bar) pode ser gerado já em 2× nativo; marque-o em `isNativeHd` do `game/assets.ts` para o
`upscaleAll` copiar em vez de aplicar Scale2x.

Os demais PNGs foram gerados pelos scripts de `tools/pixelart/` (Python + Pillow). Para mudar um
sprite, prefira editar o script e gerar de novo (assim as variações ficam consistentes) a editar o
PNG à mão. Depois, copie só os arquivos usados para `src/games/<id>/assets/`. Se o desenho mudar de
tamanho ou posição, confira as áreas de colisão/acerto nas constantes do jogo.

## Criando um jogo novo

1. `npm run novo-jogo -- <id> "<Título>"`.
2. Preencha `manifest.ts` (descrição, tags, cor) e troque `assets/capa.png` (320×200).
3. Escreva o jogo a partir de `Game.tsx`. Estrutura recomendada (igual aos jogos atuais):
   `game/` para lógica pura em TypeScript (motor, física, IA, constantes), `components/` para
   React (menus, HUD), lógica em 320×200 e canvas em 640×400 (`game/hires.ts`, já no modelo)
   ampliado por CSS.
4. Preencha o `README.md` e o `CLAUDE.md` do jogo (o modelo traz as seções).
5. `npm run typecheck`, `npm run build`, teste no navegador e no celular.

## IA e workers

Jogos com IA pesada (Xadrez Paulistano, Sinuca de Bar) rodam a busca num Web Worker criado com
`new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' })` (nunca caminho em
string), descartam respostas com `id` antigo e caem para a thread principal se o worker falhar.
Regras, física e IA ficam em TypeScript puro para poderem ser testadas com esbuild + node.

## Checklist antes de entregar

- [ ] `npm run typecheck` e `npm run build` sem erros.
- [ ] Hub abre, o card do jogo aparece, o jogo carrega, a barra "← Sampa Challenges" volta.
- [ ] Nenhum estilo vazou (a home e os outros jogos continuam iguais).
- [ ] Testado em ≈390 px de largura.
- [ ] README/CLAUDE.md do jogo atualizados se regras ou parâmetros mudaram.
