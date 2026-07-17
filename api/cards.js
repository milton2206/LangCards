import { generateCards } from "../lib/generateCards.js";

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
 * Серверная функция: фронтенд шлёт сюда параметры онбординга, а ключ Claude API
 * хранится в переменной окружения ANTHROPIC_API_KEY и НЕ попадает в браузер.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    const params = await readBody(req);
    const cards = await generateCards(params);
    res.status(200).json({ cards });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось сгенерировать карточки.",
    });
  }
}
