# Valida Laser

PWA para ler QR Code e Data Matrix, reconhecer a tampografia por OCR e comparar a série de 14 caracteres após `+` no código com a série após `:` na tampografia. A leitura da imagem é processada no navegador. A foto JPEG de cada nova inspeção é salva com o registro e sincronizada entre inspetores: os dados de texto ficam em D1 e as fotos do ambiente de teste em R2. Sem conexão, registro e foto aguardam no aparelho até a sincronização. O histórico pode ser exportado em CSV UTF-8 com separador ponto e vírgula; o CSV não inclui as fotos.

## Usar

1. Abra o endereço HTTPS do aplicativo, informe seu nome, selecione o modelo e o turno e toque em Salvar. O modelo e o turno ficam guardados no aparelho para as próximas peças; ao mudar o modelo, a foto e a leitura atuais são descartadas para evitar registrar uma peça sob a regra errada. A inspeção pode começar antes da sincronização.
2. Toque em Tirar foto com a câmera do celular e capture uma peça por vez. Inclua o código e a linha NÚMERO DE SÉRIE. Se a imagem estiver borrada, afaste o aparelho; a câmera nativa pode oferecer toque para focar e modo macro. Se ela não devolver a foto ao navegador, use Escolher foto salva para selecionar a imagem.
3. A foto recebe automaticamente uma leitura rápida de duas etapas. Se precisar, toque em Repetir leitura detalhada para executar quatro leituras com o mesmo modelo: duas da região detectada e duas do trecho da série ampliado. Para isolar o texto, selecione a linha inteira na imagem e toque em Ler seleção. O modo detalhado reutiliza o modelo da leitura inicial e processa quatro imagens em sequência, liberando cada imagem entre as etapas para limitar a memória no celular.
4. Confira o código 2D e a tampografia na peça. A comparação aparece apenas como prévia. Se necessário, repita a leitura detalhada ou corrija o texto antes de confirmar. Correções manuais são registradas separadamente do texto original do OCR. Se o OCR ler 1 no lugar do I fixo da posição 12, o inspetor pode conferir na peça e corrigir apenas essa posição; as demais divergências continuam destacadas.
5. Marque a confirmação obrigatória e toque em Registrar. Sem esses dois passos, nenhum resultado ou foto é salvo e sincronizado. Leituras incompletas ou OCR inconsistente podem ser registradas como PENDENTES após a confirmação, com o texto reconhecido preservado nos detalhes.
6. Confira o estado de sincronização antes de limpar os dados do navegador. Registros e fotos ainda aguardando envio existem somente naquele aparelho. Abra a foto no histórico com Ver foto. Exporte o CSV para fazer backup dos dados de texto; as fotos precisam de backup separado no Cloudflare R2.

No Chrome/Edge compatível, use “Instalar aplicativo” quando disponível. No iPhone, abra no Safari e use Compartilhar → Adicionar à Tela de Início. A câmera precisa de HTTPS (ou localhost para desenvolvimento). O uso offline depende do primeiro carregamento completo, da permissão de armazenamento e da retenção do cache pelo navegador. A instalação e a câmera devem ser verificadas no aparelho de destino.

## Regra de comparação

- Letras e números são preservados, inclusive maiúsculas/minúsculas, zeros iniciais e diferenças O/0, I/1, B/8.
- A tampografia usa exatamente 14 caracteres alfanuméricos após `:`. O rótulo NÚMERO DE SÉRIE pode ter pequenas falhas de OCR; sem rótulo reconhecido, deve haver apenas um campo após `:`.
- O código 2D contém o SEC CODE do modelo, `+` e exatamente 14 caracteres de série. Para TYPE C BLACK, o SEC CODE é `GH44-03247A`; para 15W VE, `GH44-03086A`. Outros formatos explícitos de série, como JSON, URL e GS1 (21), continuam legíveis, mas ficam pendentes porque não permitem validar o modelo e o turno da peça.
- Nos dois modelos, a série tem `R37` fixo, ano/mês/dia codificados nas posições 4–6, turno na posição 7, contador em base 33 nas posições 8–10 e `2IPA` fixo nas posições 11–14. A operação atual usa `G`, `H` e `J` para o 1º, 2º e 3º turnos; o `I` da posição 12 não pode ser trocado por `1`. O TYPE C mantém sua tabela de anos em `docs/15w-ve-type-c-black.md`; o 15W VE usa a tabela e o layout descritos em `docs/15w-ve.md`.
- O turno informado pelo inspetor valida diretamente a posição 7 do código 2D: 1º turno = `G`, 2º = `H`, 3º = `J`. Se a letra não corresponder, o registro é DIVERGENTE mesmo que código 2D e tampografia tenham séries iguais ou que o OCR esteja incompleto.
- Se houver vários códigos na foto, a leitura é bloqueada. Séries diferentes no texto também ficam pendentes.
- Os resultados são COINCIDE, DIVERGENTE e PENDENTE. COINCIDE não substitui validação do processo de produção.
- Guarda UUID, data UTC, inspetor, modelo, turno informado, conteúdo original e utilizado, séries extraídas, origem, formato, confiança OCR, indicação de edição, confirmação visual, versão da regra e foto JPEG vinculada ao UUID. Registros antigos sem modelo são apresentados como TYPE C.
- O servidor central reúne os registros e fotos de todos os inspetores. O nome é informado livremente no aparelho e não confirma a identidade da pessoa. O histórico e as fotos ficam acessíveis a quem tiver o link do aplicativo.

