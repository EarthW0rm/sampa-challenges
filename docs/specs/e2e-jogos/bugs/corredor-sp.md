# Bugs do Corredor SP encontrados pelos testes de ponta a ponta (US-130)

| # | Sintoma | Causa | RN | Arquivo da correção |
|---|---|---|---|---|
| 1 | Escolha salva com pista, cachorro ou cor desconhecidos (ex.: `{"breed":"lobo",…}` em `corredor-sp:escolha`) derrubava o jogo na tela de escolha (`Cannot read properties of undefined (reading 'width')`, tela de erro do hub) | `loadChoice` só validava modelo e categoria; o cachorro inválido virava uma chave de sprite inexistente em `recolored()` (prévia da moto) | CS-RN-02, spec RN-47 | `src/games/corredor-sp/Game.tsx` |
| 2 | A 390 px (celular) o botão de toque CAPACETE ficava cortado fora da tela (borda direita em 434 px) e não podia ser tocado | Os três botões de ação (FREIO, GRAU, CAPACETE) ficavam numa linha só ao lado das setas, sem quebra, e a fileira passava da largura | CS-RN-07, spec RN-47 | `src/games/corredor-sp/styles.css` |

## Decisões pendentes do utilizador

| # | Ponto | Comportamento atual (mantido e documentado no manual) |
|---|---|---|
| 1 | Teto de vidas: o README antigo dizia "até 5" (e "se já tiver 5, vira pacote"), o código tem `MAX_LIVES = 10` desde a versão inicial | Mantido `MAX_LIVES = 10`; manual CS-RN-14/15 descreve 10 |
| 2 | Enter e Espaço são teclas do jogo e têm o padrão cancelado durante a corrida: não acionam os botões em foco dos diálogos de pausa e de fim de turno ("Continuar", "Correr de novo") | Mantido; manual (Controles, CS-RN-28) orienta usar mouse/toque ou P/Esc |
| 3 | Moto do trânsito que vem por trás e termina a ultrapassagem ainda sobreposta à moto do jogador conta como batida (o desvio só vale enquanto ela está atrás) | Mantido; manual CS-RN-09 descreve |
