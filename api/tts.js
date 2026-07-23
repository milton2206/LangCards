import { getOrCreateSpeech } from "../lib/tts.js";

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
 * Серверная функция озвучки (фаза 5.1): { text, learnLang } → { url }.
 * Кэш в Supabase Storage общий для всех пользователей; ключи Google и
 * service role Supabase живут ТОЛЬКО в переменных окружения сервера.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    const { text, learnLang } = await readBody(req);
    const result = await getOrCreateSpeech({ text, learnLang });
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось получить озвучку.",
    });
  }
}
