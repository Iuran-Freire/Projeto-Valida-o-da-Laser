# Testes em aparelhos reais

O A13 é do chefe do dono do projeto: testar nele é difícil, então cada teste precisa render diagnósticos. Um iPhone 11 pode ser usado para teste.

## 10/11/2026

- **Outro Android (4 GB, 8 núcleos), versão `app-d9569c4fdb14`**: 15W VE lido certo, mas a primeira leitura estourou os 60 s por causa do download (resolvido com o limite de 3 min).
- **A13, versão `app-bdf0e86b2b10`**: 2 leituras do 15W VE (`R37Y3JH6TK2IPA`) e 2 do Type C (`R37L9NH6222IPA`), todas pela leitura principal com comparação automática. **Uma vez a aba fechou sozinha** no Type C; depois de reabrir, leu normalmente.

## Pendentes

- A13 com a versão `app-5e28418a6f3f` (redução de memória, linha de progresso, revisão para iPhone e rotação da foto): repetir 15W VE, leitura detalhada e Type C, sem fechar a aba.
- iPhone 11 (Safari): primeiro teste em iOS. Precisa de iOS 16.4 ou mais novo para a leitura principal.

Para cada teste, pedir os diagnósticos JSON (botão de baixar diagnóstico) e conferir o campo `build`.
