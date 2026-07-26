// Минимальный загрузчик .env.local для локальных скриптов (бэкап/восстановление).
// Своя реализация, чтобы не тащить зависимость dotenv: формат простой —
// KEY=VALUE построчно, комментарии с # и пустые строки пропускаются, кавычки
// вокруг значения снимаются. Значения, уже заданные в окружении процесса, НЕ
// перетираются (как в vite.config.js) — на CI/Vercel переменные приходят извне.

import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, "..");

function parseEnvFile(path) {
  const out = {};
  if (!existsSync(path)) return out;
  const text = readFileSync(path, "utf8");
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Снимаем парные кавычки, если значение в них завёрнуто.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// Подгружаем .env.local, затем .env — не затирая уже заданное окружение.
export function loadLocalEnv() {
  for (const name of [".env.local", ".env"]) {
    const vars = parseEnvFile(resolve(projectRoot, name));
    for (const [key, value] of Object.entries(vars)) {
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

// URL проекта и СЕКРЕТНЫЙ service_role — единственный ключ, которым скрипт видит
// все строки всех пользователей (обходит RLS). Держится только локально/на сервере.
export function supabaseAdminConfig() {
  loadLocalEnv();
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Нужны SUPABASE_URL (или VITE_SUPABASE_URL) и SUPABASE_SERVICE_ROLE_KEY " +
        "в .env.local. service_role берётся в дашборде: Project Settings → API.",
    );
  }
  return { url, serviceKey };
}

export { projectRoot };
