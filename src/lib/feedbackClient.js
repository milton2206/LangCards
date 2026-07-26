// Отправка отзыва (кнопка «Сообщить о проблеме», фаза 7.1). Пишет строку прямо в
// таблицу feedback — без почты и внешних сервисов. Версия приложения и браузер
// добавляются автоматически: без них отчёты бесполезны. RLS разрешает вставлять
// только свою строку и не даёт читать (см. supabase/schema.sql).

import { supabase } from "./supabase.js";
import { APP_VERSION } from "./appVersion.js";

const MAX_TEXT = 4000;

/**
 * Отправляет отзыв. Возвращает { ok } или { ok:false, reason } — reason:
 *   'not-configured' | 'empty' | 'error'. userId берётся из текущей сессии
 * (RLS дополнительно проверит auth.uid() = user_id на стороне БД).
 */
export async function sendFeedback({ userId, text, screen }) {
  if (!supabase || !userId) return { ok: false, reason: "not-configured" };
  const clean = String(text ?? "").trim();
  if (!clean) return { ok: false, reason: "empty" };

  const row = {
    user_id: userId,
    text: clean.slice(0, MAX_TEXT),
    screen: screen || null,
    app_version: APP_VERSION,
    user_agent:
      typeof navigator !== "undefined"
        ? String(navigator.userAgent || "").slice(0, 400)
        : null,
  };

  try {
    const { error } = await supabase.from("feedback").insert(row);
    if (error) return { ok: false, reason: "error", raw: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: "error", raw: e.message };
  }
}
