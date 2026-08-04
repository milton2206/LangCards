// Клиент проверки ПОНИМАНИЯ (фаза 6.2) — общий для аудирования и чтения.
// Ключ Claude API живёт на сервере (/api/listening, /api/reading), здесь —
// только запросы, кэши и проверка ответа. Механизм вопросов один: и диалог, и
// текст дают на выходе одинаковые вопросы «верно/неверно» + объяснение ошибки.
//
// Кэш «вместе с источником»:
//   • диалог + его вопросы — по языковой паре И источнику слов (переслушать и
//     перепройти без нового запроса к API);
//   • вопросы к тексту — по хешу самого текста (перепройти тот же текст даром).

import { apiFetch, makeApiError } from "./apiClient.js";

const DIALOGUES_KEY = "listeningDialogues"; // { "de-ru|mixed": [ {…диалог+вопросы}, … ] }
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
  recentTitles = [],
  // Заголовки недавних ТЕКСТОВ чтения этой темы — чтобы диалог не совпал с текстом.
  otherTitles = [],
  questionCount, // число вопросов на понимание (объём блока в движке заданий)
}) {
  let res;
  try {
    res = await apiFetch("/api/listening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "dialogue",
        learnLang,
        nativeLang,
        topic,
        level,
        // Активные слова уходят в промпт; сервер по source решает, как их вплетать.
        knownWords: takenWords,
        source,
        // Заголовки недавних диалогов этой темы — чтобы модель не повторяла сюжет.
        recentTitles,
        // …и недавних текстов той же темы — чтобы диалог не совпал с текстом.
        otherTitles,
        // Объём: сколько вопросов просить (сервер зажимает в свои рамки). Пусто —
        // серверный дефолт.
        questions: questionCount,
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
    // Тема — для фильтра «недавних сюжетов» (разнообразие в рамках темы).
    topic,
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

// Недавние диалоги пары И источника: [0] — самый свежий, он и на экране (один
// диалог за раз, «Новый диалог» его ЗАМЕНЯЕТ). Историю храним не для листалки, а
// чтобы (1) при перезаходе показать последний без запроса к API, (2) отдать
// модели заголовки недавних сюжетов ЭТОЙ темы для разнообразия. Как в чтении.
// Разные диалоги — разные записи в этой истории; вопросы лежат в том же наборе,
// что и диалог, поэтому кэш никогда не подменит вопросы чужим диалогом.
const MAX_DIALOGUES_PER_PAIR = 5;

function isValidDialogue(set) {
  return Boolean(
    set &&
      Array.isArray(set.dialogue) &&
      set.dialogue.length > 0 &&
      Array.isArray(set.questions) &&
      set.questions.length > 0,
  );
}

// Список наборов пары+источника. Терпим старый формат (одиночный объект) —
// приводим к массиву, чтобы прежний кэш не сломался.
function dialogueList(store, pairKey, source) {
  const raw = store[dialogueKey(pairKey, source)];
  if (Array.isArray(raw)) return raw;
  return raw ? [raw] : [];
}

/** Самый свежий диалог пары И источника, если он есть и целостен. */
export function loadDialogue(pairKey, source) {
  const store = loadJSON(DIALOGUES_KEY, {});
  const set = dialogueList(store, pairKey, source)[0];
  return isValidDialogue(set) ? set : null;
}

export function saveDialogue(pairKey, source, set) {
  const store = loadJSON(DIALOGUES_KEY, {});
  const key = dialogueKey(pairKey, source);
  const list = dialogueList(store, pairKey, source);
  // Новый диалог — первым (он и на экране); храним ограниченную историю.
  store[key] = [set, ...list].slice(0, MAX_DIALOGUES_PER_PAIR);
  saveJSON(DIALOGUES_KEY, store);
}

/**
 * Заголовки недавних диалогов ЭТОЙ темы (пара+источник) — для промпта генерации,
 * чтобы модель делала другой сюжет. Фильтр по теме: у старых наборов темы нет,
 * их пропускаем.
 */
export function recentDialogueTitles(pairKey, source, topic) {
  const store = loadJSON(DIALOGUES_KEY, {});
  return dialogueList(store, pairKey, source)
    .filter((s) => s && s.title && s.topic === topic)
    .map((s) => s.title);
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
    res = await apiFetch("/api/reading", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
