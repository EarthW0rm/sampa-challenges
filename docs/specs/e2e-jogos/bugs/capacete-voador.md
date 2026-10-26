# Capacete Voador — bugs e decisões (US-129)

## Bugs corrigidos

Nenhum bug de jogo encontrado pelos testes até aqui.

| Sintoma | Causa | RN | Arquivo da correção |
|---|---|---|---|
| — | — | — | — |

## Decisões pendentes do utilizador

Comportamento atual mantido e documentado no manual; a escolha de mudar ou não é de produto.

| # | Comportamento atual | RN | Observação |
|---|---|---|---|
| 1 | Ângulo vazio conta como **0°** e lança (`Number('') = 0` em `AimForm.tsx`); velocidade vazia mostra erro | CV-RN-10 | Assimétrico: o ângulo vazio deveria dar erro como a velocidade? |
| 2 | Ao aparecer o formulário, o ângulo vem selecionado; uma letra digitada apaga a seleção (o navegador descarta a letra) e o Enter seguinte lança a **0°** | CV-RN-10 | Consequência do item 1: um toque errado vira tiro na horizontal |
| 3 | A mensagem "Ângulo entre 0 e 180" nunca aparece: os campos numéricos (`min`/`max`/`step` padrão 1) fazem o navegador recusar o envio antes, com o balão nativo (em inglês no Chromium dos testes); decimais (45,5) também são recusados | CV-RN-09 | Usar `noValidate` no formulário e deixar a validação em pt-BR do jogo? |
| 4 | Gravidade: apagar o campo mostra **0** e o **Jogar** é recusado (mín. 0,5); valores fora do passo de 0,1 (ex.: 2,55) também. O antigo README dizia "número livre" e o código tem um `gravity > 0 ? … : 9.8` que nunca é alcançado | CV-RN-05 | Manter a validação do navegador ou aceitar qualquer número > 0? |
| 5 | Não há pausa ao perder o foco (jogo por turnos); um capacete em voo e o computador pensando continuam | CV-RN-34 | Documentado como regra; pausar seria mecânica nova |
