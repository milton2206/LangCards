import Anthropic from "@anthropic-ai/sdk";
import { LANGS } from "./generateCards.js";

// Аудирование (фаза 6.2), серверная часть. Тут ТОЛЬКО подбор похоже звучащих
// дистракторов для второго формата («на слух»): к слову ищем настоящие слова
// того же языка, которые легко спутать на слух (минимальные пары вроде
// Kirche/Kirsche, ship/sheep).
//
// Первый формат («пропущенное слово») своей серверной генерации НЕ имеет —
// предложения берутся у режима чтения (lib/reading.js), а пропуск делает клиент.
// Здесь не дублируем ни справочники (LANGS из generateCards.js), ни ключ API.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

// Сколько слов за один запрос отдаём модели — предохранитель стоимости.
// Модель часть слов пропустит (для них нет хороших пар), поэтому просим с запасом.
export const MAX_SOUNDALIKE_WORDS = 15;
// Сколько дистракторов на слово максимум (правильный + дистракторы = варианты).
const DISTRACTORS_PER_WORD = 3;

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "Сервер не настроен: не задан ключ ANTHROPIC_API_KEY.",
    );
    err.status = 500;
    throw err;
  }
  return new Anthropic({ apiKey });
}

// Достаёт JSON-массив из ответа модели (устойчиво к обрамляющему тексту).
function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("В ответе модели не найден JSON-массив.");
  }
  return JSON.parse(text.slice(start, end + 1));
}

function textOf(message) {
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Промпт подбора похоже звучащих дистракторов. Экспортируется, чтобы формат
 * запроса можно было проверить без вызова API.
 */
export function buildSoundAlikePrompt({ learnLang, words }) {
  const learn = LANGS[learnLang]?.name || learnLang;
  const list = words.map((w, i) => `${i + 1}. ${w}`).join("\n");

  return `Язык: ${learn}.

Для КАЖДОГО слова из списка подбери до ${DISTRACTORS_PER_WORD} других РЕАЛЬНЫХ слов этого же языка, которые звучат ОЧЕНЬ ПОХОЖЕ — так, что их легко перепутать на слух. Нужны минимальные пары: отличие в одном звуке (например, немецкие Kirche/Kirsche, английские ship/sheep, live/leave).

Список слов:
${list}

ЖЁСТКИЕ ПРАВИЛА:
- Дистрактор — только настоящее, употребительное слово языка ${learn}. Ничего не выдумывай и не коверкай.
- Дистрактор должен реально быть похож по звучанию на исходное слово (близкое произношение), а не по написанию или смыслу.
- Дистрактор не совпадает с исходным словом.
- Если для слова НЕТ хорошей похоже звучащей пары — НЕ придумывай кривую: просто НЕ включай это слово в ответ. Лучше меньше слов, чем натянутые пары.

Верни ТОЛЬКО валидный JSON-массив объектов такого вида:
[{ "word": "исходное слово", "distractors": ["похожее1", "похожее2"] }]
Включай только те слова, для которых нашлись настоящие близкие по звучанию варианты (хотя бы один). Без markdown, без пояснений, без текста до или после массива.`;
}

// Нормализация для сравнения «дистрактор ≠ слово» и дедупликации: регистр не
// важен, а диакритику и буквы сохраняем (это часть звучания/написания).
function norm(s) {
  return String(s ?? "")
    .trim()
    .toLowerCase();
}

/**
 * Приводит сырой ответ модели к чистым заданиям: [{ word, distractors[] }].
 * Оставляет только слова с хотя бы одним настоящим дистрактором (без пары слово
 * бесполезно), дедупит дистракторы, убирает совпадения с самим словом, режет по
 * DISTRACTORS_PER_WORD и возвращает исходное слово в том виде, как его просили.
 * Чистая функция — вынесена, чтобы проверять без вызова модели.
 */
export function normalizeSoundAlikes(raw, askedWords = []) {
  const askedByNorm = new Map(
    (Array.isArray(askedWords) ? askedWords : []).map((w) => [
      norm(w),
      String(w),
    ]),
  );
  const items = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const word = String(entry?.word ?? "").trim();
    if (!word) continue;
    // Отвечаем ровно на то, что спрашивали (модель могла слегка изменить регистр).
    const original = askedByNorm.get(norm(word)) || word;

    const distractors = [];
    const dseen = new Set([norm(original)]);
    for (const d of Array.isArray(entry?.distractors) ? entry.distractors : []) {
      const val = String(d ?? "").trim();
      if (!val || dseen.has(norm(val))) continue;
      dseen.add(norm(val));
      distractors.push(val);
      if (distractors.length >= DISTRACTORS_PER_WORD) break;
    }
    // Без единой настоящей пары слово бесполезно для формата — пропускаем.
    if (distractors.length === 0) continue;
    items.push({ word: original, distractors });
  }
  return items;
}

/**
 * Подбирает похоже звучащие дистракторы для набора слов. Возвращает массив
 * [{ word, distractors: string[] }] ТОЛЬКО для слов, где нашлась хотя бы одна
 * настоящая пара. Бросает Error с .status и понятным message (как generateCards).
 */
export async function generateSoundAlikes({ learnLang, words }) {
  if (!LANGS[learnLang]) {
    const err = new Error(`Неизвестный изучаемый язык: «${learnLang}».`);
    err.status = 400;
    throw err;
  }

  // Чистим вход: убираем пустые, дедупим, режем по лимиту стоимости.
  const clean = [];
  const seen = new Set();
  for (const raw of Array.isArray(words) ? words : []) {
    const w = String(raw ?? "").trim();
    if (!w || seen.has(norm(w))) continue;
    seen.add(norm(w));
    clean.push(w);
    if (clean.length >= MAX_SOUNDALIKE_WORDS) break;
  }
  if (clean.length === 0) {
    const err = new Error("Не переданы слова для подбора вариантов.");
    err.status = 400;
    throw err;
  }

  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 1200, // короткие списки слов — небольшой потолок
    system:
      "Ты — фонетист-носитель языка. Ты подбираешь слова, которые звучат почти одинаково " +
      "и которые легко спутать на слух (минимальные пары). Берёшь только настоящие слова языка, " +
      "ничего не выдумываешь; если похожей пары нет — пропускаешь слово. " +
      "Отвечай только валидным JSON-массивом: никаких размышлений, пояснений или markdown до или после него.",
    messages: [
      { role: "user", content: buildSoundAlikePrompt({ learnLang, words: clean }) },
    ],
  });

  const raw = extractJsonArray(textOf(message));
  return normalizeSoundAlikes(raw, clean);
}
