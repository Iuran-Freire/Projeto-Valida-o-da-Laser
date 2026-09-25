# Valida Laser

PWA para ler QR Code e Data Matrix, reconhecer a tampografia por OCR e comparar os 14 caracteres finais da série. As imagens são processadas no navegador; não são enviadas a servidores. O histórico fica em IndexedDB somente no aparelho/navegador e pode ser exportado em CSV UTF-8 com separador ponto e vírgula.

## Usar

1. Abra o endereço HTTPS do aplicativo. Aguarde “Pronto para uso offline” no primeiro acesso.
2. Abra a câmera e capture uma peça por vez, ou escolha uma foto. Inclua o código e a linha NÚMERO DE SÉRIE.
3. Se a tampografia não for reconhecida, selecione a linha inteira na imagem e toque em Ler seleção.
4. Confira o texto da tampografia com a peça. Correções manuais são registradas separadamente do texto original do OCR.
5. O aplicativo compara e registra automaticamente a captura. Leituras incompletas ou OCR inconsistente ficam PENDENTES, com o texto reconhecido preservado nos detalhes.
6. Exporte o CSV para fazer backup. Limpar os dados do navegador pode apagar todos os registros locais.

No Chrome/Edge compatível, use “Instalar aplicativo” quando disponível. No iPhone, abra no Safari e use Compartilhar → Adicionar à Tela de Início. A câmera precisa de HTTPS (ou localhost para desenvolvimento). O uso offline depende do primeiro carregamento completo, da permissão de armazenamento e da retenção do cache pelo navegador. A instalação e a câmera devem ser verificadas no aparelho de destino.

## Regra de comparação

- Letras e números são preservados, inclusive maiúsculas/minúsculas, zeros iniciais e diferenças O/0, I/1, B/8.
- A tampografia precisa conter NÚMERO DE SÉRIE: (ou NUMERO DE SERIE:) seguido de uma sequência contínua com pelo menos 14 caracteres alfanuméricos. Usa os 14 finais dessa sequência.
- Para o código 2D, aceita formato código-da-peça+série (como GH44-03247A+R37L9QGE3Y2IPA), conteúdo alfanumérico contínuo, campo de série com rótulo, campo string JSON (serial, sn etc.), parâmetro de série de URL ou GS1 explícito (21). Formatos desconhecidos ficam pendentes; não se presume que qualquer número seja uma série.
- Se houver vários códigos na foto, a leitura é bloqueada. Séries diferentes no texto também ficam pendentes.
- Os resultados são COINCIDE, DIVERGENTE e PENDENTE. COINCIDE não substitui validação do processo de produção.
- Guarda UUID, data UTC, conteúdo original e utilizado, séries extraídas, origem, formato, confiança OCR, indicação de edição, confirmação visual e versão da regra. Fotos não são persistidas.
- O histórico local não é um log inviolável nem compartilhado entre operadores.

## Desenvolvimento

Node.js 22 ou superior:

```text
npm ci
npm run build
npm test
npm start
```

Abra http://localhost:4173. O diretório dist contém a distribuição estática completa, incluindo os leitores, o modelo OCR e o service worker. Não abra o HTML diretamente por file://. Alterações no app requerem novo build. Um service worker novo ativa quando todas as abas da versão anterior forem fechadas.

## Leitores

- ZXing WASM: https://github.com/Sec-ant/zxing-wasm
- Tesseract.js: https://github.com/naptha/tesseract.js

Limitações: reflexos, falta de foco, fotos pequenas e caracteres muito próximos podem impedir a leitura. Não há garantia de precisão para a foto de referência ou para produção sem ensaios com as peças reais.

## Captura automática (câmera v2)
Ao tocar em Capturar, comparar e registrar, a mesma imagem fornece o código 2D e a tampografia. O OCR procura a identificação perto do código e faz duas passagens sem usar a série do código para corrigir o texto. Com duas leituras iguais e confiança OCR de pelo menos 80 em cada uma, compara automaticamente; caso contrário, registra PENDENTE. O limiar é heurístico e precisa de validação com peças reais. Cada tentativa guarda o texto OCR, confiança, região analisada e motivo da pendência. Recapturas geram novos registros. A opção de conferência manual continua disponível para revisão humana. A câmera precisa enquadrar o código e toda a linha da série; mantenha a peça na orientação da foto de referência.

## Leitura v3 — PaddleOCR local
O reconhecimento agora usa dois modelos oficiais (PP-OCRv6 small e PP-OCRv5 mobile), cada um com imagem original e contraste. As quatro leituras devem identificar a mesma série com confiança de pelo menos 80; uma discordância mantém PENDENTE. Esse critério é heurístico, não uma garantia estatística. O código 2D nunca é usado para preencher/corrigir caracteres da tampografia. Os modelos e o processamento ficam locais. A primeira preparação offline é maior e a captura demora mais. A câmera solicita até 3840 × 2160 e foco contínuo quando o aparelho oferece suporte. O recorte automático assume a linha abaixo e à esquerda do Data Matrix, como no adaptador de referência. Para outros layouts, use a seleção manual.
Fontes e licenças dos modelos: dist/vendor/paddle/SOURCES.txt. A publicação continua pendente de autorização. Instalação e precisão no celular precisam de validação no equipamento de produção.
