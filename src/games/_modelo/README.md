# __TITULO__

Descreva o jogo em duas ou três frases: tema, objetivo e para quantos jogadores.

Rota no hub: `#/jogos/__ID__`.

## Como jogar

| Controle | Ação |
|---|---|
| Setas | mover |

### Regras

- Como se ganha ou se perde.
- O que dá pontos.

## Parâmetros

Liste aqui cada número que muda o jogo (de `game/constants.ts` ou do topo do motor), com o valor
atual e o efeito. Atualize sempre que mudar um valor.

| Parâmetro | Valor | Efeito |
|---|---|---|
| `W`, `H` | 320 × 200 | grade lógica (posições e colisões) |
| `SCALE` (`game/hires.ts`) | 2 | o canvas tem 640×400 e os sprites ganham o dobro de detalhe (Scale2x) |
| `EXEMPLO` | 0 | o que acontece se aumentar ou diminuir |

## Rodando só este jogo

Ele roda dentro do hub: `npm run dev` na raiz e abra `#/jogos/__ID__`.
