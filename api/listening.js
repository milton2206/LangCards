import { generateSoundAlikes } from "../lib/listening.js";

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
 * Серверная функция аудирования (фаза 6.2). Пока одно действие — подбор похоже
 * звучащих дистракторов для формата «на слух»:
 *   { action: "soundalike", learnLang, words[] } → { items: [{ word, distractors }] }
 *
 * Первый формат («пропущенное слово») сюда не ходит: его предложения даёт
 * эндпоинт режима чтения (/api/reading), а пропуск делает клиент. Ключ Claude
 * API остаётся в переменных окружения сервера.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    const { learnLang, words } = await readBody(req);
    const items = await generateSoundAlikes({ learnLang, words });
    res.status(200).json({ items });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось подобрать варианты на слух.",
    });
  }
}
