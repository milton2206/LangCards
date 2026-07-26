// Общий клиентский слой для серверных эндпоинтов (/api/*): авторизация запросов
// и разбор ошибок. Появился в фазе 7.1 вместе с суточными лимитами.
//
// Аккаунты обязательны, поэтому каждый вызов генерации/озвучки сопровождается
// токеном сессии — по нему сервер узнаёт пользователя (для лимитов и удаления
// аккаунта) и берёт его id ТОЛЬКО из проверенного токена, не из тела запроса.

import { supabase } from "./supabase.js";

/**
 * Заголовок Authorization: Bearer <access_token> текущей сессии Supabase.
 * Без настроенного Supabase / без сессии — пустой объект (сервер ответит 401).
 */
export async function authHeaders() {
  if (!supabase) return {};
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

/**
 * Разбирает НЕуспешный ответ сервера в структуру { code?, params?, raw? }.
 * Известные коды лимита/сессии превращаются в свои коды (их локализует
 * apiErrorText); иначе отдаём raw-сообщение сервера или общий код server.
 */
export async function parseApiError(res) {
  let body = null;
  try {
    body = await res.json();
  } catch {
    // тело не JSON — покажем общий текст по статусу
  }
  const code = body?.code;
  if (code === "rateLimit") return { code: "rateLimit" };
  if (code === "rateCooldown") {
    return {
      code: "rateCooldown",
      params: { seconds: Number(body?.retryAfter) || 1 },
    };
  }
  if (code === "unauthorized") return { code: "sessionExpired" };
  const raw = body?.error || null;
  return raw ? { raw } : { code: "server", params: { status: res.status } };
}

/**
 * То же, что parseApiError, но в виде готового к throw объекта Error (для
 * клиентов, которые бросают ошибку, а не кладут её в state). Поля code/params/raw
 * переносятся на объект ошибки.
 */
export async function makeApiError(res) {
  const info = await parseApiError(res);
  const err = new Error(info.code || info.raw || "server");
  err.code = info.code;
  err.params = info.params;
  err.raw = info.raw || null;
  return err;
}

/**
 * Локализованный текст ошибки по её коду — общий для экранов (чтение,
 * аудирование, добавление слова и т.п.). Известные коды → строки из i18n;
 * иначе raw-сообщение сервера или запасной ключ.
 */
export function apiErrorText(err, t, fallbackKey) {
  switch (err?.code) {
    case "offline":
      return t("errors.offline");
    case "rateLimit":
      return t("errors.rateLimit");
    case "rateCooldown":
      return t("errors.rateCooldown", {
        seconds: err.params?.seconds ?? err.retryAfter ?? 1,
      });
    case "sessionExpired":
      return t("errors.sessionExpired");
    default:
      return err?.raw || t(fallbackKey || "errors.server");
  }
}
