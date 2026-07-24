import { generateReadingText, explainGrammar } from "../lib/reading.js";

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
 * Серверная функция режима чтения (фаза 6.1). Один эндпоинт на два действия —
 * так проще деплой и общий разбор тела:
 *   { action: "text",    learnLang, nativeLang, topic, level, knownWords[] }
 *   { action: "grammar", sentence, learnLang, nativeLang, level }
 * Ключ Claude API остаётся в переменных окружения сервера.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    const params = await readBody(req);
    const result =
      params.action === "grammar"
        ? await explainGrammar(params)
        : await generateReadingText(params);
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось получить текст для чтения.",
    });
  }
}
