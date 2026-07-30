// Клиент таблицы спряжения (кнопка на карточке глагола). Ключ Claude API живёт
// на сервере (/api/conjugation), здесь — только запрос и КЭШ по слову: повторный
// запрос той же формы мгновенный и по API не бьёт (память процесса + localStorage).

import { authHeaders, makeApiError } from "./apiClient.js";

const CONJ_KEY = "conjugationCache"; // { "<hash>": { isVerb, conjugation? } }
const MAX_ENTRIES = 200; // потолок, чтобы localStorage не рос бесконечно

// Короткий стабильный хеш строки (djb2) — тот же приём, что и в кэше грамматики.
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

const memory = new Map(); // хеш → { isVerb, conjugation? }

/**
 * Таблица спряжения глагола. Сначала память → localStorage → API.
 * Ключ кэша: хеш(изучаемый язык + слово) — форма зависит только от них.
 * Возвращает { isVerb:false } | { isVerb:true, conjugation:{present,future,past} }.
 * Бросает Error с .code (offline | server | rateLimit | …) для сообщения в UI.
 */
export async function requestConjugation({ word, learnLang, nativeLang }) {
  const clean = String(word ?? "").trim();
  if (!clean) return { isVerb: false };

  const key = hashKey(`${learnLang}|${clean}`);
  if (memory.has(key)) return memory.get(key);

  const store = loadJSON(CONJ_KEY, {});
  if (store[key]) {
    memory.set(key, store[key]);
    return store[key];
  }

  let res;
  try {
    res = await fetch("/api/conjugation", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ word: clean, learnLang, nativeLang }),
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
  const value =
    data && data.isVerb && data.conjugation
      ? { isVerb: true, conjugation: data.conjugation }
      : { isVerb: false };

  memory.set(key, value);
  // Подрезаем кэш, чтобы localStorage не рос бесконечно.
  const keys = Object.keys(store);
  if (keys.length >= MAX_ENTRIES) {
    for (const k of keys.slice(0, keys.length - MAX_ENTRIES + 1)) {
      delete store[k];
    }
  }
  store[key] = value;
  saveJSON(CONJ_KEY, store);
  return value;
}
