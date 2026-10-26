# __TITULO__

Descreva o jogo em duas ou três frases: tema, objetivo e para quantos jogadores.

Rota no hub: `#/jogos/__ID__`. Este README é o **manual** do jogo: toda regra ou mecânica tem um
número `__SIGLA__-RN-NN`, e cada número tem pelo menos um teste de ponta a ponta que o cita no nome
(seção 9). Mudou uma regra? Atualize a seção dela, a tabela de parâmetros e o teste no mesmo commit.

## Sumário

1. [Início rápido](#1-início-rápido)
2. [Controles](#2-controles)
3. [Telas e fluxo de uma partida](#3-telas-e-fluxo-de-uma-partida)
4. [Regras e mecânicas](#4-regras-e-mecânicas)
5. [Pontuação e recorde](#5-pontuação-e-recorde)
6. [Opções do menu](#6-opções-do-menu)
7. [Parâmetros](#7-parâmetros)
8. [Arquitetura](#8-arquitetura)
9. [Testes](#9-testes)
10. [Como contribuir](#10-como-contribuir)

## 1. Início rápido

`npm run dev` na raiz e abra `#/jogos/__ID__`. Use as setas para mover o quadrado.

## 2. Controles

| Entrada | Controle | Ação |
|---|---|---|
| Teclado | Setas | mover |
| Mouse | — | — |
| Toque | — | — |

## 3. Telas e fluxo de uma partida

Descreva as telas (título, partida, pausa, fim) e como se passa de uma para outra.

## 4. Regras e mecânicas

Uma subseção por tema; cada regra com o número no título ou na linha.

### __SIGLA__-RN-01 Movimento e limites

O quadrado anda `PLAYER_SPEED` pixels lógicos por segundo com as setas e nunca sai da área de
`W` × `H`.

## 5. Pontuação e recorde

O que dá pontos, como o recorde é guardado (chave `__ID__:recorde`).

## 6. Opções do menu

Cada opção, o valor padrão e onde fica guardada.

## 7. Parâmetros

Cada número que muda o jogo (de `game/constants.ts` ou do topo do motor), com o valor atual e o
efeito. Atualize sempre que mudar um valor.

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 320 × 200 | grade lógica (posições e colisões) |
| `SCALE` (`game/hires.ts`) | 2 | o canvas tem 640×400 e os sprites ganham o dobro de detalhe (Scale2x) |
| `PLAYER_SPEED` | 100 | pixels lógicos por segundo do quadrado |
| `PLAYER_SIZE` | 8 | lado do quadrado (pixels lógicos) |

## 8. Arquitetura

Veja o mapa dos arquivos no `CLAUDE.md` desta pasta.

## 9. Testes

```bash
npm run test:e2e -- e2e/__ID__/                # suíte rápida do jogo (desktop + celular)
npx playwright test -c e2e/playwright.config.ts --project=celular e2e/__ID__/  # só o celular (390 px)
npm run test:e2e:longa -- e2e/__ID__/          # piloto (partidas inteiras)
npm run test:e2e:cobertura                     # RN do manual × testes
```

| Arquivo | Cobertura |
|---|---|
| `e2e/__ID__/navegacao.spec.ts` | abre o jogo, anda e volta ao hub |
| `e2e/__ID__/responsivo.spec.ts` | 390 px sem rolagem lateral |

Regra → teste (gerada por `npm run test:e2e:cobertura -- --md __ID__`):

| Regra | Testes |
|---|---|
| __SIGLA__-RN-01 | `navegacao.spec.ts` |

## 10. Como contribuir

Leia o `CLAUDE.md` da raiz e o desta pasta antes de mexer. `npm run typecheck`,
`npm run typecheck:e2e` e a suíte do jogo antes de entregar.
