// Клиент режима чтения (фаза 6.1). Ключ Claude API живёт на сервере
// (/api/reading), здесь — только запросы и кэши:
//   • тексты — в localStorage по языковой паре: перечитать вчерашний текст
//     можно без нового запроса к API (и офлайн);
//   • объяснения грамматики — по хешу (предложение + родной язык), повторный
//     тап того же предложения мгновенный и по API не бьёт.

const TEXTS_KEY = "readingTexts"; // { "de-ru": [ {…текст}, … ] }
const GRAMMAR_KEY = "readingGrammar"; // { "<hash>": { points: [] } }

// Сколько текстов держим на пару — история «перечитать», без разрастания хранилища.
const MAX_TEXTS_PER_PAIR = 5;
// Сколько объяснений храним всего (по всем предложениям).
const MAX_GRAMMAR_ENTRIES = 200;

// Короткий стабильный хеш строки (djb2). Криптостойкость не нужна — это ключ кэша.
function hashKey(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // хранилище переполнено/недоступно — кэш не обязателен, работаем дальше
  }
}

// ---------- Кэш текстов (по языковой паре) ----------

export function loadTexts(pairKey) {
  const store = loadJSON(TEXTS_KEY, {});
  const list = store[pairKey];
  return Array.isArray(list) ? list : [];
}

export function saveText(pairKey, text) {
  const store = loadJSON(TEXTS_KEY, {});
  const list = Array.isArray(store[pairKey]) ? store[pairKey] : [];
  // Новый текст — первым; храним ограниченную историю.
  store[pairKey] = [text, ...list].slice(0, MAX_TEXTS_PER_PAIR);
  saveJSON(TEXTS_KEY, store);
  return store[pairKey];
}

/**
 * Запрашивает новый текст для чтения. Возвращает объект текста или бросает
 * Error с .code для локализованного сообщения: offline | server.
 */
export async function requestReadingText({
  learnLang,
  nativeLang,
  topic,
  level,
  knownWords = [],
  newWordShare,
}) {
  let res;
  try {
    res = await fetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "text",
        learnLang,
        nativeLang,
        // Уровень — обязательный ориентир генерации: при нуле взятых слов он
        // единственный, поэтому доходить до сервера должен всегда.
        topic,
        level,
        knownWords,
        newWordShare,
      }),
    });
  } catch {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }

  if (!res.ok) {
    let serverMsg = null;
    try {
      const data = await res.json();
      if (data && data.error) serverMsg = data.error;
    } catch {
      // тело не JSON — покажем общий текст
    }
    const err = new Error(serverMsg || "server");
    err.code = "server";
    err.raw = serverMsg || null;
    throw err;
  }

  const data = await res.json();
  if (!data || !Array.isArray(data.sentences) || data.sentences.length === 0) {
    const err = new Error("server");
    err.code = "server";
    throw err;
  }
  return { ...data, createdAt: new Date().toISOString() };
}

// ---------- Кэш объяснений грамматики ----------

const grammarMemory = new Map(); // хеш → { points }

/**
 * Объяснение грамматики предложения. Сначала память → localStorage → API.
 * Ключ кэша: хеш(предложение + родной язык), как и требуется.
 */
export async function requestGrammar({
  sentence,
  learnLang,
  nativeLang,
  level,
}) {
  const clean = String(sentence ?? "").trim();
  if (!clean) return null;

  const key = hashKey(`${nativeLang}|${clean}`);
  if (grammarMemory.has(key)) return grammarMemory.get(key);

  const store = loadJSON(GRAMMAR_KEY, {});
  if (store[key]) {
    grammarMemory.set(key, store[key]);
    return store[key];
  }

  let res;
  try {
    res = await fetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "grammar",
        sentence: clean,
        learnLang,
        nativeLang,
        level,
      }),
    });
  } catch {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }

  if (!res.ok) {
    let serverMsg = null;
    try {
      const data = await res.json();
      if (data && data.error) serverMsg = data.error;
    } catch {
      // тело не JSON
    }
    const err = new Error(serverMsg || "server");
    err.code = "server";
    err.raw = serverMsg || null;
    throw err;
  }

  const data = await res.json();
  if (!data || !Array.isArray(data.points) || data.points.length === 0) {
    const err = new Error("server");
    err.code = "server";
    throw err;
  }

  const value = { points: data.points };
  grammarMemory.set(key, value);
  // Подрезаем кэш, чтобы localStorage не рос бесконечно.
  const keys = Object.keys(store);
  if (keys.length >= MAX_GRAMMAR_ENTRIES) {
    for (const k of keys.slice(0, keys.length - MAX_GRAMMAR_ENTRIES + 1)) {
      delete store[k];
    }
  }
  store[key] = value;
  saveJSON(GRAMMAR_KEY, store);
  return value;
}
