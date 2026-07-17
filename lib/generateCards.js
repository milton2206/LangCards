import Anthropic from "@anthropic-ai/sdk";

// Человекочитаемые названия для промпта (id из онбординга -> описание).
const LANGS = {
  de: "немецкий (German)",
  en: "английский (English)",
  el: "греческий (Greek)",
  es: "испанский (Spanish)",
  ru: "русский (Russian)",
  uk: "украинский (Ukrainian)",
};
const TOPICS = {
  work: "работа и профессиональная сфера",
  housing: "аренда и поиск жилья",
  doctor: "визит к врачу и здоровье",
  travel: "путешествия",
  daily: "повседневное общение",
  restaurant: "ресторан и кафе",
};
const LEVELS = {
  a1: "уровень A1 (CEFR): самые базовые, высокочастотные слова; очень простые короткие предложения",
  a2: "уровень A2 (CEFR): простая повседневная лексика; несложные предложения",
  b1: "уровень B1 (CEFR): средний уровень; более разнообразная лексика и обычные бытовые ситуации",
  b2: "уровень B2 (CEFR): выше среднего; менее частотная лексика, более сложные предложения",
  c1: "уровень C1 (CEFR): продвинутый; сложная лексика, идиомы и выражения носителей языка",
};

/**
 * Собирает промпт для генерации карточек.
 * Экспортируется отдельно, чтобы можно было проверить формат запроса без вызова API.
 */
export function buildPrompt({
  learnLang,
  nativeLang,
  topic,
  level,
  exclude = [],
  count = 10,
}) {
  const learn = LANGS[learnLang] || learnLang;
  const native = LANGS[nativeLang] || nativeLang;
  const topicName = TOPICS[topic] || topic;
  const levelName = LEVELS[level] || level;
  const excludeList = exclude.length
    ? exclude.map((w) => `- ${w}`).join("\n")
    : "(пока нет)";

  return `Сгенерируй ${count} карточек для изучения иностранных слов В КОНТЕКСТЕ.

Параметры:
- Изучаемый язык (на нём слово и пример): ${learn}
- Родной язык пользователя (на него делаем перевод): ${native}
- Тема: ${topicName}
- Уровень: ${levelName}

Каждая карточка — объект строго с такими полями:
- "word": слово или выражение на изучаемом языке (${learn}) по теме и уровню. Для существительных указывай артикль, если он есть в языке.
- "translit": подсказка по произношению в квадратных скобках, средствами родного языка (${native}) или в виде IPA.
- "translation": перевод СТРОГО на родной язык пользователя (${native}).
- "example": естественное предложение на изучаемом языке (${learn}), где это слово используется в контексте.
- "exampleTranslation": перевод этого предложения на родной язык (${native}).

НЕ используй эти слова — они уже известны пользователю:
${excludeList}

Верни ТОЛЬКО валидный JSON-массив из ${count} таких объектов. Без markdown, без пояснений, без текста до или после массива.`;
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

/**
 * Генерирует порцию карточек через Claude API.
 * Возвращает массив карточек или бросает Error с понятным message (и .status).
 */
export async function generateCards(params) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error(
      "Сервер не настроен: не задан ключ ANTHROPIC_API_KEY.",
    );
    err.status = 500;
    throw err;
  }

  const client = new Anthropic({ apiKey });
  // Haiku — самая дешёвая модель; её качества для генерации карточек достаточно.
  const model = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

  const message = await client.messages.create({
    model,
    max_tokens: 4096,
    system:
      "Ты — генератор учебных карточек для изучения иностранных слов в контексте. " +
      "Отвечай только валидным JSON-массивом карточек: никаких размышлений, пояснений или markdown до или после массива.",
    messages: [{ role: "user", content: buildPrompt(params) }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  const raw = extractJsonArray(text);
  const excludeSet = new Set(
    (params.exclude || []).map((w) => String(w).toLowerCase()),
  );

  const cards = raw
    .filter((c) => c && c.word && c.translation && c.example)
    .filter((c) => !excludeSet.has(String(c.word).toLowerCase()))
    .map((c) => ({
      word: String(c.word),
      translit: c.translit ? String(c.translit) : "",
      translation: String(c.translation),
      example: String(c.example),
      exampleTranslation: c.exampleTranslation
        ? String(c.exampleTranslation)
        : "",
    }));

  if (cards.length === 0) {
    throw new Error("Модель не вернула ни одной карточки. Попробуйте ещё раз.");
  }
  return cards;
}
