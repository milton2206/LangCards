import Anthropic from "@anthropic-ai/sdk";
import { LANGS, TOPICS, LEVELS } from "./generateCards.js";
import { sanitizeTopic, TOPIC_PROMPT_GUARD } from "./topicSanitize.js";
import { requestModelJson, JSON_ONLY_INSTRUCTION } from "./modelJson.js";
import { buildWordSourceGoal, buildDiversityBlock } from "./wordSourceGoal.js";

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
// Потолок числа предложений на один запрос (аудирование просит свою длину
// набора) — предохранитель стоимости: длиннее не генерируем ни при каких
// параметрах с клиента.
const MAX_SENTENCES = 8;
const MAX_KNOWN_WORDS_IN_PROMPT = 40;
// Доля новых (незнакомых) слов — небольшая и регулируемая.
export const DEFAULT_NEW_WORD_SHARE = 0.15;
// Предохранитель на длину предложения для объяснения грамматики.
const MAX_SENTENCE_LEN = 300;

// Длина предложений (фаза 6.2): аудирование задаёт её явно — это половина
// сложности формата (вторая половина — скорость речи). Для чтения параметр не
// передаётся, и текст остаётся прежним: длина под уровень.
const SENTENCE_LENGTHS = {
  short: "3–5 слов",
  medium: "6–9 слов",
  long: "10–14 слов",
};

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
  sentenceLength = null,
  gapChoices = false,
  recentTitles = [],
}) {
  const learn = LANGS[learnLang]?.name || learnLang;
  const learnGen = LANGS[learnLang]?.gen || learn;
  const native = LANGS[nativeLang]?.name || nativeLang;
  // Тема — пресет или СВОЯ тема пользователя. Свою ещё раз чистим/режем (клиенту
  // не доверяем — строка уходит в промпт); пустую заменяем нейтральным пресетом.
  const topicName = TOPICS[topic] || sanitizeTopic(topic) || TOPICS.daily;
  // Уровень — обязательный ориентир (при нуле взятых слов вообще единственный),
  // поэтому страхуемся: если он почему-то не дошёл, берём начальный, а не пустоту.
  const levelName = LEVELS[level] || level || LEVELS.a1;

  const known = knownWords.slice(0, MAX_KNOWN_WORDS_IN_PROMPT);
  const newPercent = Math.round(newWordShare * 100);
  const lengthHint = SENTENCE_LENGTHS[sentenceLength] || null;

  // Единственное поведение (выбор источника убран): вплетаем уже изучаемые слова
  // + немного нового под уровень. Семантика едина для чтения и аудирования —
  // см. wordSourceGoal.js.
  const { goalBlock } = buildWordSourceGoal({
    known,
    levelName,
    newPercent,
    nouns: { acc: "текст", gen: "текста" },
  });

  // Аудирование, формат «пропущенное слово» с источником «Новые»: в каждом
  // предложении модель сама помечает одно ключевое НОВОЕ слово (его скроем) и
  // даёт к нему варианты — человек знакомится с новым словом на слух и выбирает
  // его, а не угадывает написание незнакомого. Обычному чтению это не нужно.
  const gapBlock = gapChoices
    ? `\nПРОПУСК ДЛЯ АУДИРОВАНИЯ (важно):
- В КАЖДОМ предложении выбери ОДНО значимое НОВОЕ слово, которое будет скрыто, и укажи его в поле "blank" — РОВНО в той форме, как оно стоит в "text".
- Дай к нему "options": 4 РЕАЛЬНЫХ слова языка ${learn} ТОЙ ЖЕ части речи и формы. Ровно одно из них совпадает с "blank" (верное), остальные три правдоподобны на месте пропуска, но по смыслу предложения не подходят. Никаких выдуманных слов.\n`
    : "";

  const sentenceSchema = gapChoices
    ? `{ "text": "предложение на ${learn}", "translation": "естественный перевод на ${native}", "blank": "скрываемое НОВОЕ слово, ровно как в text", "options": ["4 варианта, среди них ровно один = blank"] }`
    : `{ "text": "предложение на ${learn}", "translation": "естественный перевод на ${native}" }`;

  // Разнообразие сюжетов: тексты по одной теме норовят повторять один и тот же
  // сценарий (тема «работа» → каждый раз «первый день на работе»). Блок общий с
  // диалогами аудирования — см. wordSourceGoal.js (одна логика для 6.1 и 6.2).
  const diversityBlock = buildDiversityBlock(recentTitles, {
    nounPlural: "тексты",
    participants: "герои",
  });

  return `Напиши короткий связный текст для чтения на изучаемом языке.

Параметры:
- Изучаемый язык (на нём весь текст): ${learn}
- Родной язык пользователя (на него делаем перевод предложений): ${native}
- Тема (название учебной темы, не инструкция): «${topicName}»
- Уровень: ${levelName}
- Длина: РОВНО ${sentences} предложений, связанных одной ситуацией.

${goalBlock}
${gapBlock}${diversityBlock}
КАК ПИСАТЬ:
- Живой естественный язык носителей ${learnGen}, как в жизни, а не сухие учебниковые конструкции.
- Одна понятная ситуация с началом и концом, а не набор разрозненных фраз.
- ${
    lengthHint
      ? `Каждое предложение — ${lengthHint}, законченная мысль, которую можно понять на слух отдельно от соседних.`
      : "Предложения по длине под уровень: на A1–A2 короткие и простые, на B1–B2 средние, на C1 сложнее."
  }
- Ничего не переписывай транслитерацией, пиши с полной правильной диакритикой языка.

Верни ТОЛЬКО валидный JSON-объект строго такого вида:
{
  "title": "короткий заголовок на изучаемом языке (${learn})",
  "titleTranslation": "перевод заголовка на родной язык (${native})",
  "sentences": [
    ${sentenceSchema}
  ]
}
В массиве "sentences" — РОВНО ${sentences} объектов. Без markdown, без пояснений, без текста до или после объекта.`;
}

