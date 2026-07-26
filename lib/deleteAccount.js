// ============================================================================
// Необратимое удаление аккаунта и всех его данных (фаза 7.1). Требование Google
// Play и GDPR (проект и пользователи в ЕС).
// ----------------------------------------------------------------------------
// КРИТИЧНО по безопасности (читать перед правками):
//   • id пользователя приходит СЮДА уже из проверенной сессии (api/account.js
//     берёт его из токена через authenticateRequest, НЕ из тела запроса). Значит
//     подставить чужой id, чтобы удалить чужой аккаунт, нельзя.
//   • Удаление идёт под service_role — он ОБХОДИТ RLS. Поэтому правильный
//     where по user_id здесь — ЕДИНСТВЕННАЯ защита от удаления чужих строк.
//     Каждый delete ниже строго фильтруется по одному user_id. Ни одного
//     delete без where по user_id. Никаких truncate/drop/массовых delete.
//   • Порядок: сначала дочерние таблицы (ссылаются на пользователя), затем
//     profiles, в самом конце — строка в auth.users. Так не остаётся висячих
//     строк, даже если какой-то шаг не завершится.
//
// Общий кэш (аудио в Storage, банк placement_items) НЕ трогаем — он не
// персональный и общий для всех пользователей.
// ============================================================================

import { createClient } from "@supabase/supabase-js";

function pick(...names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  return null;
}

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
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Удаляет всё, что принадлежит пользователю userId, и сам аккаунт. userId —
 * ТОЛЬКО из проверенной сессии (см. шапку). Бросает Error с .status при сбое.
 *
 * Возвращает { ok:true, deleted } — deleted для лога/отладки (не показывается).
 */
export async function deleteAccount(userId) {
  if (!userId || typeof userId !== "string") {
    const err = new Error("Не указан пользователь для удаления.");
    err.status = 400;
    throw err;
  }

  const supabase = serviceClient();
  const deleted = {};

  // 1) Дочерние таблицы — каждая строго по user_id. Порядок между ними не важен
  //    (все ссылаются на auth.users), но profiles и auth.users идут строго после.
  const childTables = ["user_languages", "user_words", "feedback", "api_usage"];
  for (const table of childTables) {
    const { data, error } = await supabase
      .from(table)
      .delete()
      .eq("user_id", userId) // ← единственная защита: адресно по одному id
      .select("user_id");
    if (error) {
      // Таблицы может не быть в облаке (feedback/api_usage до применения схемы) —
      // это не повод прерывать удаление: строк там всё равно нет.
      if (/does not exist|schema cache|not find/i.test(error.message || "")) {
        deleted[table] = 0;
        continue;
      }
      const err = new Error(`Не удалось удалить ${table}: ${error.message}`);
      err.status = 502;
      throw err;
    }
    deleted[table] = (data || []).length;
  }

  // 2) Профиль — по первичному ключу id (он же user_id).
  {
    const { data, error } = await supabase
      .from("profiles")
      .delete()
      .eq("id", userId) // ← адресно по одному id
      .select("id");
    if (error) {
      const err = new Error(`Не удалось удалить profiles: ${error.message}`);
      err.status = 502;
      throw err;
    }
    deleted.profiles = (data || []).length;
  }

  // 3) Сам аккаунт в auth.users — через Admin API (service_role). Это финальный
  //    шаг: строки-потомки уже удалены, висячих ссылок не останется.
  {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      const err = new Error(`Не удалось удалить учётную запись: ${error.message}`);
      err.status = 502;
      throw err;
    }
    deleted.auth_user = 1;
  }

  return { ok: true, deleted };
}
