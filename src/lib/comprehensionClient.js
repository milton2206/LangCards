// Клиент проверки ПОНИМАНИЯ (фаза 6.2) — общий для аудирования и чтения.
// Ключ Claude API живёт на сервере (/api/listening, /api/reading), здесь —
// только запросы, кэши и проверка ответа. Механизм вопросов один: и диалог, и
// текст дают на выходе одинаковые вопросы «верно/неверно» + объяснение ошибки.
//
// Кэш «вместе с источником»:
//   • диалог + его вопросы — по языковой паре И источнику слов (переслушать и
//     перепройти без нового запроса к API);
//   • вопросы к тексту — по хешу самого текста (перепройти тот же текст даром).

import { authHeaders, makeApiError } from "./apiClient.js";

const DIALOGUES_KEY = "listeningDialogues"; // { "de-ru|mixed": { …диалог+вопросы } }
const QUESTIONS_KEY = "readingQuestions"; // { "<hash>": { questions: [] } }

// Сколько наборов вопросов к текстам держим (по всем текстам) — без разрастания.
const MAX_QUESTION_ENTRIES = 60;

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

// Короткий стабильный хеш (djb2) — ключ кэша, криптостойкость не нужна.
function hashKey(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i += 1) {
    h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// ---------- Проверка ответа (общая, тривиальная) ----------

/** Ответ «верно/неверно» засчитан, если совпал с истинным значением утверждения. */
export function checkComprehension(answer, chosen) {
  return { correct: Boolean(answer) === Boolean(chosen) };
}

// ---------- Диалог + вопросы (аудирование) ----------

/**
 * Запрашивает мини-диалог вокруг активных слов пользователя и вопросы к нему.
 * Возвращает готовый набор { format:"dialogue", source, dialogue, questions, … }
 * или бросает Error с .code (offline | server | rateLimit …) для локализации.
 */
export async function requestDialogueSet({
  learnLang,
  nativeLang,
  topic,
  level,
  takenWords = [],
  source = "mixed",
}) {
  let res;
  try {
    res = await fetch("/api/listening", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        action: "dialogue",
        learnLang,
        nativeLang,
        topic,
        level,
        // Активные слова уходят в промпт; сервер по source решает, как их вплетать.
        knownWords: takenWords,
        source,
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
  const dialogue = Array.isArray(data?.dialogue) ? data.dialogue : [];
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  if (dialogue.length === 0 || questions.length === 0) {
    const err = new Error("server");
    err.code = "server";
    throw err;
  }
  return {
    format: "dialogue",
    source,
    title: data.title || "",
    titleTranslation: data.titleTranslation || "",
    dialogue,
    questions,
    // Прогресс по вопросам — в наборе, чтобы переживал уход с экрана.
    index: 0,
    correctCount: 0,
    createdAt: new Date().toISOString(),
  };
}

function dialogueKey(pairKey, source = "mixed") {
  return `${pairKey}|${source}`;
}

/** Текущий диалог пары И источника, если он есть и целостен. */
export function loadDialogue(pairKey, source) {
  const store = loadJSON(DIALOGUES_KEY, {});
  const set = store[dialogueKey(pairKey, source)];
  return set &&
    Array.isArray(set.dialogue) &&
    set.dialogue.length > 0 &&
    Array.isArray(set.questions) &&
    set.questions.length > 0
    ? set
    : null;
}

export function saveDialogue(pairKey, source, set) {
  const store = loadJSON(DIALOGUES_KEY, {});
  store[dialogueKey(pairKey, source)] = set;
  saveJSON(DIALOGUES_KEY, store);
}

// ---------- Вопросы к тексту (чтение) ----------

/** Ключ кэша вопросов = хеш(язык + сам текст): тот же текст — те же вопросы. */
export function questionsKeyFor(learnLang, sentences) {
  const passage = (Array.isArray(sentences) ? sentences : [])
    .map((s) => s.text)
    .join(" ");
  return hashKey(`${learnLang}|${passage}`);
}

/** Вопросы к тексту из кэша (перепройти тот же текст без запроса к API). */
export function loadTextQuestions(key) {
  const store = loadJSON(QUESTIONS_KEY, {});
  const entry = store[key];
  return entry && Array.isArray(entry.questions) && entry.questions.length > 0
    ? entry.questions
    : null;
}

export function saveTextQuestions(key, questions) {
  const store = loadJSON(QUESTIONS_KEY, {});
  const keys = Object.keys(store);
  // Подрезаем кэш, чтобы localStorage не рос бесконечно.
  if (keys.length >= MAX_QUESTION_ENTRIES) {
    for (const k of keys.slice(0, keys.length - MAX_QUESTION_ENTRIES + 1)) {
      delete store[k];
    }
  }
  store[key] = { questions };
  saveJSON(QUESTIONS_KEY, store);
}

/**
 * Запрашивает вопросы на понимание к готовому тексту (режим чтения). Тот же
 * механизм, что и у диалога, только источник — переданные предложения.
 * Возвращает массив вопросов или бросает Error с .code.
 */
export async function requestTextQuestions({
  learnLang,
  nativeLang,
  level,
  sentences = [],
}) {
  const passage = sentences.map((s) => s.text).join(" ");
  let res;
  try {
    res = await fetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        action: "questions",
        passage,
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
  const questions = Array.isArray(data?.questions) ? data.questions : [];
  if (questions.length === 0) {
    const err = new Error("server");
    err.code = "server";
    throw err;
  }
  return questions;
}
