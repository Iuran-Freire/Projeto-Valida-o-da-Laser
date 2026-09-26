# Valida Laser

PWA para ler QR Code e Data Matrix, reconhecer a tampografia por OCR e comparar a série de 14 caracteres após `+` no código com a série após `:` na tampografia. As imagens são processadas no navegador; não são enviadas a servidores. Os registros de texto são sincronizados entre inspetores por Cloudflare Workers e D1. Sem conexão, novos registros aguardam no aparelho até a sincronização. O histórico pode ser exportado em CSV UTF-8 com separador ponto e vírgula.

## Usar

1. Abra o endereço HTTPS do aplicativo, informe seu nome, selecione o turno e toque em Salvar nome e turno. O turno fica guardado no aparelho para as próximas peças, mas pode ser alterado no início de outro turno. A inspeção pode começar antes da sincronização.
2. Use Abrir câmera no app ou Usar câmera do celular e capture uma peça por vez. Inclua o código e a linha NÚMERO DE SÉRIE. Se a imagem estiver borrada, afaste o aparelho; a câmera nativa pode oferecer toque para focar e modo macro. Se ela não devolver a foto ao navegador, use Escolher foto para selecionar a imagem salva.
3. A foto recebe automaticamente uma leitura rápida de duas etapas. Se precisar, toque em Repetir leitura detalhada para executar quatro leituras com o mesmo modelo: duas da região detectada e duas do trecho da série ampliado. Para isolar o texto, selecione a linha inteira na imagem e toque em Ler seleção. O modo detalhado reutiliza o modelo da leitura inicial e processa quatro imagens em sequência, liberando cada imagem entre as etapas para limitar a memória no celular.
4. Confira o texto da tampografia com a peça. Correções manuais são registradas separadamente do texto original do OCR. Se o OCR ler 1 no lugar do I fixo da posição 12, o inspetor pode confirmar o caractere na peça e corrigir apenas essa posição, mesmo quando houver outros defeitos; as demais divergências continuam destacadas.
5. O aplicativo compara e registra automaticamente a captura. Leituras incompletas ou OCR inconsistente ficam PENDENTES, com o texto reconhecido preservado nos detalhes.
6. Confira o estado de sincronização antes de limpar os dados do navegador. Registros ainda aguardando envio existem somente naquele aparelho. Exporte o CSV para fazer backup.

No Chrome/Edge compatível, use “Instalar aplicativo” quando disponível. No iPhone, abra no Safari e use Compartilhar → Adicionar à Tela de Início. A câmera precisa de HTTPS (ou localhost para desenvolvimento). O uso offline depende do primeiro carregamento completo, da permissão de armazenamento e da retenção do cache pelo navegador. A instalação e a câmera devem ser verificadas no aparelho de destino.

## Regra de comparação

- Letras e números são preservados, inclusive maiúsculas/minúsculas, zeros iniciais e diferenças O/0, I/1, B/8.
- A tampografia usa exatamente 14 caracteres alfanuméricos após `:`. O rótulo NÚMERO DE SÉRIE pode ter pequenas falhas de OCR; sem rótulo reconhecido, deve haver apenas um campo após `:`.
- No formato da peça mostrado na planilha, o código 2D contém o código da peça, `+` e exatamente 14 caracteres de série (exemplo: `GH44-03247A+R37L9RGGR22IPA`). O conteúdo completo tem 26 caracteres. Outros formatos explícitos de série, como JSON, URL e GS1 (21), continuam legíveis, mas ficam pendentes porque não permitem validar o turno desta peça.
- Na série `R37L9RGGR22IPA`, a planilha divide as posições em `R37` (texto fixo), `L9R` (ano, mês e dia de fabricação), `G` (turno/linha), `GR2` (contador) e `2IPA` (texto fixo). O aplicativo compara a série completa entre as duas fontes e valida também as posições fixas `R37` e `2IPA`, além do código de turno/linha (`G`, `H` ou `J`). Ano, mês, dia e contador são campos variáveis alfanuméricos; a planilha não fornece a tabela de conversão dos códigos de data nem os limites do contador. No exemplo `R37L9QHG2Z2IPA`, `H` representa a 2ª linha, e `I` na posição 12 é obrigatório, não o algarismo `1`.
- O turno informado pelo inspetor valida diretamente a posição 7 do código 2D: 1º turno = `G`, 2º = `H`, 3º = `J`. Se a letra não corresponder, o registro é DIVERGENTE mesmo que código 2D e tampografia tenham séries iguais ou que o OCR esteja incompleto.
- Se houver vários códigos na foto, a leitura é bloqueada. Séries diferentes no texto também ficam pendentes.
- Os resultados são COINCIDE, DIVERGENTE e PENDENTE. COINCIDE não substitui validação do processo de produção.
- Guarda UUID, data UTC, inspetor, turno informado, conteúdo original e utilizado, séries extraídas, origem, formato, confiança OCR, indicação de edição, confirmação visual e versão da regra. Fotos não são persistidas.
- O servidor central reúne os registros de texto de todos os inspetores. O nome é informado livremente no aparelho e não confirma a identidade da pessoa. O histórico fica acessível a quem tiver o link do aplicativo.

