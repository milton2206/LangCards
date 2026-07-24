import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { LANGS, LEVELS } from "./generateCards.js";

// Банк заданий теста на уровень (фаза 6.3). Наполняется ОДИН РАЗ на изучаемый
// язык и дальше переиспользуется всеми пользователями — генерация «под
// конкретного пользователя» запрещена: тест должен быть бесплатным в момент
// прохождения, платим только за первое наполнение языка.
//
// Ключи только на сервере: ANTHROPIC_API_KEY (генерация) и
// SUPABASE_SERVICE_ROLE_KEY (запись в таблицу — политик insert у placement_items
// нет вовсе, писать может только service_role).
//
// Справочники языков и уровней переиспользуются из generateCards.js.

export const PLACEMENT_LEVELS = ["a1", "a2", "b1", "b2", "c1"];
// Сколько заданий просим на уровень. ~20 × 5 уровней = ~100 заданий на язык:
// хватает, чтобы тесты не повторялись, и заметно меньше, чем стоил бы банк
// «на каждого пользователя».
export const ITEMS_PER_LEVEL = 20;
// Ниже этого числа заданий на уровень считаем банк недособранным и дозаполняем.
// (Модель иногда возвращает меньше валидных заданий, чем просили.)
const MIN_ITEMS_PER_LEVEL = 12;
const OPTIONS_PER_ITEM = 4;

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

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

// Клиент Supabase с service_role: обходит RLS, поэтому может писать в общий
// банк. Во фронтенд этот ключ не попадает никогда.
function serviceClient() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    const err = new Error(
      "Сервер не настроен: нужны SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY.",
    );
    err.status = 500;
    throw err;
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Достаёт JSON-объект из ответа модели (как в reading.js — устойчиво к обвязке).
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
 * Промпт банка заданий одного уровня. Экспортируется, чтобы формат запроса
 * можно было проверить без вызова API.
 *
 * Главное ограничение: задание должно работать БЕЗ родного языка ученика —
 * банк общий для всех, колонки native_lang в таблице нет.
 */
export function buildPlacementPrompt({ learnLang, level, count = ITEMS_PER_LEVEL }) {
  const learn = LANGS[learnLang]?.name || learnLang;
  const levelName = LEVELS[level] || level;

  return `Составь ${count} тестовых заданий для определения уровня владения языком: ${learn}.

Уровень заданий: ${levelName}

КРИТИЧНО — задание должно быть понятно БЕЗ перевода:
- Весь текст задания и ВСЕ варианты ответа — только на языке ${learn}. Родной язык ученика неизвестен: банк общий для всех.
- Никаких инструкций внутри задания («выберите», «вставьте» и т.п.) — их даёт интерфейс. В поле question только сам материал.

ТИПЫ ЗАДАНИЙ (примерно поровну обоих):
- "vocab" — узнавание слова: question — ОДНО короткое определение или описание на ${learn} (например «Man trinkt es morgens.»), options — 4 слова, ровно одно подходит по смыслу.
- "cloze" — пропуск в предложении: question — предложение на ${learn} с пропуском ровно из трёх подчёркиваний «___», options — 4 варианта, ровно один верен грамматически и по смыслу.

КАЧЕСТВО (иначе тест не измеряет уровень):
- Все 4 варианта правдоподобны: одна часть речи, похожая длина и форма. Неверные варианты не должны быть нелепыми или явно из другой темы.
- Ровно ОДИН вариант верен; остальные должны быть однозначно неверны — никаких «тоже можно так сказать».
- Задания на этом уровне должен уверенно решать человек уровня ${level.toUpperCase()} и НЕ должен решать человек уровнем ниже. Не делай все задания об одном и том же: разные темы и разная лексика.
- Пиши с полной правильной диакритикой языка: греческий — тонос и диалитика, немецкий — умляуты и ß, испанский — á é í ó ú ñ. Слово без положенной диакритики написано с ошибкой.

Верни ТОЛЬКО валидный JSON-объект строго такого вида:
{
  "items": [
    { "type": "vocab", "question": "текст на ${learn}", "options": ["a", "b", "c", "d"], "correct": "b" }
  ]
}
В массиве "items" — ${count} объектов. Поле "correct" обязано ТОЧНО совпадать с одним из "options". Без markdown, без пояснений, без текста до или после объекта.`;
}

/**
 * Валидация одного задания от модели. Возвращает нормализованный объект или
 * null, если задание непригодно (лучше банк поменьше, чем битые вопросы).
 */
