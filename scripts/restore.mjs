// ============================================================================
// Восстановление данных из дампа, созданного scripts/backup.mjs.
// ----------------------------------------------------------------------------
// Использование:
//     npm run restore -- backups/langcards-backup-2026-07-26_14-05-09.json
//
// Что делает: upsert строк обратно в таблицы данных по первичному ключу. Это
// АДДИТИВНО и идемпотентно — существующие строки перезаписываются значениями из
// дампа, ничего НЕ удаляется. Поэтому главный сценарий страховки работает так:
// если удаление аккаунта по ошибке снесло чужие строки, а сами их auth-аккаунты
// целы, — этот скрипт вернёт снесённые строки на место (внешние ключи на
// auth.users выполнятся, потому что владелец существует).
//
// Чего скрипт НЕ делает:
//   • не воссоздаёт строки в auth.users. Если удалён сам аккаунт (auth.users),
//     его строки-потомки вставить нельзя — мешает внешний ключ. Пересоздание
//     пользователя с тем же id — отдельная операция Admin API, и делать её
//     автоматически опасно (новый пароль, письма). В дампе есть auth_users
//     (id+email) — по ним аккаунт при необходимости пересоздают вручную.
//   • ничего не удаляет — «лишние» строки, появившиеся после бэкапа, останутся.
//
// По умолчанию — сухой прогон (только показывает, что будет сделано). Чтобы
// применить, добавьте флаг --apply.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { supabaseAdminConfig, projectRoot } from "./_env.mjs";

// Таблица → колонки первичного ключа (для onConflict в upsert).
const TABLE_PK = {
  profiles: "id",
  user_words: "user_id",
  user_languages: "user_id,learn_lang,native_lang",
  feedback: "id",
  placement_items: "id",
};
// Порядок восстановления: сперва profiles (на неё ссылаются потомки), потом
// остальные. auth_users не восстанавливается (см. шапку) — только читается.
const RESTORE_ORDER = [
  "profiles",
  "user_words",
  "user_languages",
  "feedback",
  "placement_items",
];

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const fileArg = args.find((a) => !a.startsWith("--"));
  if (!fileArg) {
    console.error(
      "Укажите файл дампа: npm run restore -- backups/langcards-backup-….json [--apply]",
    );
    process.exit(1);
  }

  const file = resolve(projectRoot, fileArg);
  const backup = JSON.parse(readFileSync(file, "utf8"));
  const tables = backup.tables || {};

  const { url, serviceKey } = supabaseAdminConfig();
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  console.log(`Дамп: ${file}`);
  console.log(`Создан: ${backup.createdAt}`);
  console.log(apply ? "\nРЕЖИМ: применяю (--apply)\n" : "\nРЕЖИМ: сухой прогон (без --apply ничего не пишется)\n");

  if (Array.isArray(tables.auth_users)) {
    console.log(`  auth_users        ${tables.auth_users.length} строк (только справка, не восстанавливается)`);
  }

  for (const table of RESTORE_ORDER) {
    const rows = tables[table];
    if (!Array.isArray(rows) || rows.length === 0) {
      console.log(`  ${table.padEnd(17)} — нет строк в дампе, пропуск`);
      continue;
    }
    if (!apply) {
      console.log(`  ${table.padEnd(17)} ${rows.length} строк → upsert (сухой прогон)`);
      continue;
    }
    const { error } = await supabase
      .from(table)
      .upsert(rows, { onConflict: TABLE_PK[table] });
    if (error) {
      console.error(`  ${table.padEnd(17)} ОШИБКА: ${error.message}`);
      continue;
    }
    console.log(`  ${table.padEnd(17)} ${rows.length} строк восстановлено`);
  }

  console.log(
    apply
      ? "\nГотово."
      : "\nЭто был сухой прогон. Для реального восстановления добавьте --apply.",
  );
}

main().catch((err) => {
  console.error("\nВосстановление НЕ выполнено:", err.message);
  process.exit(1);
});
