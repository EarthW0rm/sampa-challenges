# CLAUDE.md — Fuga da Rocam

Leia primeiro o `CLAUDE.md` da raiz. Resolução: lógica 640×400 = grade 40×25 de tiles de 16 px; canvas 1280×800 (`SCALE` 2, `game/hires.ts`).

## Arquitetura
- `game/maps.ts`: mapas em tiles (`#` prédio, `.` rua, `f` faixa rápida ×1.22, `b` beco só moto/jogador, `g` garagem só jogador, `p` parque, `w` água, `o` praça). `canEnter(map, classe, tx, ty)`; classes `player|moto|car`. Garagens são pontas sem saída (`autoGarages`). Se mexer num mapa, confira que tudo é conexo para as três classes.
- `game/nav.ts`: campos de distância BFS por classe/alvo (cache limpo a cada ~2 s). Viaturas escolhem em cada esquina o vizinho de menor distância.
- `game/engine.ts` (`FugaEngine`): movimento por grade (`advance` com `tx,ty,dir,off`; jogador com curva antecipada/tardia de `TURN_TOLERANCE` px e reversão imediata), personas das viaturas (carro perseguidor/bloqueador, moto rápida/emboscada), visão por distância de caminho (`SIGHT_TILES`) + rádio (`RADIO_MEMORY`), calor/estrelas, cotas por estrela (`QUOTA`), helicóptero (5 estrelas), pedidos (normal/frágil/urgente/pesado), itens, óleo, garagem (`HIDE_MAX`, `GARAGE_COOLDOWN`), escudo, vidas. `snapshot()` e `cheat` existem para testes automáticos.
- `game/mapArt.ts`: camada estática do mapa, cacheada por mapa. `game/sound.ts`: WebAudio (sirene pela viatura mais próxima, hélice, eventos), chave `fuga-rocam:som`.
- Recorde por mapa: `fuga-rocam:recorde:<mapa>`; o card do hub usa `bestRecord`.

## Equilíbrio
Todos os números estão em `game/constants.ts` e `QUOTA`/`PERSONAS` no topo do `engine.ts`. A viatura é só um pouco mais lenta que a moto (`PLAYER_SPEED` 84 × `CAR_SPEED` 70 / `MOTO_SPEED` 80) e ganha 3,5% por estrela: o perigo vem de cortes de caminho (bloqueador/emboscada), não de velocidade.

## Sprites
`tools/pixelart/fuga_rocam.py` gera os PNGs 1× (veículos desenhados virados para a direita e girados em `r/d/l/u`) e a capa. Cachorro, corações e capacete vêm da biblioteca compartilhada.
