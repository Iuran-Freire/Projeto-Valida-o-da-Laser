# 15W VE — EP-TA200I

Perfil confirmado para a operação atual a partir da especificação e da foto da peça. O SEC CODE é `GH44-03086A`; o conteúdo esperado do Data Matrix é esse prefixo, `+` e uma série de 14 caracteres, como `GH44-03086A+R37L8KH9K92IPA`.

O inspetor seleciona **15W VE** antes de fotografar. A série tampografada aparece após `NÚMERO DE SÉRIE:` e acima do Data Matrix na imagem de referência. O OCR lê esse texto sem preencher caracteres a partir do código 2D. As duas séries são comparadas posição por posição.

| Posição | Significado | Regra atual |
| --- | --- | --- |
| 1–3 | Família, cliente, classificação | `R37` fixo |
| 4 | Ano de fabricação | R=2021, T=2022, W=2023, X=2024, Y=2025, L=2026, P=2027, Q=2028 |
| 5 | Mês de fabricação | 1–9=jan–set, A=out, B=nov, C=dez |
| 6 | Dia de fabricação | 1–9=1–9, A–H=10–17, J–N=18–22, P–T=23–27, V–Y=28–31 |
| 7 | Turno | Operação atual: G=1º, H=2º, J=3º turno. Outras letras da tabela de linhas não são aceitas. |
| 8–10 | Contador | 001–ZZZ em base 33, sem I, O ou U |
| 11–14 | Versão, fornecedor, vendedor | `2IPA` fixo |

O exemplo fornecido representa 19/08/2026, 2º turno: `R37L8KH9K92IPA`. A tabela antiga ilustrava um final `IP3`; por orientação do inspetor, o final válido na produção atual é **`2IPA`**, também exigido no TYPE C. O modelo selecionado fica gravado no registro e no CSV. Um código com SEC CODE de outro modelo é divergente, mesmo se os 14 caracteres da série coincidirem.
