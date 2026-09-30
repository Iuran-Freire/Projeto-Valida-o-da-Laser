// Select only printed EAY fields, without consulting either machine-readable code.
// Keep all candidates and preserve letters/numbers, including invalid ones.
export function selectLGPrintedText(raw){
  return [...String(raw||'').matchAll(/\bE[ \t]*A[ \t]*Y[ \t]*[A-Za-z0-9]+(?:[ \t]*\([0-9. \t]+\))?/gi)].map(match=>match[0].trim()).join('\n');
}
