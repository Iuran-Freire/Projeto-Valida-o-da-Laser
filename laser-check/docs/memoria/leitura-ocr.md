# Como a leitura funciona

Fluxo de uma foto: abrir a foto (máx. 2560 px) → ler o código 2D → recortar a região da série → OCR → comparar → inspetor confere e registra.

## Leitores (em ordem)

1. **Principal**: PaddleOCR PP-OCRv5 (detecção + reconhecimento) num worker próprio (`ocr/paddle-worker.mjs`, cliente `ocr/paddle-client.mjs`). Recorte de até 1200 px. Usa ONNX Runtime **só de CPU** (`ocr/ort-lean.mjs`, ligado no `scripts/build.mjs`).
2. **Leve/alternativo**: reconhecimento por linha com `en_PP-OCRv5_mobile_rec` (float32 ou INT8) em `ocr/light-serial-reader.mjs`. Localiza as linhas pelos pixels (`ocr/line-bands.mjs`) e confere I/1 e 5/S com variações de contraste.
3. **Tesseract**: último recurso, para aparelhos que não rodam ONNX.

A recuperação entre eles fica em `ocr/reader-recovery.mjs` (tipos de falha: memória, rede, tempo, incompatível).

## Decisões técnicas importantes

- Erros de memória reconhecidos: `failed to allocate`, `std::bad_alloc`, `Aborted(OOM)`, `could not grow memory`. Antes, `bad_alloc` não era reconhecido e a leitura abortava.
- Leitura principal sem memória no meio da leitura: reinicia o worker e tenta **uma vez com 800 px**, mantendo esse tamanho na sessão.
- Leitor leve sem memória: worker novo, modelo INT8 e linhas de 1600 → 640 → 480 px.
- Primeira preparação do leitor principal (download): limite de **3 min**. Cada leitura: 60 s.
- Samsung: o PP-OCR costuma quebrar "NÚMERO DE SÉRIE:" em pedaços ou perder os ":". A série `R37…` lida na foto é aceita mesmo assim (`samsungUnlabelledSample`), mas sempre com conferência visual. Leitura com rótulo completo não muda.
- Código 2D lido num worker descartável (`capture/barcode-reader.mjs`), para liberar memória. Se falhar, lê na página como antes.
- Painel de andamento: `frontend/src/reading-progress.mjs` traduz as mensagens técnicas em etapa, posição da linha de progresso e texto simples. Só mensagens que começam como andamento ("Lendo…", "Preparando leitor…", "Leitor alternativo…") mexem no painel.

## Testes com fotos reais

- `tests/fixtures/15w-ve-white-*`: leituras reais e recorte de um 15W VE branco.
- `tests/fixtures/a13-*` e `m09031d-*`: recortes reais do Type C no A13.
