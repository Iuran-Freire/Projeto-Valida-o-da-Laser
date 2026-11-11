# Valida Laser — memória do projeto

PWA para inspeção de carregadores: lê o código 2D/Data Matrix e a tampografia (OCR), compara as séries posição por posição e registra a inspeção. Usada **no celular** pelos inspetores: responsividade e consumo de memória são prioridade.

Produção: https://valida-laser.iuranhumberto99.workers.dev/
Teste (prévia fixa): https://cl-version-valida-laser.iuranhumberto99.workers.dev/

## Regras de trabalho (do dono do projeto)

- Responder em **português**, claro e pouco técnico.
- **Commit, push e publicação no Cloudflare só quando o dono pedir.** Nunca publicar na produção sem pedido explícito.
- Branch de testes: `CL-Version`. A `main` só recebe o que for aprovado.
- Antes de alterar, conferir `git status` para preservar mudanças locais.
- Perguntar apenas quando faltar informação que mude a implementação.

## Compatibilidade (iPhone/Safari)

- Não usar lookbehind em expressões regulares nem campos com letra menor que 16 px. Detalhes em `docs/memoria/iphone.md`.

## Regras de negócio que não podem ser quebradas

- **Nunca** corrigir caracteres da tampografia usando o código 2D. Toda leitura impressa vem da imagem.
- Divergências ficam visíveis por posição. Em caso de incerteza, exigir **conferência visual** do inspetor antes do registro.
- A leitura principal (PaddleOCR PP-OCRv5) continua sendo a padrão. Os leitores alternativos só entram quando ela falha ou fica incerta.
- 5↔S divergente continua **DIVERGENTE** (decisão anterior do projeto); I/1 e O/0 são resolvidos pelo formato da série.

## Estrutura e comandos

Aplicação em `laser-check/` (rodar os comandos dentro dela):

- Build: `node scripts/build.mjs`
- Testes: `node --test tests/*.test.mjs`
- Servidor local: `node backend/server.mjs` (porta 4173)
- Frontend em `frontend/src`, gerado em `frontend/dist` (o `dist` é versionado e publicado).
- Worker/API em `backend/` (`wrangler.jsonc`: Worker `valida-laser`, D1 e R2).

## Memória detalhada

Ler o arquivo do assunto antes de mexer nele:

- `laser-check/docs/memoria/modelos.md`: modelos, formatos de série e cores das peças.
- `laser-check/docs/memoria/leitura-ocr.md`: como a leitura funciona, os leitores e as decisões técnicas.
- `laser-check/docs/memoria/memoria-celular.md`: medições de memória e o que já foi feito para o A13.
- `laser-check/docs/memoria/testes-dispositivos.md`: histórico de testes em aparelhos reais.
- `laser-check/docs/memoria/publicacao.md`: como publicar a prévia e o passo a passo no Windows.
- `laser-check/docs/memoria/iphone.md`: requisitos e cuidados para iPhone/Safari.
- `laser-check/docs/memoria/decisoes-e-pendencias.md`: decisões tomadas e próximos passos.

Ao terminar um trabalho relevante, **atualizar o arquivo de memória correspondente**.
