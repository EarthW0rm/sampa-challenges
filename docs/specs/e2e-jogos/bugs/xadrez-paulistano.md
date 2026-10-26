# Bugs — Xadrez Paulistano (US-133)

Nenhum bug de jogo encontrado pelos testes de ponta a ponta. Mudanças de produção feitas só para os
testes (inertes sem a flag da página de teste): gancho `game/e2eHook.ts`, `e2eState`/`e2eTargets`/
`e2eSetFen` no motor, `startFen` no pedido à IA, semente e orçamento de nós na busca
(`E2E_NODES_PER_MS`) e o texto do status do painel extraído para `statusText()` (mesmo desenho).

| Sintoma | Causa | RN | Arquivo da correção |
|---|---|---|---|
| — | — | — | — |

## Decisões pendentes do utilizador

Comportamentos atuais do código, documentados no manual como estão e mantidos (não são bugs óbvios):

| Ponto | Comportamento atual | Regra |
|---|---|---|
| Regra dos 50 lances | Empate **automático** aos 100 meios-lances (pelas regras da FIDE, aos 50 é reclamável e só aos 75 é automático) | XP-RN-14 |
| Repetição tripla | Empate **automático** na 3ª ocorrência (pela FIDE, reclamável; automático na 5ª) | XP-RN-15 |
| Desfazer depois de desistir | Só cancela a desistência; o tabuleiro fica como estava (não volta lance) | XP-RN-19 |
| Material insuficiente | Rei e bispo contra rei e cavalo, e rei e dois cavalos contra rei, não encerram a partida (mate só com ajuda) | XP-RN-16 |
