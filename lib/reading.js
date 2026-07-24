import Anthropic from "@anthropic-ai/sdk";
import { LANGS, TOPICS, LEVELS } from "./generateCards.js";

// Режим чтения (фаза 6.1): короткие тексты под уровень и тему пользователя +
// объяснение грамматики конкретного предложения. Ключ Claude API живёт только
// здесь, на сервере (process.env.ANTHROPIC_API_KEY), во фронтенд не попадает.
//
// Справочники языков/тем/уровней переиспользуются из generateCards.js —
// второго набора описаний не заводим.

// ---------- Ограничители стоимости ----------
// Длина текста фиксирована по числу предложений: дешевле и предсказуемее,
// чем «примерно N слов». Список уже взятых слов тоже урезаем.
export const READING_SENTENCES = 6;
const MAX_KNOWN_WORDS_IN_PROMPT = 40;
// Доля новых (незнакомых) слов — небольшая и регулируемая.
export const DEFAULT_NEW_WORD_SHARE = 0.15;
// Предохранитель на длину предложения для объяснения грамматики.
const MAX_SENTENCE_LEN = 300;

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

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

// Достаёт JSON-объект из ответа модели (устойчиво к обрамляющему тексту).
function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("В ответе модели не найден JSON-объект.");
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
 * Промпт связного текста для чтения. Главное: вплести уже взятые пользователем
 * слова — узнавание знакомого в связном тексте и есть смысл режима.
 * Экспортируется, чтобы формат запроса можно было проверить без вызова API.
 */
export function buildReadingPrompt({
  learnLang,
  nativeLang,
  topic,
  level,
  knownWords = [],
  newWordShare = DEFAULT_NEW_WORD_SHARE,
  sentences = READING_SENTENCES,
}) {
  const learn = LANGS[learnLang]?.name || learnLang;
  const learnGen = LANGS[learnLang]?.gen || learn;
  const native = LANGS[nativeLang]?.name || nativeLang;
  const topicName = TOPICS[topic] || topic;
  // Уровень — обязательный ориентир (при нуле взятых слов вообще единственный),
  // поэтому страхуемся: если он почему-то не дошёл, берём начальный, а не пустоту.
  const levelName = LEVELS[level] || level || LEVELS.a1;

  const known = knownWords.slice(0, MAX_KNOWN_WORDS_IN_PROMPT);
  const newPercent = Math.round(newWordShare * 100);

  // У нового пользователя своих слов ещё нет — вплетать нечего, и единственным
  // ориентиром остаётся УРОВЕНЬ. Это не поломка, а обычный адаптированный текст:
  // режим чтения сам по себе способ набирать слова (тап → «Взять»).
  const goalBlock = known.length
    ? `ГЛАВНОЕ — узнавание знакомого:
- Обязательно вплети в текст слова, которые пользователь уже учит (список ниже). Возьми столько из них, сколько получится вплести ЕСТЕСТВЕННО, — это главный смысл текста. Форму слова меняй свободно (падеж, число, время), это нормально.
- Если слов в списке мало — вплети ВСЕ, какие получится, а остальное добери самой частотной лексикой этого уровня.
- Незнакомых слов — немного, примерно ${newPercent}% текста: чтобы было чуть-чуть нового, но читалось легко.

Слова пользователя (вплетай их):
${known.map((w) => `- ${w}`).join("\n")}`
    : `ГЛАВНОЕ — текст строго под уровень:
- Своих слов у пользователя пока нет, поэтому ЕДИНСТВЕННЫЙ ориентир — ${levelName}. Держись его строго.
- Бери самую частотную и полезную лексику этого уровня: текст должен читаться легко и целиком состоять из слов, которые на этом уровне реально нужны.
- Не усложняй ради интереса: лучше простое и живое, чем редкое и вычурное. Все слова здесь для пользователя новые — это нормально.`;

  return `Напиши короткий связный текст для чтения на изучаемом языке.

Параметры:
- Изучаемый язык (на нём весь текст): ${learn}
- Родной язык пользователя (на него делаем перевод предложений): ${native}
- Тема: ${topicName}
- Уровень: ${levelName}
- Длина: РОВНО ${sentences} предложений, связанных одной ситуацией.

${goalBlock}

КАК ПИСАТЬ:
- Живой естественный язык носителей ${learnGen}, как в жизни, а не сухие учебниковые конструкции.
- Одна понятная ситуация с началом и концом, а не набор разрозненных фраз.
- Предложения по длине под уровень: на A1–A2 короткие и простые, на B1–B2 средние, на C1 сложнее.
- Ничего не переписывай транслитерацией, пиши с полной правильной диакритикой языка.

Верни ТОЛЬКО валидный JSON-объект строго такого вида:
{
  "title": "короткий заголовок на изучаемом языке (${learn})",
  "titleTranslation": "перевод заголовка на родной язык (${native})",
  "sentences": [
    { "text": "предложение на ${learn}", "translation": "естественный перевод на ${native}" }
  ]
}
В массиве "sentences" — РОВНО ${sentences} объектов. Без markdown, без пояснений, без текста до или после объекта.`;
}

