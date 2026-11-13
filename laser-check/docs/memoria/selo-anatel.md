# Selo Anatel (aba própria)

Etapa **posterior** à validação da laser na linha, por isso é uma aba separada ("Selo Anatel"), com histórico e CSV próprios. O painel de inspetor, modelo e turno é compartilhado com a aba Inspeção.

## O que se valida
- **Número de homologação** (linha de cima do selo, formato `HHHHH-AA-FFFFF`): é o mesmo para todas as peças de um modelo. É o que o app compara, posição por posição.
- **TAB** (linha de baixo, 9 dígitos): muda de selo para selo. Só é **registrado**, não validado.
- Se o **código 2D da peça** aparecer na mesma foto, ele é lido e gravado no registro do selo (liga o selo à série da peça).

## Números cadastrados (`shared/models/anatel-seal.mjs`)
Cada modelo aceita uma **lista** de números (um modelo pode ter mais de um certificado válido).

| Modelo | Número(s) aceito(s) | Origem |
|---|---|---|
| T09001T · 15W VE (`15w-ve`) | 03340-19-04952 | Foto de peça 15W VE (EP-TA200I) enviada pelo dono, 13/11/2026; confirmado em duas peças (TAB 405134148 e 405066215) |

- Começamos só pelo 15W VE (decisão do dono, 13/11/2026). Type C e os demais modelos ainda não têm número: a aba bloqueia a foto e avisa. Para cadastrar, incluir o modelo em `ANATEL_SEALS`.
- Houve uma amostra de selo **14099-21-04952** (TAB 079329356) cujo modelo ficou indefinido (primeiro dito Type C LowStandBy): não está cadastrada.

## Regras
- Número igual ao do modelo → **COINCIDE**; diferente → **DIVERGENTE**; não lido → **PENDENTE** (o inspetor pode digitar o número conferindo a foto; a edição fica registrada).
- Letras no lugar de dígitos não são "corrigidas": a leitura fica pendente.
- Registro exige foto, inspetor cadastrado, turno e confirmação. O servidor confere de novo (etapa `stage: "anatel"`); as regras da laser por modelo não se aplicam a esses registros, e o turno é o do inspetor da etapa.
- O histórico e o CSV da laser não mostram registros do selo (e vice-versa).

## Testes
`tests/anatel-seal.test.mjs` (regra), `tests/worker.test.mjs` (servidor). Testado de ponta a ponta como iPhone 11 com foto real de peça 15W VE na mão: coincide (03340-19-04952, TAB 405134148) e fica ligado à peça R37LBCG5GF2IPA pelo 2D; selo 14099-21-04952 no 15W VE dá divergente; Type C e OPPO bloqueados.
