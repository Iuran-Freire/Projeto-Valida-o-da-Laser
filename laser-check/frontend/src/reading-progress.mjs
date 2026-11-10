// Reading progress shown to the inspector: turns the readers' technical
// progress messages into the reading step, a segment of the progress line and
// a plain-language detail. Pure functions, so they can be tested in Node.

export const READ_STEPS = Object.freeze(["photo", "code", "text", "review"]);

// Titles while the reading runs; the inspector only has to wait.
export const STEP_TITLES = Object.freeze({
  photo: "Abrindo a foto",
  code: "Lendo o código",
  text: "Lendo a tampografia",
});

const normalize = (text) =>
  String(text || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

// A segment of the line: it moves from `from` towards `to` (never reaching it)
// while the step runs; `tau` (s) is how fast it approaches.
function segment(step, from, to, tau, detail, extra = {}) {
  return { step, from, to, tau, detail, ...extra };
}

// "k de n" messages split their part of the line into n equal slices.
function counted(step, from, to, text, label, tau) {
  const match = text.match(/(\d+)\s+de\s+(\d+)/);
  if (!match) return segment(step, from, to, tau, label + ".");
  const total = Math.max(1, Number(match[2]));
  const index = Math.min(total, Math.max(1, Number(match[1])));
  const slice = (to - from) / total;
  return segment(
    step,
    from + slice * (index - 1),
    from + slice * index,
    tau,
    `${label} · ${index} de ${total}.`,
  );
}

const TEXT_WORDS =
  /impress|texto|serie|\bsn\b|linha|reconhecendo|tampografia|leitor|leitura detalhada/;
const CODE_WORDS = /\bqr\b|data matrix|code 93|codigo|\b2d\b|barras/;

// Default segment when a step starts without a progress message.
export function stepSegment(step) {
  return {
    photo: segment("photo", 0, 0.12, 1.5, "Preparando a foto para a leitura."),
    code: segment("code", 0.12, 0.3, 2.5, "Procurando o código na foto."),
    text: segment("text", 0.3, 0.55, 5, "Lendo o texto impresso na peça."),
  }[step] || null;
}

// Returns null for messages that are not reading progress.
// Only messages that announce work in progress; results and warnings shown at
// the end of a reading (e.g. "Código não encontrado…") are left untouched.
const PROGRESS_START =
  /^(lendo|localizando|reconhecendo|preparando leitor|leitor (alternativo|principal)|leitura detalhada|falha ao carregar o leitor|foto (recebida|carregada)|abrindo|[a-z0-9]+ · tentando)/;

export function interpretProgress(message) {
  const text = normalize(message).trim();
  if (!PROGRESS_START.test(text)) return null;
  if (/foto (recebida|carregada)|abrindo (a )?imagem/.test(text))
    return segment("photo", 0, 0.12, 1.5, "Preparando a foto para a leitura.");
  if (/leitor alternativo/.test(text)) {
    if (/memoria|imagem menor/.test(text))
      return segment("text", 0.6, 0.92, 6,
        "Segundo leitor · ajustando a leitura à memória deste celular.");
    if (/i\/1|5\/s/.test(text))
      return segment("text", 0.8, 0.95, 3,
        "Segundo leitor · conferindo letras parecidas (I/1, 5/S).");
    return counted("text", 0.6, 0.92, text,
      "Conferindo com um segundo leitor", 4);
  }
  if (/preparando leitor principal/.test(text)) {
    if (/download|primeira vez/.test(text))
      return segment("text", 0.3, 0.55, 45,
        "Primeiro uso neste celular: baixando o leitor de texto. Pode levar alguns minutos.",
        { slow: true });
    return segment("text", 0.3, 0.55, 8, "Carregando o leitor de texto.");
  }
  if (/pouca memoria|imagem menor/.test(text))
    return segment("text", 0.55, 0.9, 8,
      "Ajustando a leitura à memória deste celular.");
  if (/falha ao carregar o leitor|tentando novamente/.test(text))
    return segment("text", 0.3, 0.55, 10, "Conexão instável · tentando de novo.");
  if (/leitura detalhada|conferindo i\/1/.test(text))
    return counted("text", 0.55, 0.95, text,
      "Conferindo letras parecidas (I/1, 5/S)", 3);
  if (/lendo a linha da serie/.test(text))
    return counted("text", 0.55, 0.95, text, "Lendo a série impressa", 3);
  // Other products' messages are already plain language: keep them.
  const original = String(message).trim().replace(/…$/, ".");
  if (TEXT_WORDS.test(text)) return segment("text", 0.3, 0.55, 5, original);
  if (CODE_WORDS.test(text))
    return segment("code", 0.12, 0.3, 2.5,
      /contraste/.test(text) ? "Tentando outro contraste no código 2D." : "Procurando o código na foto.");
  return null;
}

// Position of the line `elapsedMs` after the segment started.
export function progressAt({ from, to, tau }, elapsedMs) {
  const seconds = Math.max(0, elapsedMs) / 1000;
  return from + (to - from) * (1 - Math.exp(-seconds / Math.max(0.1, tau)));
}

export function formatElapsed(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

// The line never goes back while a reading runs.
export function createProgressLine(now = () => Date.now()) {
  let active = false, started = 0, current = null, segmentStarted = 0, value = 0, slow = false;
  return {
    start() {
      active = true;
      started = segmentStarted = now();
      current = null; value = 0; slow = false;
    },
    running: () => active,
    enter(info) {
      if (!active) this.start();
      value = this.value();
      current = { ...info, from: Math.max(info.from, value), to: Math.max(info.to, value) };
      segmentStarted = now();
      slow = slow || !!info.slow;
    },
    value() {
      if (!current) return value;
      return Math.max(value, progressAt(current, now() - segmentStarted));
    },
    elapsed: () => (active ? now() - started : 0),
    slow: () => slow,
    stop() { active = false; current = null; },
  };
}
