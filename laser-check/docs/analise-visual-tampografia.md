# Análise visual da tampografia completa

Esta melhoria fica na branch `feature/analise-tampografia-completa`. O escopo é detectar defeitos **visuais** na impressão, além da comparação da série já existente: falha ou ausência de impressão, borrões e desalinhamento. Diferenças no texto reconhecido pelo OCR não são, por si só, defeitos visuais.

## Situação atual

- A foto da câmera nativa é arquivada junto ao registro.
- A leitura automática recorta a linha da série perto do código 2D; ela não observa a tampografia inteira.
- Há dois layouts: 15W VE TYPE C BLACK (`GH44-03247A`) e 15W VE (`GH44-03086A`). Eles precisam de referências separadas.
- O inspetor confirma manualmente cada registro antes de salvá-lo.
- A amostra disponível do 15W VE enquadra a tampografia inteira. A foto disponível do TYPE C corta a parte esquerda da impressão e não serve como referência visual completa.

## Critérios para implementar e validar

1. Fotografar a área de impressão inteira com o celular usado na produção, sem mudar o fluxo de captura nativa.
2. Recusar a análise visual quando a área estiver cortada, desfocada ou com reflexo forte. Uma foto insuficiente não prova que a peça está defeituosa.
3. Alinhar a foto com o padrão de tampografia aprovado para o **mesmo modelo** e comparar regiões de impressão, tolerando pequenas mudanças de ângulo, iluminação e posição.
4. Quando houver suspeita, mostrar **divergência na impressão**, apontar a região e o motivo visual, e pedir ao inspetor que confira a foto capturada antes de confirmar o registro. O resultado da série continua visível separadamente.
5. Medir falsos alarmes e defeitos não detectados com fotos reais de peças boas e defeituosas, incluindo as capturadas pelo Galaxy A07. Ajustar os limiares somente após esse ensaio.

O usuário fornecerá o padrão de tampografia dos dois modelos como referência. Esses padrões definem o desenho esperado. Fotos reais de peças boas e defeituosas serão necessárias para calibrar e demonstrar a confiabilidade da detecção em fotografias do celular. Uma foto insuficiente deve gerar pedido de nova captura, não uma divergência da peça.
