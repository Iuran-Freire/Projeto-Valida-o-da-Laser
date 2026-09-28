# Análise visual da tampografia completa

Esta melhoria fica na branch `feature/analise-tampografia-completa`. O escopo é detectar defeitos **visuais** na impressão, além da comparação da série já existente: falha ou ausência de impressão, borrões e desalinhamento. Diferenças no texto reconhecido pelo OCR não são, por si só, defeitos visuais.

## Situação atual

- A foto da câmera nativa é arquivada junto ao registro.
- A leitura automática recorta a linha da série perto do código 2D; ela não observa a tampografia inteira.
- Há dois layouts: 15W VE TYPE C BLACK (`GH44-03247A`) e 15W VE (`GH44-03086A`). Eles precisam de referências separadas.
- O inspetor confirma manualmente cada registro antes de salvá-lo.
- A amostra disponível do 15W VE enquadra a tampografia inteira. Também foi recebida uma foto de peça boa TYPE C com toda a área impressa.
- Foram recebidas duas fotos completas de peças TYPE C com falha visual, uma evidente e outra sutil. Elas cobrem o enquadramento necessário, mas não substituem uma peça boa de referência.

## Padrões fornecidos

| Modelo | Referência | Áreas identificadas |
| --- | --- | --- |
| 15W VE TYPE C BLACK, EP-T1510 | [Arte da tampografia](referencias/15w-ve-type-c-black-padrao.png) | SAMSUNG em destaque; bloco de especificações elétricas e fabricante; linha NÚMERO DE SÉRIE; símbolos; código 2D à direita do texto no layout. A coluna WHITE da arte não pertence ao escopo atual. |
| 15W VE, EP-TA200I | [Padrão da tampografia](referencias/15w-ve-padrao.png) | SAMSUNG à esquerda e ADAPTADOR DE VIAGEM à direita; bloco de modelo/entrada/saída; série; código 2D abaixo; três símbolos à direita; identificação do fabricante e CNPJ na parte inferior. |

As séries e os módulos do código 2D mudam de peça para peça. A comparação visual do desenho fixo deve mascarar essas áreas variáveis, que continuam validadas pelo fluxo atual. A arte do TYPE C descreve a disposição e o conteúdo, mas não é uma fotografia da impressão no plástico; o padrão do 15W VE é uma imagem de baixa resolução. Ambos servem para definir zonas e critérios, não como modelos de pixels diretamente comparáveis a uma foto do Galaxy A07.

### Exemplos de falha recebidos

- [TYPE C, peça boa](referencias/type-c-boa.png): referência fotográfica do mesmo layout; série e módulos do Data Matrix são variáveis e não entram na comparação do desenho fixo.
- [TYPE C, falha evidente](referencias/type-c-falha-evidente.png): risco grande **sem tinta** atravessa a impressão. O defeito deve ser sinalizado como falha de impressão, ainda que o restante do texto continue legível.
- [TYPE C, falha sutil](referencias/type-c-falha-sutil.png): risco/falta de tinta nas letras **A/M** de SAMSUNG. A detecção precisa observar os traços das letras grandes, não somente reconhecer a palavra.

Os exemplos mostram por que não basta verificar se o OCR consegue ler palavras: ele pode reconhecer um texto mesmo com partes do traço apagadas. A análise deve localizar a falha no desenho impresso e exibir essa área na foto para revisão humana.
Um ensaio numérico com a foto boa e as duas defeituosas mostrou que pequenas diferenças de escala e enquadramento alteram muito a comparação de pixels. A implementação precisa registrar geometricamente a impressão e verificar sua qualidade antes de interpretar áreas sem tinta; não deve usar uma diferença global de pixels como decisão de defeito.

## Critérios para implementar e validar

1. Fotografar a área de impressão inteira com o celular usado na produção, sem mudar o fluxo de captura nativa.
2. Recusar a análise visual quando a área estiver cortada, desfocada ou com reflexo forte. Uma foto insuficiente não prova que a peça está defeituosa.
3. Alinhar a foto com o padrão de tampografia aprovado para o **mesmo modelo** e comparar regiões de impressão, tolerando pequenas mudanças de ângulo, iluminação e posição.
4. Quando houver suspeita, mostrar **divergência na impressão**, apontar a região e o motivo visual, e pedir ao inspetor que confira a foto capturada antes de confirmar o registro. O resultado da série continua visível separadamente.
5. Medir falsos alarmes e defeitos não detectados com fotos reais de peças boas e defeituosas, incluindo as capturadas pelo Galaxy A07. Ajustar os limiares somente após esse ensaio.

Os padrões dos dois modelos foram recebidos. Fotos reais de peças boas e defeituosas serão necessárias para calibrar e demonstrar a confiabilidade da detecção em fotografias do celular. Uma foto insuficiente deve gerar pedido de nova captura, não uma divergência da peça.
