import { authenticateRequest } from "../lib/serverAuth.js";
import { deleteAccount } from "../lib/deleteAccount.js";

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
 * Серверная функция аккаунта (фаза 7.1). Пока одно действие — необратимое
 * удаление аккаунта и всех данных пользователя:
 *   { action: "delete" }
 *
 * БЕЗОПАСНОСТЬ: id берётся ТОЛЬКО из проверенной сессии (authenticateRequest по
 * Bearer-токену), тело запроса на выбор пользователя НЕ влияет — подставить
 * чужой id нельзя. Дальше вся адресность в lib/deleteAccount.js (where по user_id).
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    // Кто вошёл — только из токена. Тело читаем лишь ради action.
    const { userId } = await authenticateRequest(req);
    const { action } = await readBody(req);
    if (action !== "delete") {
      res.status(400).json({ error: "Неизвестное действие." });
      return;
    }
    await deleteAccount(userId);
    res.status(200).json({ ok: true });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось удалить аккаунт.",
      code: err.code,
    });
  }
}
