import { ensurePlacementBank, countBank } from "../lib/placement.js";

// Читает JSON-тело запроса (Vercel обычно уже парсит req.body, но подстрахуемся).
async function readBody(req) {
  if (req.body) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/**
 * Серверная функция теста на уровень (фаза 6.3). Один эндпоинт на два действия:
 *   { action: "ensure", learnLang }        — наполнить банк, если он пуст;
 *   { action: "count",  learnLang }        — сколько заданий уже есть.
 *
 * Сами задания клиент читает НЕ отсюда, а прямо из placement_items (RLS даёт
 * select всем авторизованным) — эндпоинт нужен только для разовой генерации.
 * Ключи Claude и service_role Supabase остаются в переменных окружения сервера.
 *
 * "ensure" вызывается редко: клиент дёргает его только когда банк языка пуст,
 * а сама функция ещё раз проверяет наполненность и при достаточном банке
 * возвращает { created: 0, cached: true } без единого обращения к модели.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    const { action, learnLang, force } = await readBody(req);
    const result =
      action === "count"
        ? await countBank(learnLang)
        : await ensurePlacementBank({ learnLang, force: Boolean(force) });
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось подготовить банк заданий.",
    });
  }
}
