# 15W VE TYPE C — BLACK

Escopo confirmado pelo inspetor: usar somente o SEC CODE `GH44-03247A` (BLACK). A linha de produção não importa para a conferência; somente o turno. A medição no canto superior esquerdo da arte e o modelo WHITE ficam fora desta validação por enquanto.

O código 2D tem o formato `GH44-03247A+` seguido de 14 caracteres. A tampografia traz a mesma série após `:`. As duas séries devem coincidir posição por posição.

| Posição | Significado | Regra |
| --- | --- | --- |
| 1–3 | Família, cliente, classificação | `R37` fixo |
| 4 | Ano de fabricação | T=2022, W=2023, X=2024, Y=2025, L=2026, P=2027, Q=2028, S=2029, Z=2030, B=2031, C=2032, D=2033, F=2034, G=2035, H=2036, J=2037, K=2038, M=2039, N=2040 |
| 5 | Mês de fabricação | 1–9=jan–set, A=out, B=nov, C=dez |
| 6 | Dia de fabricação | 1–9=1–9, A–H=10–17, J–N=18–22, P–T=23–27, V–Y=28–31 |
| 7 | Turno | A/D/G=1º, B/E/H=2º, C/F/J=3º turno; a linha não é critério de rejeição |
| 8–10 | Contador | 001–ZZZ em base 33, sem I, O ou U |
| 11 | Versão de produção | 0=desenvolvimento, 1=produção, 2 em diante=alterações; não é texto fixo |
| 12–13 | Fornecedor | `IP` fixo |
| 14 | Código do vendedor | `A` fixo |

O último trecho fixo é `IPA`, com **I** maiúsculo. A versão na posição 11 pode variar. O turno selecionado pelo inspetor deve corresponder ao grupo da letra na posição 7 do código 2D, independentemente da linha. A indicação da arte para a data impressa no rótulo é dia, mês, ano; a conferência visual dessa data fora da série ainda não faz parte da leitura.
