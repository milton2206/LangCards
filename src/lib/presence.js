// Аналитика без внешних сервисов (фаза 7.1): отметка «был сегодня» и источник
// перехода. Никаких трекеров, кукибаннеров и согласий — только две колонки в
// profiles (last_seen, signup_source), см. supabase/schema.sql и analytics.sql.
//
// Всё здесь — тихий best-effort: любые сбои проглатываются, на работу приложения
// не влияют.

import { supabase } from "./supabase.js";

const SRC_PENDING_KEY = "signupSource"; // захваченный источник до записи в профиль
const SRC_DONE_KEY = "signupSourceSaved"; // чтобы не дёргать профиль каждую сессию

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
 * Отмечает last_seen на ТЕКУЩЕЕ время при КАЖДОМ заходе (и при свежем логине, и
 * при открытии с уже живой сессией — вызывается из эффекта по готовности
 * пользователя). Вызывать СТРОГО ПОСЛЕ расчёта «Что нового» (resolveWhatsNew уже
 * прочитал СТАРЫЙ last_seen) — см. App.jsx.
 *
 * Почему без гейта «раз в сутки»: экран «Что нового» сравнивает записи с ТОЧНОЙ
 * меткой last_seen. Если после показа не сдвинуть отметку на now(), та же запись
 * всплывёт и на следующем заходе в тот же день. Поэтому пишем при каждом заходе.
 * Нагрузка мизерная — одна запись на открытие приложения (эффект срабатывает раз
 * за сессию), RLS profiles (update-own) это разрешает. Пишем прямым update, а не
 * через RPC touch_last_seen: тому нужна метка сервера и суточный гейт, а нам
 * нужен именно каждый заход.
 */
export async function touchLastSeen(userId) {
  if (!supabase || !userId) return;
  try {
    await supabase
      .from("profiles")
      .update({ last_seen: new Date().toISOString() })
      .eq("id", userId);
  } catch {
    // сеть недоступна — отметка не обязательна, обновим при следующем заходе
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
