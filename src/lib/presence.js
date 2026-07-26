// Аналитика без внешних сервисов (фаза 7.1): отметка «был сегодня» и источник
// перехода. Никаких трекеров, кукибаннеров и согласий — только две колонки в
// profiles (last_seen, signup_source), см. supabase/schema.sql и analytics.sql.
//
// Всё здесь — тихий best-effort: любые сбои проглатываются, на работу приложения
// не влияют.

import { supabase } from "./supabase.js";

// База ключа гейта «уже отмечались сегодня». Фактический ключ — ПО ПОЛЬЗОВАТЕЛЮ
// (см. seenKey): один браузер может держать несколько аккаунтов, и отметка
// одного не должна блокировать отметку другого.
const SEEN_KEY = "lastSeenDate";
const SRC_PENDING_KEY = "signupSource"; // захваченный источник до записи в профиль
const SRC_DONE_KEY = "signupSourceSaved"; // чтобы не дёргать профиль каждую сессию

function todayUTC() {
  return new Date().toISOString().slice(0, 10);
}

// Гейт «был сегодня» — на конкретного пользователя, а не на устройство.
function seenKey(userId) {
  return `${SEEN_KEY}:${userId}`;
}

/**
 * Захват источника перехода ОДИН раз (?src / ?ref / ?utm_source). Вызывать при
 * старте приложения. Значение придерживается в localStorage до момента, когда
 * появится пользователь (после регистрации) и его можно будет записать в профиль.
 */
export function captureSignupSource() {
  try {
    if (localStorage.getItem(SRC_DONE_KEY)) return;
    if (localStorage.getItem(SRC_PENDING_KEY)) return;
    const p = new URLSearchParams(window.location.search);
    const src = p.get("src") || p.get("ref") || p.get("utm_source");
    if (src) localStorage.setItem(SRC_PENDING_KEY, src.slice(0, 80));
  } catch {
    // недоступно хранилище / нет window — не критично
  }
}

/**
 * Отмечает last_seen при КАЖДОМ заходе (и при свежем логине, и при открытии с
 * уже живой сессией — вызывается из эффекта по готовности пользователя), но не
 * чаще раза в сутки. Двойная защита от нагрузки на базу: гейт localStorage
 * (сегодня уже отмечались — вообще не ходим на сервер) + сам RPC touch_last_seen
 * пишет только если сегодня ещё не отмечен.
 */
export async function touchLastSeen(userId) {
  if (!supabase || !userId) return;
  const key = seenKey(userId);
  try {
    if (localStorage.getItem(key) === todayUTC()) return;
    // ВАЖНО: supabase.rpc НЕ бросает при ошибке — возвращает { error }. Гейт
    // ставим ТОЛЬКО при реальном успехе: иначе неудачная отметка (например,
    // до применения миграции, когда функции ещё нет) навсегда заблокировала бы
    // сегодняшний день, и last_seen так и не обновился бы после миграции.
    const { error } = await supabase.rpc("touch_last_seen");
    if (error) return;
    localStorage.setItem(key, todayUTC());
    // Подчищаем устаревший общий ключ прошлой версии (был по устройству).
    localStorage.removeItem(SEEN_KEY);
  } catch {
    // сеть/RPC недоступны — отметка не обязательна, повторим при следующем заходе
  }
}

/**
 * Записывает signup_source в профиль ОДИН раз и только если он ещё пуст. Гейт
 * localStorage, чтобы не читать/писать профиль каждую сессию.
 */
export async function recordSignupSource(userId) {
  if (!supabase || !userId) return;
  try {
    if (localStorage.getItem(SRC_DONE_KEY)) return;
    const src = localStorage.getItem(SRC_PENDING_KEY);
    if (!src) {
      localStorage.setItem(SRC_DONE_KEY, "1");
      return;
    }
    // is('signup_source', null) — переписываем только пустой источник: повторная
    // регистрация с меткой не затрёт исходную.
    await supabase
      .from("profiles")
      .update({ signup_source: src })
      .eq("id", userId)
      .is("signup_source", null);
    localStorage.setItem(SRC_DONE_KEY, "1");
    localStorage.removeItem(SRC_PENDING_KEY);
  } catch {
    // не критично — источник просто останется пустым
  }
}