## Desenvolvimento

Node.js 24 ou superior. Para a execução local:

```text
npm ci
npm run build
npm test
npm start
```

Abra http://localhost:4173. O servidor local usa SQLite em `data/inspections.sqlite` e arquivos JPEG em `data/photos/`; não é o armazenamento da Cloudflare. O diretório dist contém a distribuição estática completa, incluindo os leitores, o modelo OCR e o service worker. Não abra o HTML diretamente por file://. Alterações no app requerem novo build. Um service worker novo ativa quando todas as abas da versão anterior forem fechadas.

## Cloudflare

O projeto inclui `worker.mjs`, `wrangler.jsonc` e a migração D1 em `migrations/`. Use Wrangler autenticado na conta Cloudflare da empresa:

Para testar a branch antes de publicá-la no aplicativo principal, use `https://valida-laser-teste.iuranhumberto99.workers.dev/`. O arquivo `wrangler.preview.jsonc` publica um Worker separado, ligado ao banco D1 `valida-laser-teste` e ao bucket R2 `valida-laser-teste-fotos`; seus registros e fotos não aparecem na produção. O namespace KV anterior permanece ligado somente para migrar, durante a leitura, eventuais fotos antigas. Gere `dist` com `npm run build` e execute `wrangler deploy --config wrangler.preview.jsonc` para atualizar apenas esse ambiente. O arquivo `wrangler.jsonc` já aponta para o bucket R2 separado `valida-laser-fotos`, mas o ambiente de produção continua com a versão anterior até a publicação desta branch.

1. Crie um banco D1 chamado `valida-laser` e atualize `database_id` em `wrangler.jsonc` com o ID retornado.
2. Aplique `migrations/0001_inspections.sql` ao banco remoto.
3. Execute `npm run build` e `wrangler deploy` para publicar os arquivos estáticos junto com a API.

Use HTTPS na URL final para permitir a câmera no celular. Após a publicação, informe nomes diferentes em dois aparelhos e confira se um registro feito no primeiro aparece no segundo. O modelo OCR e os arquivos de execução podem exigir uma transferência inicial grande; o primeiro carregamento em rede móvel pode levar tempo. Faça backup regular do banco D1.

## Leitores

- ZXing WASM: https://github.com/Sec-ant/zxing-wasm
- Tesseract.js: https://github.com/naptha/tesseract.js

Limitações: reflexos, falta de foco, fotos pequenas e caracteres muito próximos podem impedir a leitura. Não há garantia de precisão para a foto de referência ou para produção sem ensaios com as peças reais.

## Leitura automática com registro confirmado
Ao voltar da câmera nativa do celular, a mesma foto fornece o código 2D e a tampografia. O OCR procura a identificação perto do código e faz duas passagens sem usar a série do código para corrigir o texto. Com duas leituras iguais e confiança OCR de pelo menos 80 em cada uma, a prévia pode indicar coincidência; caso contrário, a leitura permanece incerta. Nenhuma prévia é registrada automaticamente: o inspetor deve conferir a peça, marcar a confirmação e tocar em Registrar. O limiar de confiança é heurístico e precisa de validação com peças reais. Cada registro confirmado guarda o texto OCR, confiança, região analisada e motivo da pendência. A foto precisa enquadrar o código e toda a linha da série; mantenha a peça na orientação da foto de referência.

## Leitura v3 — PaddleOCR local
O reconhecimento usa PP-OCRv5 mobile: imagem original e contraste na leitura inicial; na releitura detalhada, original e contraste da região detectada e do trecho da série ampliado. Na foto original de teste do A07, esse modelo leu o I corretamente, mas ainda confundiu 0 com O; a comparação por posição e a revisão manual permanecem necessárias. O modelo é reutilizado para reduzir o uso de memória no celular. Na leitura detalhada, as quatro tentativas devem identificar a mesma série com confiança de pelo menos 80; uma discordância mantém PENDENTE. Esse critério é heurístico, não uma garantia estatística. O código 2D nunca é usado para preencher/corrigir caracteres da tampografia. Os modelos e o processamento de OCR ficam locais. A primeira preparação offline é maior e a leitura demora mais. O foco e a resolução são controlados pela câmera nativa do celular. O recorte automático procura a série abaixo e à esquerda do Data Matrix no TYPE C e acima do Data Matrix no 15W VE. Para outros layouts, use a seleção manual.
Fontes e licenças dos modelos: dist/vendor/paddle/SOURCES.txt.  Instalação e precisão no celular precisam de validação no equipamento de produção.