/**
 * Генерирует текст для чтения. Возвращает { title, titleTranslation, sentences }.
 * Бросает Error с .status и понятным message (как generateCards).
 */
export async function generateReadingText(params) {
  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 1500, // потолок стоимости: текста на 6 предложений хватает с запасом
    system:
      "Ты — автор коротких текстов для изучающих язык. Пишешь живым естественным языком носителей, " +
      "обязательно вплетая слова, которые ученик уже учит. " +
      "Отвечай только валидным JSON-объектом: никаких размышлений, пояснений или markdown до или после него.",
    messages: [{ role: "user", content: buildReadingPrompt(params) }],
  });

  const raw = extractJsonObject(textOf(message));
  const sentences = Array.isArray(raw.sentences)
    ? raw.sentences
        .filter((s) => s && s.text)
        .map((s) => ({
          text: String(s.text),
          translation: s.translation ? String(s.translation) : "",
        }))
    : [];

  if (sentences.length === 0) {
    throw new Error("Модель не вернула текст. Попробуйте ещё раз.");
  }

  return {
    title: raw.title ? String(raw.title) : "",
    titleTranslation: raw.titleTranslation ? String(raw.titleTranslation) : "",
    sentences,
  };
}

/**
 * Промпт объяснения грамматики КОНКРЕТНОГО предложения на родном языке.
 * Коротко и по делу, без лекции и без общей теории.
 */
export function buildGrammarPrompt({ sentence, learnLang, nativeLang, level }) {
  const learn = LANGS[learnLang]?.name || learnLang;
  const native = LANGS[nativeLang]?.name || nativeLang;
  const levelName = LEVELS[level] || level;

  return `Объясни грамматику ОДНОГО конкретного предложения — коротко и по делу.

Предложение на изучаемом языке (${learn}):
«${sentence}»

Параметры:
- Объяснение пиши на родном языке пользователя: ${native}
- Уровень пользователя: ${levelName}

КАК ОБЪЯСНЯТЬ:
- Только то, что реально работает В ЭТОМ предложении: почему такой падеж, такой артикль, такая форма глагола, такой порядок слов.
- 2–4 коротких пункта, каждый — одна мысль в одну строку. Без вступлений и выводов.
- Без лекции и общей теории: не пересказывай всю грамматику языка, объясняй только эти конкретные места.
- Под уровень пользователя: на A1–A2 совсем просто, без терминов там, где можно без них; на B1+ можно называть вещи своими именами.
- Если в предложении есть характерная «ловушка» для говорящего на ${native} — скажи о ней одним пунктом.

Верни ТОЛЬКО валидный JSON-объект:
{
  "points": ["пункт 1", "пункт 2"]
}
Без markdown, без пояснений, без текста до или после объекта.`;
}

/**
 * Объясняет грамматику предложения. Возвращает { points: string[] }.
 * Кэширование — на клиенте по хешу (предложение + родной язык), см.
 * src/lib/readingClient.js: повторный тап того же предложения не бьёт по API.
 */
export async function explainGrammar(params) {
  const sentence = String(params.sentence ?? "").trim();
  if (!sentence) {
    const err = new Error("Пустое предложение для разбора.");
    err.status = 400;
    throw err;
  }
  if (sentence.length > MAX_SENTENCE_LEN) {
    const err = new Error(
      `Предложение слишком длинное (максимум ${MAX_SENTENCE_LEN} символов).`,
    );
    err.status = 400;
    throw err;
  }

  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 600, // короткое объяснение — короткий потолок
    system:
      "Ты — преподаватель, который объясняет грамматику конкретного предложения коротко и понятно, " +
      "без лекций и лишней теории. " +
      "Отвечай только валидным JSON-объектом: никаких размышлений, пояснений или markdown до или после него.",
    messages: [
      { role: "user", content: buildGrammarPrompt({ ...params, sentence }) },
    ],
  });

  const raw = extractJsonObject(textOf(message));
  const points = Array.isArray(raw.points)
    ? raw.points.filter(Boolean).map((p) => String(p))
    : [];

  if (points.length === 0) {
    throw new Error("Не удалось разобрать это предложение. Попробуйте ещё раз.");
  }
  return { points };
}
