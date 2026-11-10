# Memória no celular (foco: Samsung A13)

Medições feitas em 10/11/2026 no Chromium, com foto de 12 MP (3000×4000, como a câmera do A13):

| Parte | Memória |
|---|---|
| Página aberta, sem leitores | ~105–120 MB |
| OpenCV (exigido pelo PaddleOCR) | ~120 MB (reserva 128 MB fixos no wasm; não dá para reduzir) |
| ONNX Runtime + modelo de detecção | ~150 MB |
| Modelo de reconhecimento PP-OCRv5 | ~57 MB |
| Leitor do código 2D (zxing), retido na página | ~90–110 MB (resolvido com worker descartável) |
| Recorte grande (1200×900) no leitor principal | +170 MB que não voltam (memória wasm não encolhe) |

Pico da página: **665–717 MB antes → 612–656 MB depois** das reduções.

- O A13 fechou a aba (falta de memória do Android) após duas leituras do 15W VE (uma detalhada) seguidas de um Type C. Isso não gera diagnóstico.
- Próxima opção, se ainda fechar: liberar o leitor principal depois de cada leitura (mais lento, alguns segundos a mais por leitura, porém sem acúmulo).

Como medir de novo: rodar o app local e somar o RSS dos processos `--type=renderer` do Chromium durante leituras seguidas (scripts de teste com Playwright).
