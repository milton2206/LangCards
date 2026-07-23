import { supabase } from "./supabase.js";

// Работа со списком языковых пар пользователя (таблица user_languages).
//
// ВАЖНО: эта таблица — только «оглавление» (какие пары есть, какая приоритетная,
// дневной лимит). Прогресс слов по-прежнему ЦЕЛИКОМ живёт в user_words.data
// (jsonb wordsByPair) и здесь НЕ читается и НЕ изменяется — существующие экраны
// продолжают работать с ним напрямую, как и до фазы 4.1.
const TABLE = "user_languages";

// Строка БД (snake_case) → объект для UI (camelCase).
function toLanguage(row) {
  return {
    learnLang: row.learn_lang,
    nativeLang: row.native_lang,
    isPriority: row.is_priority,
    dailyNewLimit: row.daily_new_limit,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/**
 * Активные языки пользователя (в порядке добавления).
 * Офлайн-фолбэк: если Supabase не настроен или недоступен — ТИХО возвращаем
 * пустой массив; приложение продолжает работать как раньше (localStorage).
 */
export async function fetchUserLanguages(userId) {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select(
        "learn_lang, native_lang, is_priority, daily_new_limit, is_active, created_at",
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("created_at", { ascending: true });
    if (error) return [];
    return (data || []).map(toLanguage);
  } catch {
    return [];
  }
}

/**
 * Добавляет языковую пару (или реактивирует ранее «удалённую» — upsert по PK).
 * opts: { isPriority?, dailyNewLimit? }. Первый язык пользователя станет
 * приоритетным автоматически (триггер в БД). Возвращает { ok }.
 */
export async function addUserLanguage(userId, learnLang, nativeLang, opts = {}) {
  if (!supabase || !userId) return { ok: false };
  const row = {
    user_id: userId,
    learn_lang: learnLang,
    native_lang: nativeLang,
    is_active: true,
  };
  if (opts.isPriority != null) row.is_priority = opts.isPriority;
  if (opts.dailyNewLimit != null) row.daily_new_limit = opts.dailyNewLimit;
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert(row, { onConflict: "user_id,learn_lang,native_lang" });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/**
 * Точечное обновление пары. changes: { isPriority?, dailyNewLimit?, isActive? }.
 * Возвращает { ok }.
 */
export async function updateUserLanguage(userId, learnLang, nativeLang, changes = {}) {
  if (!supabase || !userId) return { ok: false };
  const patch = {};
  if (changes.isPriority != null) patch.is_priority = changes.isPriority;
  if (changes.dailyNewLimit != null) patch.daily_new_limit = changes.dailyNewLimit;
  if (changes.isActive != null) patch.is_active = changes.isActive;
  if (Object.keys(patch).length === 0) return { ok: true };
  try {
    const { error } = await supabase
      .from(TABLE)
      .update(patch)
      .eq("user_id", userId)
      .eq("learn_lang", learnLang)
      .eq("native_lang", nativeLang);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/**
 * Делает пару приоритетной. Одного update достаточно: триггер в БД сам снимает
 * приоритет с прежней пары (инвариант «ровно одна» держит база).
 */
export async function setPriorityLanguage(userId, learnLang, nativeLang) {
  return updateUserLanguage(userId, learnLang, nativeLang, { isPriority: true });
}

/**
 * «Удаляет» пару: ставит is_active=false, НЕ удаляя строку — прогресс в
 * user_words и сама запись сохраняются (можно вернуть через addUserLanguage).
 * Если пара была приоритетной, БД передаст приоритет самой старой активной.
 */
export async function removeUserLanguage(userId, learnLang, nativeLang) {
  return updateUserLanguage(userId, learnLang, nativeLang, { isActive: false });
}
