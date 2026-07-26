// ============================================================================
// Бэкап пользовательских данных Supabase → локальный JSON-файл с датой в имени.
// ----------------------------------------------------------------------------
// ЗАЧЕМ. На Free-тарифе Supabase НЕТ автоматических бэкапов и Point-in-Time
// Recovery (это платные Pro-возможности). Единственная страховка — снять
// логический дамп самому. Этот скрипт нужно запускать ПЕРЕД каждой миграцией
// и обязательно ДО первого нажатия «Удалить аккаунт»: если удаление заденет
// лишнее, данные восстанавливаются из свежего дампа (см. scripts/restore.mjs).
//
// Одна команда, без ручных шагов:
//     npm run backup
//
// Что дампится (всё, к чему service_role имеет доступ, минуя RLS):
//   • auth users  — id + email (через Admin API; пароли Supabase не отдаёт);
//   • profiles, user_words, user_languages, feedback — данные пользователей;
//   • placement_items — общий банк заданий (не персональный, но восстановим).
// Счётчики api_usage НЕ дампятся: это эфемерные суточные лимиты, терять нечего.
//
// Файл кладётся в backups/ (папка в .gitignore — там email'ы, это PII).
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { supabaseAdminConfig, projectRoot } from "./_env.mjs";

// Таблицы данных, выгружаемые обычным select (service_role обходит RLS).
const DATA_TABLES = [
  "profiles",
  "user_words",
  "user_languages",
  "feedback",
  "placement_items",
];

// Метка времени для имени файла: 2026-07-26_14-05-09 (сортируется как текст).
function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` +
    `_${p(d.getHours())}-${p(d.getMinutes())}-${p(d.getSeconds())}`
  );
}

// Выгружает таблицу целиком постранично (без лимита в 1000 строк по умолчанию).
async function dumpTable(supabase, table) {
  const rows = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) {
      // Таблицы ещё нет в облаке (например, feedback до применения схемы) —
      // это не повод валить весь бэкап: помечаем и идём дальше.
      if (/does not exist|not find|schema cache/i.test(error.message || "")) {
        return { rows: null, skipped: error.message };
      }
      throw new Error(`Таблица ${table}: ${error.message}`);
    }
    rows.push(...(data || []));
    if (!data || data.length < pageSize) break;
  }
  return { rows, skipped: null };
}

// Выгружает список аккаунтов из auth.users (Admin API, постранично).
async function dumpAuthUsers(supabase) {
  const users = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });
    if (error) throw new Error(`auth.users: ${error.message}`);
    const batch = data?.users || [];
    for (const u of batch) {
      // Только то, что нужно для восстановления и аналитики — без токенов.
      users.push({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      });
    }
    if (batch.length < perPage) break;
  }
  return users;
}

async function main() {
  const { url, serviceKey } = supabaseAdminConfig();
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });

  const backup = {
    createdAt: new Date().toISOString(),
    project: url,
    tables: {},
  };

  console.log("Бэкап LangCards → выгружаю данные…\n");

  // auth users
  const authUsers = await dumpAuthUsers(supabase);
  backup.tables.auth_users = authUsers;
  console.log(`  auth_users        ${authUsers.length} строк`);

  // Таблицы данных
  for (const table of DATA_TABLES) {
    const { rows, skipped } = await dumpTable(supabase, table);
    if (skipped) {
      backup.tables[table] = [];
      console.log(`  ${table.padEnd(17)} — пропущена (${skipped})`);
      continue;
    }
    backup.tables[table] = rows;
    console.log(`  ${table.padEnd(17)} ${rows.length} строк`);
  }

  const dir = resolve(projectRoot, "backups");
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `langcards-backup-${timestamp()}.json`);
  writeFileSync(file, JSON.stringify(backup, null, 2), "utf8");

  const totalRows = Object.values(backup.tables).reduce(
    (n, rows) => n + (Array.isArray(rows) ? rows.length : 0),
    0,
  );
  console.log(`\nГотово: ${file}`);
  console.log(`Всего строк: ${totalRows}. Восстановление — см. BACKUP.md.`);
}

main().catch((err) => {
  console.error("\nБэкап НЕ создан:", err.message);
  process.exit(1);
});
