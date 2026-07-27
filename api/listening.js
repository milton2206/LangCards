import { generateSoundAlikes } from "../lib/listening.js";
import { generateDialogueComprehension } from "../lib/comprehension.js";
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
 * Серверная функция аудирования (фаза 6.2). Действия:
 *   { action: "dialogue",   learnLang, nativeLang, topic, level, knownWords[], source }
 *     → { title, titleTranslation, dialogue[], questions[] } — мини-диалог вокруг
 *       активных слов + вопросы на понимание (ОСНОВНОЙ формат аудирования).
 *   { action: "soundalike", learnLang, nativeLang, level, words[], source, count }
 *     → { items: [{ word, distractors[], translation }] } — старый формат «на слух».
 *
 * Формат «пропущенное слово» сюда не ходит: его предложения даёт эндпоинт
 * режима чтения (/api/reading). Оба действия тратят одну квоту "listening".
 * Ключ Claude API — в переменных окружения сервера.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    await guard(req, "listening");
    const params = await readBody(req);
    if (params.action === "dialogue") {
      const result = await generateDialogueComprehension(params);
      res.status(200).json(result);
      return;
    }
    const { learnLang, nativeLang, level, words, source, count } = params;
    const items = await generateSoundAlikes({
      learnLang,
      nativeLang,
      level,
      words,
      source,
      count,
    });
    res.status(200).json({ items });
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось подобрать варианты на слух.",
      code: err.code,
      retryAfter: err.retryAfter,
    });
  }
}
