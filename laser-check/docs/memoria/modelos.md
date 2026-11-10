# Modelos e formatos

| Modelo | Código no app | SEC CODE / PN | Cor da peça | Série impressa |
|---|---|---|---|---|
| M09030D · 15W Type C LowStandBy | `type-c` | `GH44-03247A` | **Preta**, letra clara | 14 caracteres, termina em `2IPA` |
| M09031D · 15W Type C | `type-c-m09031d` | `GH44-03247A` | **Preta**, letra clara | 14 caracteres, termina em `1IPA` |
| T09001T · 15W VE (EP-TA200I) | `15w-ve` | `GH44-03086A` | **Só branca**, letra escura | 14 caracteres, termina em `2IPA` |
| OPPO 45W | `oppo-45w` | PN `P38000P` | — | 12 caracteres, começa com `I`; código de 25 caracteres começando com `I*611401000196` |

- Samsung (Type C e 15W VE): série = `R37` + ano + mês + dia + turno + contador (3) + versão/fornecedor/vendedor. Tabelas completas em `docs/15w-ve.md` e `docs/15w-ve-type-c-black.md`.
- Turno na posição 7: G = 1º, H = 2º, J = 3º.
- 15W VE: a linha "NÚMERO DE SÉRIE:" fica **acima** do Data Matrix. Type C: abaixo e à esquerda.
- A polaridade (letra clara/escura) é definida por modelo em `frontend/src/ocr/model-reader-options.mjs` (`lightOnDark`). Confirmado pelo dono em 10/11/2026: 15W VE só existe branco; Type C é preto.
