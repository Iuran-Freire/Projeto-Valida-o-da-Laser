# iPhone / Safari

Revisão feita em 11/11/2026 para a apresentação num iPhone 11. O motor do Safari (WebKit) não está disponível no ambiente de testes; a verificação foi estática + Chromium simulando o iPhone 11.

## Requisitos
- **iOS 16.4 ou mais novo**: a leitura principal e o leitor compacto precisam de WebAssembly SIMD. Em iOS mais antigo o app abre, mas só o Tesseract lê (mais lento e menos preciso).
- O app em si abre a partir do iOS 15: o build gera código para `safari15` (`scripts/build.mjs`).

## Cuidados já tratados
- Nada de expressão regular com "lookbehind" (`(?<=`, `(?<!`): no Safari anterior ao 16.4 isso impede o **app inteiro** de abrir. As duas que existiam (OPPO e Frecom 24W) foram trocadas por formas equivalentes (testadas em 200 mil textos).
- Campos de formulário com letra de **16 px ou mais**: abaixo disso o iPhone dá zoom ao tocar. "Nome do inspetor" e "Modelo" estavam em 14 px.
- `<dialog>`: em iOS anterior ao 15.4 o app abre e fecha as janelas como painel comum.
- Câmera: `<input type="file" accept="image/*" capture="environment">` (abre a câmera direto). O Safari converte HEIC em JPEG.
- **Rotação da foto (EXIF):** o iPhone grava a foto deitada com a anotação "gire 90°". Algumas versões do Safari ignoravam essa anotação no `createImageBitmap` (WebKit bugs 231063 e 237895), e a foto chegava deitada: no 15W VE a série era procurada no lugar errado e a leitura falhava. `frontend/src/capture/photo-orientation.mjs` lê a anotação e o tamanho gravado do JPEG e só gira quando o navegador não girou (sem risco de girar duas vezes).
- Diagnóstico baixado vai para o app **Arquivos** (Downloads).

## Roteiro testado (Chromium como iPhone 11)
Foto de teste no formato do iPhone 11: 12 MP, pixels deitados + EXIF 6. Testado com o navegador girando a foto e simulando o Safari que não gira (pior caso): nos dois, foto em pé e "Leituras coincidem" no 15W VE.

Cadastrar inspetor (gestão) → escolher inspetor, modelo e turno → foto → leitura → leitura detalhada → diagnóstico → ampliar foto → "Não vejo falha" → confirmar → Registrar → histórico → Ver foto → exportar CSV → nova leitura. Sem erros nem arquivos faltando.

Ordem obrigatória do registro: **avaliar a foto antes de marcar a confirmação**. Mudar a avaliação desmarca a confirmação de propósito.
