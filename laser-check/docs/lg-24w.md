# LG 24W — levantamento da identificação

Estado: **referência parcial**. Não ativar este modelo para inspeção até receber a foto e a regra da marcação a laser/tampografia que será comparada com o QR.

Fontes fornecidas pelo inspetor: foto real da peça e arte de referência anexadas à conversa. O QR da foto real foi lido localmente com ZXing e retornou `IG9U2658889043905` (QR válido). O código de barras Code 93 retornou `EAY65888904` (válido); a etiqueta também mostra a revisão `(1.8)`.

## QR de 17 caracteres

| Posições | Exemplo da arte | Foto real | Interpretação da arte |
| --- | --- | --- | --- |
| 1 | `I` | `I` | Inventus Power, fixo |
| 2 | `A` | `G` | Ano: A=2020, B=2021, C=2022, D=2023, E=2024, F=2025, G=2026, H=2027, J=2028, K=2029 (sem I) |
| 3 | `3` | `9` | Mês: 1–9=jan–set, O=out, N=nov, D=dez |
| 4 | `1` | `U` | Dia: 1–9=1–9, A–H=10–17, J–N=18–22, P–X=23–31 (sem I/O) |
| 5 | `2` | `2` | Linha de produção; a arte cita 1, 2, 3, 4… |
| 6–13 | `65888904` | `65888904` | Part No. de oito dígitos |
| 14–17 | `0001` | `3905` | Número sequencial; a arte exemplifica 0001–9999 e variantes alfanuméricas |

Pela tabela da arte, o QR real indica **28/09/2026**, linha **2**, Part No. **65888904**, sequência **3905**. Isso é uma interpretação da referência; falta confirmar as regras em uso hoje na fábrica e qual marcação será comparada. O `EAY65888904` e a revisão `(1.8)` estão na etiqueta e não devem ser tratados como a série de 17 caracteres do QR.

Pendente: foto e tabela da tampografia/laser correspondente, campo exato que deve coincidir com o QR, regras atuais da linha e da sequência e critério de resultado visual para este modelo.
