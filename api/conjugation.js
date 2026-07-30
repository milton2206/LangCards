import { generateConjugation } from "../lib/conjugation.js";
import { guard } from "../lib/serverAuth.js";

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
 * Таблица спряжения глагола ПО ЗАПРОСУ (кнопка на карточке глагола, фаза 6.x).
 * Ключ Claude API остаётся в переменных окружения сервера. Перед генерацией —
 * проверка сессии и суточного лимита (kind "conjugation"). Результат кэшируется
 * на клиенте по слову, поэтому повторный запрос сюда не приходит.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    await guard(req, "conjugation");
    const params = await readBody(req);
    const result = await generateConjugation(params);
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось построить таблицу спряжения.",
      code: err.code,
      retryAfter: err.retryAfter,
    });
  }
}
