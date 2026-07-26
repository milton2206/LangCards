// ============================================================================
// Серверная защита эндпоинтов (фаза 7.1): проверка сессии + суточные лимиты.
// ----------------------------------------------------------------------------
// Живёт в общем lib/, потому что вызывается ИЗ ДВУХ мест одинаково:
//   • serverless-функции api/*.js (прод, Vercel);
//   • dev-middleware в vite.config.js (локальная разработка).
// Так лимит нельзя обойти, запустив локальный дев-сервер, а логика одна.
//
// Два примитива:
//   authenticateRequest(req) — достаёт Bearer-токен из заголовка Authorization
//     и ПРОВЕРЯЕТ его у Supabase (подпись + срок). Возвращает { userId } или
//     бросает 401. id берётся ТОЛЬКО из проверенного токена — не из тела запроса.
//   consumeQuota(userId, kind) — атомарно списывает одну единицу суточного
//     лимита через RPC consume_quota (см. supabase/schema.sql). Бросает 429 при
//     исчерпании лимита или слишком частых запросах.
//
// guard(req, kind) — оба шага сразу (для эндпоинтов, где лимит списывается
// всегда). Для озвучки (tts) шаги разнесены: списываем только при кэш-промахе.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { RATE_LIMITS } from "./rateLimits.js";

function pick(...names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  return null;
}

// Клиент для ПРОВЕРКИ токена (публичный anon-ключ). auth.getUser(token) сам
// сходит к Supabase и подтвердит подпись/срок токена — какой ключ у клиента,
// значения не имеет. Кэшируем на инстанс функции.
let verifyClientInstance = null;
function verifyClient() {
  const url = pick("SUPABASE_URL", "VITE_SUPABASE_URL");
  const anon = pick("VITE_SUPABASE_ANON_KEY", "SUPABASE_ANON_KEY");
  if (!url || !anon) {
    const err = new Error(
      "Сервер не настроен: нет SUPABASE_URL / VITE_SUPABASE_ANON_KEY для проверки сессии.",
    );
    err.status = 500;
    throw err;
  }
  if (!verifyClientInstance) {
    verifyClientInstance = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return verifyClientInstance;
}

// Клиент с service_role — для RPC списания лимита (обходит RLS). Ключ только на
// сервере. Кэшируем на инстанс функции.
let serviceClientInstance = null;
function serviceClient() {
  const url = pick("SUPABASE_URL", "VITE_SUPABASE_URL");
  const key = pick("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    const err = new Error(
      "Сервер не настроен: нет SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.",
    );
    err.status = 500;
    throw err;
  }
  if (!serviceClientInstance) {
    serviceClientInstance = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return serviceClientInstance;
}

/**
 * Проверяет сессию по заголовку Authorization: Bearer <jwt>. Возвращает
 * { userId, email } строго из проверенного токена. Бросает Error со status 401,
 * если токена нет или он недействителен.
 */
export async function authenticateRequest(req) {
  const header = req.headers?.authorization || req.headers?.Authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : null;
  if (!token) {
    const err = new Error("Требуется вход в аккаунт.");
    err.status = 401;
    err.code = "unauthorized";
    throw err;
  }

  const { data, error } = await verifyClient().auth.getUser(token);
  if (error || !data?.user) {
    const err = new Error("Сессия недействительна. Войдите заново.");
    err.status = 401;
    err.code = "unauthorized";
    throw err;
  }
  return { userId: data.user.id, email: data.user.email };
}

/**
 * Атомарно списывает одну единицу суточного лимита вида kind у пользователя.
 * При исчерпании лимита или слишком частых запросах бросает Error со status 429
 * и .code ('rateLimit' | 'rateCooldown') — клиент по нему покажет понятный текст.
 *
 * Fail-open на сбой самой проверки (нет RPC до применения миграции, моргнула
 * сеть до БД): один вызов дешёвый, а глухая блокировка всего приложения из-за
 * хиккапа счётчика хуже, чем редкий пропуск. Проверка сессии при этом остаётся
 * жёсткой (fail-closed) — аноним до этого шага не доходит.
 */
export async function consumeQuota(userId, kind) {
  const cfg = RATE_LIMITS[kind];
  if (!cfg) return; // неизвестный вид не лимитируем

  let result;
  try {
    const { data, error } = await serviceClient().rpc("consume_quota", {
      p_user_id: userId,
      p_kind: kind,
      p_limit: cfg.perDay,
      p_min_interval: cfg.minIntervalSec,
    });
    if (error) throw error;
    result = data;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`[rate-limit] проверка лимита ${kind} не удалась, пропускаю:`, e.message);
    return;
  }

  if (result && result.allowed === false) {
    if (result.reason === "cooldown") {
      const err = new Error(
        "Слишком часто. Подождите пару секунд и попробуйте снова.",
      );
      err.status = 429;
      err.code = "rateCooldown";
      err.retryAfter = Number(result.retry_after) || cfg.minIntervalSec;
      throw err;
    }
    // 'daily' и всё прочее — суточный лимит исчерпан.
    const err = new Error(
      "На сегодня лимит исчерпан. Лимит обновится завтра (в 00:00 UTC).",
    );
    err.status = 429;
    err.code = "rateLimit";
    err.limit = Number(result.limit) || cfg.perDay;
    throw err;
  }
}

/**
 * Проверка сессии + списание лимита одним вызовом. Для эндпоинтов, где единица
 * лимита тратится на каждый запрос (карточки, тексты, грамматика, аудирование,
 * банк теста). Возвращает { userId }.
 */
export async function guard(req, kind) {
  const { userId } = await authenticateRequest(req);
  await consumeQuota(userId, kind);
  return { userId };
}
