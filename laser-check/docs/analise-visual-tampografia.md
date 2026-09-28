# Análise visual da tampografia completa

Esta melhoria fica na branch `feature/analise-tampografia-completa`. O escopo é detectar defeitos **visuais** na impressão, além da comparação da série já existente. Diferenças no texto reconhecido pelo OCR não são, por si só, defeitos visuais.

## Situação atual

- A foto da câmera nativa é arquivada junto ao registro.
- A leitura automática recorta a linha da série perto do código 2D; ela não observa a tampografia inteira.
- Há dois layouts: 15W VE TYPE C BLACK (`GH44-03247A`) e 15W VE (`GH44-03086A`). Eles precisam de referências separadas.
- O inspetor confirma manualmente cada registro antes de salvá-lo.
- A amostra disponível do 15W VE enquadra a tampografia inteira. A foto disponível do TYPE C corta a parte esquerda da impressão e não serve como referência visual completa.

## Critérios para implementar e validar

1. Fotografar a área de impressão inteira com o celular usado na produção, sem mudar o fluxo de captura nativa.
2. Recusar a análise visual quando a área estiver cortada, desfocada ou com reflexo forte. Uma foto insuficiente não prova que a peça está defeituosa.
3. Alinhar a foto com referências aprovadas do **mesmo modelo** e comparar regiões de impressão, tolerando pequenas mudanças de ângulo, iluminação e posição.
4. Apontar a região suspeita e o motivo visual, preservando separadamente o resultado da série e a confirmação do inspetor.
5. Medir falsos alarmes e defeitos não detectados com fotos reais de peças boas e defeituosas, incluindo as capturadas pelo Galaxy A07. Ajustar os limiares somente após esse ensaio.

Antes de ativar uma classificação de defeito em produção, são necessárias fotos completas de referência de peças boas para cada modelo e exemplos reais dos defeitos que devem ser encontrados. A avaliação deve distinguir falha de impressão de problema na fotografia.
