import { supabase } from "./supabase.js";

// Одна строка на пользователя: весь прогресс (все языковые пары) как jsonb.
// Доступ ограничен Row Level Security (auth.uid() = user_id) — см. supabase/schema.sql.
const TABLE = "user_words";

// Приводим ошибку Supabase к понятной причине для UI/логики синхронизации.
function classify(error) {
  const msg = (error?.message || "").toLowerCase();
  const code = error?.code || "";
  if (msg.includes("failed to fetch") || msg.includes("network") || msg.includes("fetch"))
    return "offline";
  if (
    code === "42P01" ||
    code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  )
    return "missing-table";
  return "error";
}

// Читает облачную копию прогресса. { ok, data|null, updatedAt|null } либо { ok:false, reason }.
export async function fetchCloudWords(userId) {
  if (!supabase) return { ok: false, reason: "unconfigured" };
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("data, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) return { ok: false, reason: classify(error), error };
    if (!data) return { ok: true, data: null, updatedAt: null };
    return { ok: true, data: data.data, updatedAt: data.updated_at };
  } catch (error) {
    return { ok: false, reason: classify(error), error };
  }
}

// Записывает (upsert) прогресс в облако. { ok, updatedAt } либо { ok:false, reason }.
export async function pushCloudWords(userId, data) {
  if (!supabase) return { ok: false, reason: "unconfigured" };
  const updatedAt = new Date().toISOString();
  try {
    const { data: row, error } = await supabase
      .from(TABLE)
      .upsert(
        { user_id: userId, data, updated_at: updatedAt },
        { onConflict: "user_id" },
      )
      .select("updated_at")
      .single();
    if (error) return { ok: false, reason: classify(error), error };
    return { ok: true, updatedAt: row?.updated_at || updatedAt };
  } catch (error) {
    return { ok: false, reason: classify(error), error };
  }
}
