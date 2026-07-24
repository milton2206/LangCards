// Клиент теста на уровень (фаза 6.3).
//
// Задания читаются НАПРЯМУЮ из общей таблицы placement_items (RLS разрешает
// select всем авторизованным) — это дёшево и не трогает ИИ. Серверный эндпоинт
// /api/placement нужен ровно для одного случая: банк этого языка ещё пуст, его
// надо наполнить один раз. Дальше — только чтение.
//
// Сверх того банк кэшируется в localStorage по изучаемому языку: повторный тест
// (и тест по второму языку той же пары) не идёт ни в API, ни даже в Supabase.

import { supabase } from "./supabase.js";
import { PLACEMENT_LEVELS } from "./placementAlgorithm.js";

const CACHE_KEY = "placementBank"; // { de: { items: [...], savedAt } }
// Банк почти не меняется, но и вечно держать первый (возможно неполный) снимок
// не хочется — через месяц перечитываем.
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// Ниже этого числа заданий считаем кэш неполноценным и перечитываем банк.
const MIN_USABLE_ITEMS = 40;

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveCache(learnLang, items) {
  try {
    const store = loadCache();
    store[learnLang] = { items, savedAt: Date.now() };
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // хранилище переполнено/недоступно — кэш не обязателен, тест работает
  }
}

/** Задания по уровням: { a1: [...], a2: [...], … } — в таком виде их ждёт алгоритм. */
export function groupByLevel(items) {
  const byLevel = Object.fromEntries(PLACEMENT_LEVELS.map((l) => [l, []]));
  for (const item of items) {
    if (byLevel[item.level]) byLevel[item.level].push(item);
  }
  return byLevel;
}

function toItem(row) {
  return {
    id: row.id,
    level: row.level,
    type: row.type,
    question: row.question,
    options: Array.isArray(row.options) ? row.options : [],
    correctAnswer: row.correct_answer,
  };
}

async function selectItems(learnLang) {
  const { data, error } = await supabase
    .from("placement_items")
    .select("id, level, type, question, options, correct_answer")
    .eq("learn_lang", learnLang);
  if (error) {
    const err = new Error(error.message || "server");
    // Таблицы ещё нет в облаке (SQL не выполнен) — отдельный понятный случай.
    err.code = /placement_items/i.test(error.message || "")
      ? "missing-table"
      : "server";
    err.raw = error.message || null;
    throw err;
  }
  return (data || []).map(toItem);
}

/**
 * Банк заданий языка. Порядок: кэш → таблица → (если пусто) разовая генерация
 * на сервере → таблица ещё раз. Возвращает массив заданий или бросает Error
 * с .code: offline | missing-table | not-configured | empty | server.
 */
export async function fetchPlacementBank(learnLang) {
  // Офлайн тест недоступен даже с полным кэшем заданий: результат должен
  // записаться в языковую пару, а не остаться висеть на устройстве.
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }

  // 1) Кэш устройства — повторный тест сюда и заканчивается, до Supabase дело
  //    не доходит вовсе.
  const cached = loadCache()[learnLang];
  if (
    cached &&
    Array.isArray(cached.items) &&
    cached.items.length >= MIN_USABLE_ITEMS &&
    Date.now() - (cached.savedAt || 0) < CACHE_TTL_MS
  ) {
    return cached.items;
  }

  if (!supabase) {
    const err = new Error("not-configured");
    err.code = "not-configured";
    throw err;
  }

  // 2) Общая таблица.
  let items = await selectItems(learnLang);

  // 3) Банк языка пуст — просим сервер наполнить его ОДИН раз. Сервер сам ещё
  //    раз проверит наполненность, так что параллельные заходы не удваивают
  //    расход, а повторные вызовы возвращают cached: true без обращения к ИИ.
  if (items.length < MIN_USABLE_ITEMS) {
    let res;
    try {
      res = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure", learnLang }),
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
    items = await selectItems(learnLang);
  }

  if (items.length === 0) {
    const err = new Error("empty");
    err.code = "empty";
    throw err;
  }

  saveCache(learnLang, items);
  return items;
}