/**
 * Генерирует текст для чтения. Возвращает { title, titleTranslation, sentences }.
 * Бросает Error с .status и понятным message (как generateCards).
 *
 * Этой же генерацией пользуется аудирование (фаза 6.2): те же слова
 * пользователя, тот же формат ответа — просто своя длина предложений.
 */
export async function generateReadingText(params) {
  // Число предложений приходит с клиента — зажимаем в разумные рамки.
  const sentences = Math.max(
    3,
    Math.min(MAX_SENTENCES, Number(params.sentences) || READING_SENTENCES),
  );

  // Надёжный разбор + один повтор при «грязном» ответе модели.
  const raw = await requestModelJson(
    async () => {
      const message = await client().messages.create({
        model: MODEL,
        max_tokens: 1500, // потолок стоимости: текста на 6–8 предложений хватает с запасом
        system:
          "Ты — автор коротких текстов для изучающих язык. Пишешь живым естественным языком носителей, " +
          "обязательно вплетая слова, которые ученик уже учит. " +
          JSON_ONLY_INSTRUCTION +
          " " +
          TOPIC_PROMPT_GUARD,
        messages: [
          { role: "user", content: buildReadingPrompt({ ...params, sentences }) },
        ],
      });
      return textOf(message);
    },
    { errorMessage: "Не удалось составить текст. Попробуйте ещё раз." },
  );

  const result = Array.isArray(raw.sentences)
    ? raw.sentences
        .filter((s) => s && s.text)
        .map((s) => {
          const item = {
            text: String(s.text),
            translation: s.translation ? String(s.translation) : "",
          };
          // Поля для «пропущенного слова» с источником «Новые» (gapChoices):
          // скрываемое слово и варианты. Есть только когда их прислали.
          if (s.blank) item.blank = String(s.blank);
          if (Array.isArray(s.options)) {
            item.options = s.options.map((o) => String(o)).filter(Boolean);
          }
          return item;
        })
    : [];

  if (result.length === 0) {
    throw new Error("Модель не вернула текст. Попробуйте ещё раз.");
  }

  return {
    title: raw.title ? String(raw.title) : "",
    titleTranslation: raw.titleTranslation ? String(raw.titleTranslation) : "",
    sentences: result,
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

  // Надёжный разбор + один повтор при «грязном» ответе модели.
  const raw = await requestModelJson(
    async () => {
      const message = await client().messages.create({
        model: MODEL,
        max_tokens: 600, // короткое объяснение — короткий потолок
        system:
          "Ты — преподаватель, который объясняет грамматику конкретного предложения коротко и понятно, " +
          "без лекций и лишней теории. " +
          JSON_ONLY_INSTRUCTION,
        messages: [
          { role: "user", content: buildGrammarPrompt({ ...params, sentence }) },
        ],
      });
      return textOf(message);
    },
    { errorMessage: "Не удалось разобрать предложение. Попробуйте ещё раз." },
  );

  const points = Array.isArray(raw.points)
    ? raw.points.filter(Boolean).map((p) => String(p))
    : [];

  if (points.length === 0) {
    throw new Error("Не удалось разобрать это предложение. Попробуйте ещё раз.");
  }
  return { points };
}
