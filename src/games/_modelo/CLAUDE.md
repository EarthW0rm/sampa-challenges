# CLAUDE.md — __TITULO__

Leia antes o `CLAUDE.md` da raiz (regras do hub: CSS escopado em `.__ID__`, assets dentro desta
pasta, manifest leve). Regras e parâmetros ficam no `README.md` desta pasta.

## Mapa dos arquivos

| Arquivo | Papel |
|---|---|
| `manifest.ts` | card no hub (título, descrição, capa, tags, cor) |
| `Game.tsx` | componente raiz (`export default`); recebe `onExit` para voltar ao hub |
| `styles.css` | estilos, todos prefixados com `.__ID__` |
| `assets/` | imagens do jogo em 1× (`capa.png` é a capa do card, 320×200) |
| `game/constants.ts` | `W`, `H` (grade lógica 320×200) e os números do jogo |
| `game/hires.ts` | padrão de resolução: `SCALE` = 2, `scale2x`, `upscaleAll`, `blit`, `blitPart` |
| `game/e2eHook.ts` | gancho dos testes de ponta a ponta (`window.__e2e`), inerte sem a flag da página de teste |

Estrutura recomendada quando o jogo crescer (igual aos outros jogos do hub):

- `game/constants.ts`: todos os números de equilíbrio;
- `game/engine.ts`: motor em TypeScript puro com `update(dt)`, `render(ctx)` e um callback para o HUD;
- `game/assets.ts`: lista de PNGs carregados com `import.meta.glob`;
- `components/`: telas em React (título, jogo, HUD).

## Resolução (padrão do hub)

Todos os jogos do hub mostram **640×400**. Este modelo já vem assim:

- **Lógica em 320×200** (`W`, `H` em `game/constants.ts`): posições, colisões, tamanhos e
  velocidades ficam nessa grade. Os PNGs são desenhados em 1× nessa escala.
- **Canvas em 640×400** (`width={W * SCALE}`): o `render` começa com
  `ctx.setTransform(SCALE, 0, 0, SCALE, 0, 0)` e `imageSmoothingEnabled = false`.
- **Sprites em alta:** passe cada imagem uma vez por `scale2x` (ou o conjunto todo por
  `upscaleAll`, que tem cache) e desenhe com `blit(ctx, img, x, y)`; recortes com `blitPart`.
  **Nunca** `ctx.drawImage(spriteEmAlta, x, y)` sem tamanho: sai com o dobro do tamanho.
- **Movimento suave:** quem se move pode usar meio pixel lógico,
  `Math.round(x * SCALE) / SCALE` (vira 1 pixel de tela).
- `fillRect` e fontes de pixel continuam em coordenadas lógicas (saem com 2×2 px de tela).
- O CSS amplia o canvas com `image-rendering: pixelated` e `aspect-ratio: 320 / 200`.

## Sprites compartilhados

Personagens, caixas/itens, capacetes, HUD e efeitos já existem na **biblioteca única**
(`src/shared/sprites`, HD 2× nativo; leia o `README.md` de lá). Para usar: carregue com
`loadLibrary(['caes', 'itens', …])` (importe de `../../shared/sprites`), guarde os apelidos que o
motor usa e faça o `upscaleAll` do jogo **copiar** em vez de aplicar `scale2x` nessas chaves (veja
`isNativeHd` no `game/assets.ts` do `cachorro-loko`). Desenhe com `blit()`: o tamanho lógico é
`largura do PNG / 2`. Só crie PNG próprio para o que é exclusivo do jogo.

Exemplos completos: `cachorro-loko` e `capacete-voador` (mesmo padrão) e `corredor-sp` (que
trabalha direto em 640×400 por ser pseudo-3D).

## Como o jogo funciona

Descreva o laço principal, os estados (menu, jogando, pausa, fim) e qualquer regra que não seja
óbvia lendo o código.

## Receitas

- Como mudar a dificuldade.
- Como adicionar um elemento novo (inimigo, item, fase).

## Armadilhas conhecidas

- Limite o `dt` do `requestAnimationFrame` a `Math.max(0, Math.min(dt, 0.05))`.
- Crie o motor dentro do `useEffect` e descarte no cleanup (StrictMode roda duas vezes).
- Sprite desenhado com o dobro do tamanho = `drawImage` direto num sprite em alta; use `blit`.

## Como verificar

1. `npm run typecheck` e `npm run typecheck:e2e` na raiz.
2. `npm run test:e2e -- __ID__/` (e `--project=celular __ID__/`).
3. Abra `#/jogos/__ID__`, jogue, volte ao hub pela barra e confira que nada mudou nos outros jogos.

## Testes de ponta a ponta

Base comum em `e2e/support/` (guia em `e2e/README.md`); a camada deste jogo fica em `e2e/__ID__/`.

- **Gancho** (`game/e2eHook.ts`): `exposeGame(...)` é chamado no efeito que cria o jogo e o `dispose`
  no cleanup. Publica `window.__e2e = { id: '__ID__', api }` só quando a página de teste liga a flag
  (`src/shared/e2e/hook.ts`). A `api` é só leitura: `state()` (estado que as regras precisam) e
  `targets()` (onde clicar, em coordenadas lógicas). Pré-condições raras vão num `prepare` e cada uso
  é comentado no teste.
- **Página** (`e2e/__ID__/support/page.ts`): estende `BaseGamePage` com os gestos do jogo
  (`cfg.logical` = tamanho lógico do canvas).
- **Cabeçalho das evidências** (`e2e/__ID__/support/describe.ts`): campos do estado do jogo.
- **Testes**: um ou mais por regra do README, com o número no nome
  (`test('__SIGLA__-RN-01 …')`); números esperados importados de `game/constants.ts`.
- **Determinismo**: o relógio dos testes controla os quadros, `performance.now`/`Date.now` e a
  semente do `Math.random`; nada no jogo pode depender de tempo real.
- **Piloto** (`e2e/__ID__/support/pilot.ts` + `piloto.spec.ts`, projeto `longa`): decide pelo estado
  do gancho e joga só por gestos de tela.

```bash
npm run test:e2e -- __ID__/
npm run test:e2e:longa -- __ID__/
```
