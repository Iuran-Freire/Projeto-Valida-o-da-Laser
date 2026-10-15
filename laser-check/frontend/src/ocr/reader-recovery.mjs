export function isMemoryError(error) {
  return /failed to allocate|out of memory|memory access out of bounds|cannot enlarge memory|could not allocate|allocation failed/i.test(String(error?.message || error));
}

// Keep the compatible reader for this page's lifetime after a memory failure.
export function createReaderRecovery() {
  let compatible = false;
  return async (primary, fallback, notify) => {
    if (!compatible) {
      try { return await primary(); }
      catch (error) {
        if (!isMemoryError(error)) throw error;
        compatible = true;
      }
    }
    notify('Modo de compatibilidade · lendo a mesma foto…');
    return fallback();
  };
}

export function compatibleItems(data) {
  const lines = (data.blocks || []).flatMap(block =>
    (block.paragraphs || []).flatMap(paragraph => paragraph.lines || []));
  return lines.filter(line => line.text?.trim()).map(line => {
    const {x0, y0, x1, y1} = line.bbox;
    return {text: line.text.trim(), score: (line.confidence || 0) / 100,
      poly: [[x0,y0],[x1,y0],[x1,y1],[x0,y1]]};
  });
}
