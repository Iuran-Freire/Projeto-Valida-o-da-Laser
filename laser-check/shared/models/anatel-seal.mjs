// Selo Anatel, conferido numa etapa posterior à validação da laser.
// O número de homologação (linha de cima, HHHHH-AA-FFFFF) é o mesmo para todas
// as peças de um modelo: é ele que se valida. O código TAB (linha de baixo) é
// único de cada selo: só é registrado, para rastreabilidade.
// Como na laser, a leitura vem só da foto e nada é corrigido automaticamente.

export const ANATEL_STAGE = 'anatel';
export const ANATEL_RULE = 'anatel-homologacao-v1';

// A model can have more than one valid certificate (e.g. a renewed one while
// older seals are still in use): list every accepted number.
export const ANATEL_SEALS = Object.freeze({
  '15w-ve': Object.freeze({ numbers: Object.freeze(['03340-19-04952']), source: 'Foto de peça 15W VE (EP-TA200I) enviada pelo dono, 13/11/2026' }),
});

export const anatelSealFor = (model) =>
  Object.hasOwn(ANATEL_SEALS, model) ? ANATEL_SEALS[model] : null;

const unique = (values) => {
  const distinct = [...new Set(values)];
  return distinct.length === 1 ? distinct[0] : null;
};

// HHHHH-AA-FFFFF: the OCR may drop or change the dashes or add spaces, never digits.
export function extractAnatelNumber(text) {
  const values = [...String(text || '').matchAll(/(?:^|[^0-9])(\d{5})[ \t]*[-–—_.]?[ \t]*(\d{2})[ \t]*[-–—_.]?[ \t]*(\d{5})(?![0-9])/g)]
    .map((match) => `${match[1]}-${match[2]}-${match[3]}`);
  return unique(values);
}

export function extractAnatelTab(text) {
  return unique([...String(text || '').matchAll(/\bTAB[ \t]*[:.]?[ \t]*(\d{9})(?![0-9])/gi)].map((match) => match[1]));
}

const matches = (a, b) => [...a].filter((char, index) => char === b[index]).length;

// Compares the printed homologation number with the model's, position by position.
export function inspectAnatelSeal(model, printed) {
  return inspectAnatelNumbers(anatelSealFor(model)?.numbers || [], printed);
}

// Same comparison against a list of accepted numbers.
export function inspectAnatelNumbers(accepted, printed) {
  const read = extractAnatelNumber(printed);
  const tab = extractAnatelTab(printed);
  // The accepted number shown beside the reading: the same one, else the closest.
  const expected = !accepted.length ? null : !read ? accepted[0]
    : accepted.includes(read) ? read
    : accepted.reduce((best, number) => (matches(number, read) > matches(best, read) ? number : best));
  const length = Math.max(expected?.length || 0, read?.length || 0);
  const positions = expected && read
    ? Array.from({ length }, (_, index) => ({ position: index + 1, expected: expected[index] || '', read: read[index] || '', match: expected[index] === read[index] }))
    : [];
  if (!expected)
    return { status: 'PENDENTE', expected, read, tab, positions, reason: 'Este modelo ainda não tem número de homologação Anatel cadastrado.' };
  if (!read)
    return { status: 'PENDENTE', expected, read, tab, positions, reason: 'Número de homologação não identificado no selo. Confira a foto e digite o número da linha de cima.' };
  if (accepted.includes(read))
    return { status: 'COINCIDE', expected, read, tab, positions, reason: 'O número de homologação do selo é o do modelo.' };
  const first = positions.find((item) => !item.match);
  return { status: 'DIVERGENTE', expected, read, tab, positions, reason: `Número de homologação diferente do modelo: posição ${first.position} esperada ${first.expected}, lida ${first.read}. Confira o selo na peça.` };
}

// CSV of the seal stage (UTF-8 with BOM, ";"), cells guarded against formulas.
export function anatelCsv(records, labelOf = (model) => model) {
  const headings = ['ID', 'Data UTC', 'Data local', 'Inspetor', 'Turno', 'Modelo', 'Número do modelo', 'Número no selo', 'TAB do selo', 'Código 2D da peça', 'Resultado', 'Número editado', 'Confirmado', 'Motivo', 'Sincronização'];
  const cell = (value) => '"' + String(value ?? '').replace(/^[\s]*[=+@-]/, (m) => "'" + m).replaceAll('"', '""') + '"';
  const rows = records.map((r) => [r.id, r.date, new Date(r.date).toLocaleString('pt-BR'), r.inspector, r.shift || '', labelOf(r.model), r.codeSerial, r.printSerial, r.anatelTab, r.qr, r.status, r.printEdited ? 'sim' : 'não', r.confirmed ? 'sim' : 'não', r.reason, r.syncState]);
  return '\ufeff' + [headings, ...rows].map((row) => row.map(cell).join(';')).join('\r\n');
}