## Desenvolvimento

Node.js 24 ou superior. Para a execução local:

```text
npm ci
npm run build
npm test
npm start
```

Abra http://localhost:4173. O servidor local usa SQLite em `data/inspections.sqlite`; não é o banco da Cloudflare. O diretório dist contém a distribuição estática completa, incluindo os leitores, o modelo OCR e o service worker. Não abra o HTML diretamente por file://. Alterações no app requerem novo build. Um service worker novo ativa quando todas as abas da versão anterior forem fechadas.

## Cloudflare

O projeto inclui `worker.mjs`, `wrangler.jsonc` e a migração D1 em `migrations/`. Use Wrangler autenticado na conta Cloudflare da empresa:

1. Crie um banco D1 chamado `valida-laser` e atualize `database_id` em `wrangler.jsonc` com o ID retornado.
2. Aplique `migrations/0001_inspections.sql` ao banco remoto.
3. Execute `npm run build` e `wrangler deploy` para publicar os arquivos estáticos junto com a API.

Use HTTPS na URL final para permitir a câmera no celular. Após a publicação, informe nomes diferentes em dois aparelhos e confira se um registro feito no primeiro aparece no segundo. O modelo OCR e os arquivos de execução podem exigir uma transferência inicial grande; o primeiro carregamento em rede móvel pode levar tempo. Faça backup regular do banco D1.

## Leitores

- ZXing WASM: https://github.com/Sec-ant/zxing-wasm
- Tesseract.js: https://github.com/naptha/tesseract.js

Limitações: reflexos, falta de foco, fotos pequenas e caracteres muito próximos podem impedir a leitura. Não há garantia de precisão para a foto de referência ou para produção sem ensaios com as peças reais.

## Captura automática (câmera v2)
Ao tocar em Capturar, comparar e registrar, a mesma imagem fornece o código 2D e a tampografia. O OCR procura a identificação perto do código e faz duas passagens sem usar a série do código para corrigir o texto. Com duas leituras iguais e confiança OCR de pelo menos 80 em cada uma, compara automaticamente; caso contrário, registra PENDENTE. O limiar é heurístico e precisa de validação com peças reais. Cada tentativa guarda o texto OCR, confiança, região analisada e motivo da pendência. Recapturas geram novos registros. A opção de conferência manual continua disponível para revisão humana. A câmera precisa enquadrar o código e toda a linha da série; mantenha a peça na orientação da foto de referência.

## Leitura v3 — PaddleOCR local
O reconhecimento usa PP-OCRv5 mobile: imagem original e contraste na leitura inicial; na releitura detalhada, original e contraste da região detectada e do trecho da série ampliado. Na foto original de teste do A07, esse modelo leu o I corretamente, mas ainda confundiu 0 com O; a comparação por posição e a revisão manual permanecem necessárias. O modelo é reutilizado para reduzir o uso de memória no celular. Na leitura detalhada, as quatro tentativas devem identificar a mesma série com confiança de pelo menos 80; uma discordância mantém PENDENTE. Esse critério é heurístico, não uma garantia estatística. O código 2D nunca é usado para preencher/corrigir caracteres da tampografia. Os modelos e o processamento ficam locais. A primeira preparação offline é maior e a captura demora mais. A câmera solicita até 3840 × 2160 e foco contínuo quando o aparelho oferece suporte. Com a câmera aberta, toque na série ou use Refocar; a captura escolhe o quadro mais nítido entre três imagens próximas. Esses controles dependem do navegador e do hardware e não corrigem uma lente que não consegue focar à distância usada. O recorte automático assume a linha abaixo e à esquerda do Data Matrix, como no adaptador de referência. Para outros layouts, use a seleção manual.
Fontes e licenças dos modelos: dist/vendor/paddle/SOURCES.txt.  Instalação e precisão no celular precisam de validação no equipamento de produção.