export function normalizeItem(raw, level) {
  if (!raw || typeof raw !== "object") return null;
  const type = raw.type === "cloze" ? "cloze" : "vocab";
  const question = String(raw.question ?? "").trim();
  const correct = String(raw.correct ?? "").trim();
  if (!question || !correct) return null;

  const options = Array.isArray(raw.options)
    ? [...new Set(raw.options.map((o) => String(o ?? "").trim()).filter(Boolean))]
    : [];
  // Ровно 4 разных варианта, среди которых есть правильный — иначе задание
  // либо нерешаемо, либо решается исключением.
  if (options.length !== OPTIONS_PER_ITEM) return null;
  if (!options.includes(correct)) return null;
  // В cloze обязан быть пропуск: без него задание превращается в загадку.
  if (type === "cloze" && !question.includes("___")) return null;

  return { level, type, question, options, correctAnswer: correct };
}

/** Сколько заданий уже лежит в банке языка, по уровням. */
export async function countBank(learnLang) {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("placement_items")
    .select("level")
    .eq("learn_lang", learnLang);
  if (error) {
    const err = new Error(`Не удалось прочитать банк заданий: ${error.message}`);
    err.status = 502;
    throw err;
  }
  const byLevel = Object.fromEntries(PLACEMENT_LEVELS.map((l) => [l, 0]));
  for (const row of data || []) {
    if (byLevel[row.level] != null) byLevel[row.level] += 1;
  }
  return { byLevel, total: (data || []).length };
}

/** Генерирует задания одного уровня (без записи в БД). */
async function generateLevelItems({ learnLang, level, count }) {
  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 4000, // потолок стоимости: 20 коротких заданий помещаются с запасом
    system:
      "Ты — методист, который составляет тестовые задания для определения уровня " +
      "владения иностранным языком по шкале CEFR. Задания одноязычные: и вопрос, " +
      "и варианты только на изучаемом языке. " +
      "Отвечай только валидным JSON-объектом: никаких размышлений, пояснений или markdown до или после него.",
    messages: [
      {
        role: "user",
        content: buildPlacementPrompt({ learnLang, level, count }),
      },
    ],
  });

  const raw = extractJsonObject(textOf(message));
  const items = Array.isArray(raw.items) ? raw.items : [];
  return items.map((i) => normalizeItem(i, level)).filter(Boolean);
}

/**
 * Наполняет банк заданий языка — ОДИН РАЗ. Уровни, где заданий уже достаточно,
 * пропускаются без обращения к модели: повторный вызов почти бесплатен и
 * возвращает { created: 0 }.
 *
 * Возвращает { learnLang, created, byLevel } или бросает Error с .status.
 */
export async function ensurePlacementBank({ learnLang, force = false }) {
  if (!LANGS[learnLang]) {
    const err = new Error(`Неизвестный изучаемый язык: «${learnLang}».`);
    err.status = 400;
    throw err;
  }

  const supabase = serviceClient();
  const { byLevel } = await countBank(learnLang);

  // Что реально нужно догенерировать (обычно — ничего).
  const missing = PLACEMENT_LEVELS.filter(
    (level) => force || byLevel[level] < MIN_ITEMS_PER_LEVEL,
  );
  if (missing.length === 0) {
    return { learnLang, created: 0, byLevel, cached: true };
  }

  let created = 0;
  for (const level of missing) {
    // Догенерируем только недостающее, а не весь уровень заново.
    const need = force
      ? ITEMS_PER_LEVEL
      : Math.max(0, ITEMS_PER_LEVEL - byLevel[level]);
    if (need === 0) continue;

    let items = [];
    try {
      items = await generateLevelItems({ learnLang, level, count: need });
    } catch {
      // Один уровень не удался — не роняем остальные: тест устойчив к тому,
      // что на каком-то уровне заданий меньше (алгоритм берёт ближайший).
      continue;
    }
    if (items.length === 0) continue;

    const rows = items.map((i) => ({
      learn_lang: learnLang,
      level: i.level,
      type: i.type,
      question: i.question,
      options: i.options,
      correct_answer: i.correctAnswer,
    }));

    // Идемпотентность держит уникальный индекс (learn_lang, question):
    // повторный вопрос молча игнорируется, дублей в банке не появляется.
    const { data, error } = await supabase
      .from("placement_items")
      .upsert(rows, {
        onConflict: "learn_lang,question",
        ignoreDuplicates: true,
      })
      .select("id");
    if (error) {
      const err = new Error(`Не удалось сохранить банк заданий: ${error.message}`);
      err.status = 502;
      throw err;
    }
    created += (data || []).length;
  }

  const after = await countBank(learnLang);
  return { learnLang, created, byLevel: after.byLevel, cached: false };
}
