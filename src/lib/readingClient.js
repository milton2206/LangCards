// Клиент режима чтения (фаза 6.1). Ключ Claude API живёт на сервере
// (/api/reading), здесь — только запросы и кэши:
//   • тексты — в localStorage по языковой паре: перечитать вчерашний текст
//     можно без нового запроса к API (и офлайн);
//   • объяснения грамматики — по хешу (предложение + родной язык), повторный
//     тап того же предложения мгновенный и по API не бьёт.

import { apiFetch, makeApiError } from "./apiClient.js";

const TEXTS_KEY = "readingTexts"; // { "de-ru|mixed": [ {…текст}, … ] }
const GRAMMAR_KEY = "readingGrammar"; // { "<hash>": { points: [] } }
const PHRASE_KEY = "readingPhrases"; // { "<hash>": { translation, lemma } }

// Сколько недавних текстов держим на пару+источник. Не для листалки (её нет —
// «Новый текст» заменяет текущий), а чтобы отдать модели заголовки недавних
// сюжетов для разнообразия и показать последний текст при перезаходе.
const MAX_TEXTS_PER_PAIR = 5;
// Сколько объяснений храним всего (по всем предложениям).
const MAX_GRAMMAR_ENTRIES = 200;
// Столько же переводов оборотов: записи короче объяснений, но и появляются чаще.
const MAX_PHRASE_ENTRIES = 200;

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

// ---------- Кэш текстов (по языковой паре И источнику слов) ----------
// Ключ включает источник (mine/mixed/new): тексты «только мои» и «только новые»
// — разные, и кэш не должен отдавать один вместо другого (фаза 6.1/6.2).

function textsKey(pairKey, source = "mixed") {
  return `${pairKey}|${source}`;
}

export function loadTexts(pairKey, source) {
  const store = loadJSON(TEXTS_KEY, {});
  const list = store[textsKey(pairKey, source)];
  return Array.isArray(list) ? list : [];
}

export function saveText(pairKey, source, text) {
  const store = loadJSON(TEXTS_KEY, {});
  const key = textsKey(pairKey, source);
  const list = Array.isArray(store[key]) ? store[key] : [];
  // Новый текст — первым; храним ограниченную историю.
  store[key] = [text, ...list].slice(0, MAX_TEXTS_PER_PAIR);
  saveJSON(TEXTS_KEY, store);
  return store[key];
}

/**
 * Запрашивает новый текст для чтения. Возвращает объект текста или бросает
 * Error с .code для локализованного сообщения: offline | server.
 *
 * sentences/sentenceLength не обязательны — их задаёт аудирование (фаза 6.2),
 * которое ходит за фразами сюда же, чтобы не заводить вторую генерацию.
 * Без них поведение режима чтения прежнее.
 */
export async function requestReadingText({
  learnLang,
  nativeLang,
  topic,
  level,
  knownWords = [],
  newWordShare,
  sentences,
  sentenceLength,
  source,
  gapChoices,
  recentTitles,
  // Заголовки недавних ДИАЛОГОВ аудирования этой темы — чтобы текст чтения не
  // повторял диалог (разные форматы должны расходиться).
  otherTitles,
}) {
  let res;
  try {
    res = await apiFetch("/api/reading", {
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
        sentences,
        sentenceLength,
        // Источник слов (mine/mixed/new) — уходит в тот же промпт генерации.
        source,
        // Аудирование «пропущенное слово» + «Новые»: просим у модели скрываемое
        // новое слово и варианты к нему.
        gapChoices,
        // Заголовки недавних текстов этой темы — чтобы модель не повторяла сюжет.
        recentTitles,
        // …и недавних диалогов той же темы — чтобы текст не совпал с диалогом.
        otherTitles,
      }),
    });
  } catch {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }

  if (!res.ok) {
    throw await makeApiError(res);
  }

  const data = await res.json();
  if (!data || !Array.isArray(data.sentences) || data.sentences.length === 0) {
    const err = new Error("server");
    err.code = "server";
    throw err;
  }
  return { ...data, createdAt: new Date().toISOString() };
}

// ---------- Перевод оборота в контексте предложения ----------

const phraseMemory = new Map(); // хеш → { translation }

// Годная запись кэша: и перевод, и словарная форма. Записи без формы остались
// от прошлой версии (тогда сервер её не отдавал) — их перезапрашиваем, иначе
// оборот нельзя было бы взять в изучение в словарном виде.
function usablePhrase(entry) {
  return Boolean(entry?.translation && entry?.lemma);
}

/**
 * Перевод ФРАГМЕНТА предложения (оборота) + его словарная форма, ОДНИМ вызовом.
 * Сначала память → localStorage → API, ровно как у объяснений грамматики. Ключ
 * кэша — хеш(фраза + языковая пара): тот же оборот второй раз (и в другом тексте
 * тоже) отдаётся мгновенно.
 *
 * Возвращает { translation, lemma }. lemma — тот вид, в котором оборот попадёт
 * в изучение («kept putting it off» → «to put something off»).
 *
 * Целое предложение сюда НЕ попадает: его перевод уже лежит в данных чтения,
 * и вызывающий код показывает готовый, не обращаясь к API (см. useWordLookup).
 */
export async function requestPhrase({
  phrase,
  sentence,
  learnLang,
  nativeLang,
  level,
}) {
  const clean = String(phrase ?? "").trim();
  if (!clean) return null;

  const key = hashKey(`${learnLang}|${nativeLang}|${clean}`);
  if (usablePhrase(phraseMemory.get(key))) return phraseMemory.get(key);

  const store = loadJSON(PHRASE_KEY, {});
  if (usablePhrase(store[key])) {
    phraseMemory.set(key, store[key]);
    return store[key];
  }

  let res;
  try {
    res = await apiFetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "phrase",
        phrase: clean,
        sentence: String(sentence ?? "").trim() || clean,
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
    throw await makeApiError(res);
  }

  const data = await res.json();
  const translation = String(data?.translation ?? "").trim();
  if (!translation) {
    const err = new Error("server");
    err.code = "server";
    throw err;
  }

  const value = { translation, lemma: String(data?.lemma ?? "").trim() || clean };
  phraseMemory.set(key, value);
  const keys = Object.keys(store);
  if (keys.length >= MAX_PHRASE_ENTRIES) {
    for (const k of keys.slice(0, keys.length - MAX_PHRASE_ENTRIES + 1)) {
      delete store[k];
    }
  }
  store[key] = value;
  saveJSON(PHRASE_KEY, store);
  return value;
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
    res = await apiFetch("/api/reading", {
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
    throw await makeApiError(res);
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
