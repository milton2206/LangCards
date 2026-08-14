// Сложность аудирования (фаза 6.2). Два параметра в одном выборе:
//   rate   — скорость речи Google TTS (родное замедление, не растянутый звук);
//   length — длина фразы, которую просим у генерации 6.1.
// Три уровня, а не плавные ползунки: выбор занимает секунду, а разница между
// соседними уровнями слышна сразу.
//
// Значения rate обязаны совпадать с TTS_RATES в lib/tts.js — там список
// закрытый (каждая скорость это своя запись в общем кэше озвучки).
export const LISTENING_LEVELS = [
  { id: "slow", rate: 0.7, length: "short" },
  { id: "normal", rate: 1, length: "medium" },
  { id: "fast", rate: 1.15, length: "long" },
];

export const DEFAULT_LISTENING_LEVEL = "normal";

const STORAGE_KEY = "listeningLevel";

export function getListeningLevel(id) {
  return (
    LISTENING_LEVELS.find((l) => l.id === id) ||
    LISTENING_LEVELS.find((l) => l.id === DEFAULT_LISTENING_LEVEL)
  );
}

// Выбор сохраняется между сессиями — как количество карточек и тип генерации.
export function loadListeningLevel() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return LISTENING_LEVELS.some((l) => l.id === raw)
      ? raw
      : DEFAULT_LISTENING_LEVEL;
  } catch {
    return DEFAULT_LISTENING_LEVEL;
  }
}

export function saveListeningLevel(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

// ---------- Скорость озвучки в ЧТЕНИИ ----------
// Тот же закрытый набор скоростей, что и в аудировании: список rate один на
// приложение (и совпадает с TTS_RATES на сервере), потому что каждая скорость —
// отдельная запись в общем кэше озвучки. Второго набора не заводим.
//
// Отличие от аудирования только в том, ЧТО выбирается: там уровень сложности
// (скорость + длина фразы), здесь — просто скорость чтения вслух. Поэтому свой
// ключ хранения: замедлять текст и усложнять аудирование — разные решения.
//
// Замедленные варианты заранее НЕ греются: прогрева в чтении нет вовсе, аудио
// запрашивается по нажатию. Так медленная озвучка стоит квоты ровно тогда,
// когда её действительно попросили.
const READING_RATE_KEY = "readingRate";

export function loadReadingRate() {
  try {
    const raw = localStorage.getItem(READING_RATE_KEY);
    return LISTENING_LEVELS.some((l) => l.id === raw)
      ? raw
      : DEFAULT_LISTENING_LEVEL;
  } catch {
    return DEFAULT_LISTENING_LEVEL;
  }
}

export function saveReadingRate(id) {
  try {
    localStorage.setItem(READING_RATE_KEY, id);
  } catch {
    // ignore
  }
}

// Режим аудирования (фаза 6.2). ОСНОВНОЙ выбор на экране:
//   comprehension — понимание: звучит мини-диалог, потом вопросы «верно/неверно»
//                   с объяснением ошибки (формат Hörverstehen с экзаменов);
//   words         — слова: старые форматы «пропущенное слово» / «на слух».
// По умолчанию — понимание: именно оно проверяет понимание речи, а не узнавание
// отдельного слова. Старые форматы оставлены как дополнительный выбор.
export const LISTENING_MODES = ["comprehension", "words"];
export const DEFAULT_LISTENING_MODE = "comprehension";
const MODE_KEY = "listeningMode";

export function loadListeningMode() {
  try {
    const raw = localStorage.getItem(MODE_KEY);
    return LISTENING_MODES.includes(raw) ? raw : DEFAULT_LISTENING_MODE;
  } catch {
    return DEFAULT_LISTENING_MODE;
  }
}

export function saveListeningMode(id) {
  try {
    localStorage.setItem(MODE_KEY, id);
  } catch {
    // ignore
  }
}

// Формат «слов» внутри режима «words» (фаза 6.2):
//   gap        — «пропущенное слово»: звучит всё предложение, одно слово скрыто;
//   soundalike — «на слух»: звучит слово, варианты похожи по звучанию (сложнее).
// Второй формат — для продвинутых: включается, когда пользователь его выбрал,
// а на высоких уровнях (B2/C1) он же по умолчанию.
export const LISTENING_FORMATS = ["gap", "soundalike"];
export const DEFAULT_LISTENING_FORMAT = "gap";
const FORMAT_KEY = "listeningFormat";
const HIGH_LEVELS = new Set(["b2", "c1"]);

// Формат по умолчанию для уровня: на высоких — сразу «на слух».
export function defaultFormatForLevel(level) {
  return HIGH_LEVELS.has(String(level || "").toLowerCase())
    ? "soundalike"
    : DEFAULT_LISTENING_FORMAT;
}

// Сохранённый выбор пользователя главнее; если его нет — берём умолчание уровня.
export function loadListeningFormat(level) {
  try {
    const raw = localStorage.getItem(FORMAT_KEY);
    if (LISTENING_FORMATS.includes(raw)) return raw;
  } catch {
    // ignore
  }
  return defaultFormatForLevel(level);
}

export function saveListeningFormat(id) {
  try {
    localStorage.setItem(FORMAT_KEY, id);
  } catch {
    // ignore
  }
}
