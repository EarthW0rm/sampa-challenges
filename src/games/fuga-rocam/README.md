# Fuga da Rocam

Jogo de ação de labirinto visto de cima. O cachorro motoqueiro pega um pedido num pino amarelo, entrega no pino verde e foge das viaturas da Rocam. Entregas em sequência até ser pego 3 vezes. Recorde por mapa.

- **Mapas:** Centro Velho (ruas apertadas, becos), Avenida Paulista (avenida rápida no meio), Marginal Pinheiros (rio, 3 pontes, vias expressas).
- **Controles:** setas/WASD escolhem a direção (vale até a próxima esquina), Espaço/Shift turbo, X óleo, P pausa. Celular: deslizar no mapa ou direcional + botões TURBO/ÓLEO.
- **Procurado:** 1 a 5 estrelas por calor (sobe à vista e a cada entrega, desce longe da vista, cai rápido na garagem). Mais estrelas = mais viaturas e mais pontos.
- **Pedidos:** normal, frágil (sem turbo, ×2), urgente (tempo, bônus), pesado (lento, ×3).
- **Itens:** turbo, óleo, capacete (escudo), pizza, vida.

Estrutura: `game/` (lógica: `engine.ts`, `maps.ts`, `nav.ts`, `mapArt.ts`, `sound.ts`), `components/` (telas), `assets/` (sprites gerados por `tools/pixelart/fuga_rocam.py`). Parâmetros de equilíbrio em `game/constants.ts`.
