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

// ---------- Явный флаг мультиязычного режима (profiles.multi_lang_mode) ----------
// Мультирежим — осознанный выбор пользователя, а не следствие числа языков.
// Строка profiles создаётся автоматически при регистрации (триггер в БД).

/**
 * Читает флаг мультирежима. Офлайн-фолбэк: без Supabase / без сети / без строки —
 * тихо false (новые пользователи и так стартуют с false).
 */
export async function getMultiLangMode(userId) {
  if (!supabase || !userId) return false;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("multi_lang_mode")
      .eq("id", userId)
      .maybeSingle();
    if (error || !data) return false;
    return Boolean(data.multi_lang_mode);
  } catch {
    return false;
  }
}

/** Пишет флаг мультирежима. Возвращает { ok }. */
export async function setMultiLangMode(userId, enabled) {
  if (!supabase || !userId) return { ok: false };
  try {
    const { error } = await supabase
      .from("profiles")
      .update({ multi_lang_mode: Boolean(enabled) })
      .eq("id", userId);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/**
 * Выключение мультирежима: активной остаётся только приоритетная пара, прочие
 * активные получают is_active=false. Прогресс в user_words НЕ трогается —
 * при включении режима пары вернутся (reactivateAllLanguages).
 */
export async function deactivateNonPriorityLanguages(userId) {
  if (!supabase || !userId) return { ok: false };
  try {
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: false })
      .eq("user_id", userId)
      .eq("is_active", true)
      .eq("is_priority", false);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}

/**
 * Включение мультирежима: возвращаем ранее скрытые пары (is_active=true).
 * Приоритет не меняется — активная приоритетная пара уже есть, триггер в БД
 * это уважает. Если скрытых пар нет — просто no-op (возможность открыта,
 * добавлять вторую пару никто не заставляет).
 */
export async function reactivateAllLanguages(userId) {
  if (!supabase || !userId) return { ok: false };
  try {
    const { error } = await supabase
      .from(TABLE)
      .update({ is_active: true })
      .eq("user_id", userId)
      .eq("is_active", false);
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
