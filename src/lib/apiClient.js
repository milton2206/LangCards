// Общий клиентский слой для серверных эндпоинтов (/api/*): авторизация запросов
// и разбор ошибок. Появился в фазе 7.1 вместе с суточными лимитами.
//
// Аккаунты обязательны, поэтому каждый вызов генерации/озвучки сопровождается
// токеном сессии — по нему сервер узнаёт пользователя (для лимитов и удаления
// аккаунта) и берёт его id ТОЛЬКО из проверенного токена, не из тела запроса.

import { supabase } from "./supabase.js";

// За сколько секунд до истечения срока считаем токен «вот-вот протухнет» и
// обновляем его ЗАРАНЕЕ. Запас нужен на дорогу до сервера и проверку там.
const REFRESH_MARGIN_SEC = 60;

/**
 * Access-токен текущей сессии, годный к отправке.
 * Обычный вызов отдаёт сохранённый токен, но если срок на исходе — сначала
 * обновляет сессию. forceRefresh — обновить безусловно (после 401).
 * Возвращает null, если Supabase не настроен, сессии нет или обновить не вышло.
 */
async function currentToken({ forceRefresh = false } = {}) {
  if (!supabase) return null;
  try {
    if (forceRefresh) {
      const { data } = await supabase.auth.refreshSession();
      return data?.session?.access_token ?? null;
    }
    const { data } = await supabase.auth.getSession();
    const session = data?.session;
    if (!session) return null;

    const expiresAt = Number(session.expires_at) || 0;
    const secondsLeft = expiresAt - Date.now() / 1000;
    if (expiresAt && secondsLeft < REFRESH_MARGIN_SEC) {
      const { data: refreshed } = await supabase.auth.refreshSession();
      // Не вышло обновить (нет сети) — пробуем со старым: вдруг ещё живой.
      return refreshed?.session?.access_token ?? session.access_token;
    }
    return session.access_token;
  } catch {
    return null;
  }
}

/**
 * Запрос к /api/* с токеном сессии. Заменяет прямой fetch во всех клиентах.
 *
 * Почему не просто fetch с заголовком: токен живёт ограниченное время, а когда
 * вкладка долго в фоне (телефон заблокирован), автообновление Supabase может не
 * сработать вовремя. Раньше такой запрос получал 401 и человек видел «сессия
 * завершилась, войдите заново» посреди работы. Теперь:
 *   1) перед отправкой токен обновляется, если срок на исходе;
 *   2) если сервер всё же ответил 401 — сессия обновляется молча и запрос
 *      повторяется РОВНО ОДИН раз;
 *   3) и только если обновить не удалось (refresh-токен тоже мёртв) — 401
 *      уходит наверх, и экран показывает «войдите заново».
 * Повтор строго однократный: бесконечно дёргать мёртвую сессию незачем.
 */
export async function apiFetch(url, options = {}) {
  const send = (token) =>
    fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

  const res = await send(await currentToken());
  if (res.status !== 401) return res;

  const refreshed = await currentToken({ forceRefresh: true });
  if (!refreshed) return res; // обновить не вышло — отдаём исходный 401
  return send(refreshed);
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
  // Сорвалась генерация (модель, разбор, пустой ответ) — у экрана есть СВОЙ
  // локализованный текст под это («не удалось составить диалог/текст/карточку»).
  // Серверную строку не тащим: она написана по-русски и в украинском или
  // английском интерфейсе выглядела бы чужой.
  if (code === "generationFailed") return { code: "generationFailed" };
  // raw оставляем в объекте ошибки (пригодится в консоли/логах), но показывать
  // его пользователю нельзя — сервер не знает языка интерфейса.
  const raw = body?.error || null;
  return { code: "server", params: { status: res.status }, raw };
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
 * аудирование, добавление слова и т.п.).
 *
 * ВАЖНО: наружу идёт ТОЛЬКО текст из i18n. Сообщения сервера (err.raw) написаны
 * по-русски и раньше показывались как есть — в украинском интерфейсе вылезала
 * русская строка «Не удалось составить диалог…». Теперь raw остаётся только в
 * объекте ошибки для отладки, а человек видит фразу на своём языке: сначала
 * запасной ключ экрана (он точнее — «не удалось составить диалог»), иначе общий
 * errors.server.
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
      return t(fallbackKey || "errors.server");
  }
}
