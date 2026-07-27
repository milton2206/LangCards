import { generateReadingText, explainGrammar } from "../lib/reading.js";
import { generateTextComprehension } from "../lib/comprehension.js";
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
 * Серверная функция режима чтения (фаза 6.1). Один эндпоинт на два действия —
 * так проще деплой и общий разбор тела:
 *   { action: "text",      learnLang, nativeLang, topic, level, knownWords[] }
 *   { action: "grammar",   sentence, learnLang, nativeLang, level }
 *   { action: "questions", passage, learnLang, nativeLang, level } — вопросы на
 *     понимание содержания текста (фаза 6.2, общий механизм с аудированием).
 * Ключ Claude API остаётся в переменных окружения сервера.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    const params = await readBody(req);
    // Грамматика и текст — разные виды лимита: разбор предложения дешевле и
    // случается чаще, у него своя квота. Вопросы на понимание — генерация в
    // домене чтения, считаем по той же квоте, что и текст.
    await guard(req, params.action === "grammar" ? "grammar" : "texts");
    let result;
    if (params.action === "grammar") result = await explainGrammar(params);
    else if (params.action === "questions")
      result = await generateTextComprehension(params);
    else result = await generateReadingText(params);
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось получить текст для чтения.",
      code: err.code,
      retryAfter: err.retryAfter,
    });
  }
}
