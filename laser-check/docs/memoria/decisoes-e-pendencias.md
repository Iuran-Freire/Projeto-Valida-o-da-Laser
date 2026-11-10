# Decisões e próximos passos

## Decisões

- Leitura principal (PaddleOCR) continua padrão em todos os aparelhos.
- Série Samsung sem rótulo/":" é aceita só com conferência visual.
- 5↔S divergente segue DIVERGENTE (proposta de virar PENDENTE ficou para o dono decidir).
- Polaridade por modelo: 15W VE branco (letra escura), Type C preto (letra clara).
- Mudanças de teste vão para a branch `CL-Version`; a `main` está no commit `eb46a1c`.

## Histórico da branch `CL-Version`

1. `5e9f97a`: série do 15W VE sem rótulo, polaridade e erros de memória do A13
2. `6ea2be8`: 3 min para o primeiro download do leitor
3. `c48f186`: leitura principal tenta de novo com 800 px quando falta memória
4. `99a8ef6`: código 2D num worker descartável + ONNX só de CPU
5. `9719cbd`: linha de progresso, cronômetro e textos de andamento

## Próximos passos

- Testar a versão atual no A13 e no iPhone 11.
- Se o A13 ainda fechar a aba: liberar o leitor principal entre leituras.
- Melhorar a separação 5/S (o leitor principal leu `S` no lugar de `5` com 96% numa foto do Type C).
- Campo "Texto impresso" às vezes mostra todas as linhas lidas em vez de só a série (só visual).
- O botão "Nova leitura" fica atrás do painel de andamento no celular durante a leitura (já acontecia antes).
