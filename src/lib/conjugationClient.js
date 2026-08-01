// Клиент таблицы спряжения (кнопка «Формы» на карточке и в чтении). Ключ Claude
// API живёт на сервере (/api/conjugation), здесь — только запрос и КЭШ.
//
// КЭШ ДВУХУРОВНЕВЫЙ, потому что спрашивать могут ЛЮБУЮ форму глагола:
//   tables: хеш(язык|ЛЕММА) → { isVerb, lemma, conjugation }  — сама таблица;
//   forms:  хеш(язык|ФОРМА) → лемма | ""                      — указатель.
// Получив таблицу, мы индексируем в forms ВСЕ формы из неё (и саму лемму), так
// что πηγαίνει, πηγαίνουμε и πήγα после первой генерации отдаются из кэша и по
// API больше не бьют — это одна и та же таблица. Пустая строка в forms — это
// негативный кэш («не глагол»), чтобы не спрашивать одно и то же дважды.

import { authHeaders, makeApiError } from "./apiClient.js";

const TABLES_KEY = "conjugationTables"; // { "<hash>": { isVerb, lemma?, conjugation? } }
const FORMS_KEY = "conjugationForms"; // { "<hash>": "<лемма>" | "" }
const MAX_TABLES = 200; // потолок, чтобы localStorage не рос бесконечно
const MAX_FORMS = 2000; // форм на порядок больше: ~18 на каждую таблицу

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

// Приведение формы к ключу поиска: регистр и лишние пробелы не должны
// порождать разные записи. Диакритику НЕ трогаем — в греческом она смыслоразличительна.
export function normalizeForm(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

// Все варианты написания одной ячейки таблицы, по которым человек может тапнуть:
// целиком («θα πάω») и последнее слово («πάω») — в тексте тапают по одному слову.
function formVariants(cell) {
  const norm = normalizeForm(cell);
  if (!norm) return [];
  const parts = norm.split(" ");
  return parts.length > 1 ? [norm, parts[parts.length - 1]] : [norm];
}

const memoryTables = new Map(); // хеш(язык|лемма) → значение таблицы
const memoryForms = new Map(); // хеш(язык|форма) → лемма | ""

function tableKey(learnLang, lemma) {
  return hashKey(`${learnLang}|${normalizeForm(lemma)}`);
}
function formKey(learnLang, form) {
  return hashKey(`${learnLang}|${normalizeForm(form)}`);
}

// Подрезает объект-кэш до лимита (выкидывает самые старые ключи).
function trim(store, max) {
  const keys = Object.keys(store);
  if (keys.length <= max) return store;
  for (const k of keys.slice(0, keys.length - max)) delete store[k];
  return store;
}

/**
 * Таблица спряжения по слову В ЛЮБОЙ ФОРМЕ. Порядок: память → localStorage → API.
 * Возвращает { isVerb:false } | { isVerb:true, lemma, conjugation:{present,past,future} }.
 * Бросает Error с .code (offline | server | rateLimit | …) для сообщения в UI.
 */
export async function requestConjugation({ word, learnLang, nativeLang }) {
  const clean = String(word ?? "").trim();
  if (!clean) return { isVerb: false };

  const fKey = formKey(learnLang, clean);

  // 1) Знаем ли мы уже, к какой лемме относится эта форма?
  const formsStore = loadJSON(FORMS_KEY, {});
  const knownLemma = memoryForms.has(fKey) ? memoryForms.get(fKey) : formsStore[fKey];
  if (knownLemma !== undefined) {
    memoryForms.set(fKey, knownLemma);
    if (!knownLemma) return { isVerb: false }; // негативный кэш
    const tKey = tableKey(learnLang, knownLemma);
    const tablesStore = loadJSON(TABLES_KEY, {});
    const cached = memoryTables.has(tKey) ? memoryTables.get(tKey) : tablesStore[tKey];
    if (cached) {
      memoryTables.set(tKey, cached);
      return cached;
    }
  }

  // 2) Ничего не знаем — спрашиваем сервер.
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
  const isVerb = Boolean(data && data.isVerb && data.conjugation);
  const lemma = isVerb ? String(data.lemma || clean).trim() : "";
  const value = isVerb
    ? { isVerb: true, lemma, conjugation: data.conjugation }
    : { isVerb: false };

  // 3) Раскладываем по кэшам. Таблица — под ЛЕММОЙ; в указатель кладём и
  //    спрошенную форму, и лемму, и ВСЕ формы из таблицы: любая из них теперь
  //    открывается мгновенно, без обращения к API.
  const forms = loadJSON(FORMS_KEY, {});
  forms[fKey] = lemma;
  memoryForms.set(fKey, lemma);

  if (isVerb) {
    const tKey = tableKey(learnLang, lemma);
    const tables = loadJSON(TABLES_KEY, {});
    tables[tKey] = value;
    memoryTables.set(tKey, value);
    saveJSON(TABLES_KEY, trim(tables, MAX_TABLES));

    const index = (raw) => {
      for (const variant of formVariants(raw)) {
        const k = formKey(learnLang, variant);
        forms[k] = lemma;
        memoryForms.set(k, lemma);
      }
    };
    index(lemma);
    for (const tense of Object.values(data.conjugation)) {
      for (const form of Object.values(tense || {})) index(form);
    }
  }

  saveJSON(FORMS_KEY, trim(forms, MAX_FORMS));
  return value;
}
