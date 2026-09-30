# Verificações realizadas

- 8 testes automatizados passaram: extração do formato real, últimos 14 caracteres, preservação de zeros, divergência O/0 e I/1, ausência de rótulo, múltiplas séries, JSON/URL/GS1 e exportação CSV com proteção contra fórmulas.
- Fluxo no navegador: coincidência exibida; salvamento bloqueado antes da conferência; registro salvo e preservado após recarregar; histórico e consulta de detalhes disponíveis.
- O navegador concluiu o armazenamento dos arquivos para uso offline. A câmera ao vivo, a instalação no celular e o reinício sem rede ainda precisam de teste no aparelho de destino.
- A ferramenta WebMCP de consulta foi validada com entrada válida e rejeição de parâmetros inesperados.
- A foto fornecida foi decodificada como Data Matrix, com conteúdo GH44-03247A+R37L9QGE3Y2IPA. Série extraída: R37L9QGE3Y2IPA.
- O OCR automático da foto inteira não foi suficiente. Mesmo com recorte e contraste, confundiu caracteres. O aplicativo preserva a leitura original e exige conferência visual para registrar uma comparação completa. Não foi declarada precisão para produção.
- Existe um registro sintético AB123456789012 no histórico do endereço localhost, criado para testar persistência. Ele não representa uma inspeção real e não está incluído nos arquivos de distribuição.
- Publicação pendente: a revisão automática exigiu autorização explícita para enviar o código ao repositório privado do Sites e publicar o aplicativo.

## Atualização câmera v2
12 testes passaram. Teste no navegador com a foto de referência confirmou leitura do Data Matrix, duas passagens OCR e registro automático PENDENTE, incluindo texto original e motivo. Foram adicionadas duas tentativas reais dessa foto ao histórico local. A última confiança OCR foi 41%; a tampografia não foi identificada com segurança. A captura ao vivo deve ser validada no celular com foco e iluminação adequados. Não foi demonstrada comparação bem-sucedida da tampografia desta foto.

## Atualização câmera v3 — PaddleOCR
Foram comparados Tesseract com tratamentos de imagem, Tesseract best e os modelos oficiais PaddleOCR v5/v6. O PaddleOCR local passou a localizar a linha e extrair uma candidata completa na foto original. As passagens ainda confundem caracteres e discordam; o registro permaneceu PENDENTE. A política de comparação não usa a série do Data Matrix para corrigir a série impressa. Os 12 testes automatizados passaram. Modelos locais foram carregados com sucesso em WebAssembly no navegador. Ainda não há comprovação de leitura exata dessa amostra nem validação da câmera em um celular real.
