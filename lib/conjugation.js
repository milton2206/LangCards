import Anthropic from "@anthropic-ai/sdk";
import { LANGS } from "./generateCards.js";
import { requestModelJson, JSON_ONLY_INSTRUCTION } from "./modelJson.js";

// Таблица спряжения глагола ПО ЗАПРОСУ (кнопка на карточке глагола). Отдельный
// вызов модели, поэтому ключ Claude API живёт только здесь, на сервере
// (process.env.ANTHROPIC_API_KEY). Результат кэшируется на клиенте по слову
// (см. src/lib/conjugationClient.js) — повторный запрос не бьёт по API.
//
// Формат специально плоский: 6 лиц × 3 времени только глагольными формами.
// Подписи местоимений (я/ты/…) и заголовки времён рисует UI на родном языке —
// сюда они не приходят, поэтому таблица переиспользуется на любом родном языке.

// Шесть лиц-чисел (общий парадигматический костяк; для греческого полный набор).
export const PERSONS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
// Три времени, как просит задача: настоящее / будущее / прошедшее.
export const TENSES = ["present", "future", "past"];

// Предохранитель: заголовочное слово карточки короткое; длиннее — не наш случай.
const MAX_WORD_LEN = 60;

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
 * Промпт таблицы спряжения. Только формы (без местоимений и пояснений): урок не
 * нужен, нужна таблица. Экспортируется, чтобы формат запроса можно было
 * проверить без вызова API.
 */
export function buildConjugationPrompt({ word, learnLang }) {
  const learn = LANGS[learnLang]?.name || learnLang;

  return `Составь таблицу спряжения глагола по лицам и числам для трёх времён. Нужна ТОЛЬКО таблица форм — без урока, без объяснений.

Слово на изучаемом языке (${learn}): «${word}»

ПРАВИЛА:
- Если «${word}» — НЕ глагол (существительное, прилагательное, наречие, выражение), верни РОВНО {"isVerb": false} и больше ничего.
- Если это глагол — дай формы для ШЕСТИ лиц-чисел: "1sg" (1-е ед., «я»), "2sg" (2-е ед., «ты»), "3sg" (3-е ед., «он/она»), "1pl" (1-е мн., «мы»), "2pl" (2-е мн., «вы»), "3pl" (3-е мн., «они») — в трёх временах:
  - "present" — настоящее время;
  - "future" — будущее время в естественной для языка форме (для греческого — с частицей «θα»: «θα πληρώσω»);
  - "past" — прошедшее время (для греческого — простое прошедшее/аорист: «πλήρωσα»).
- Формы пиши на изучаемом языке (${learn}) с ПОЛНОЙ правильной диакритикой (греческий тонос ά έ ή ί ό ύ ώ и т.п.). Давай ТОЛЬКО глагольную форму (с нужной частицей/вспомогательным словом, если она есть в этом времени) — БЕЗ местоимения и без пояснений.
- Ничего не выдумывай: если какой-то формы в языке нет, оставь для неё пустую строку "".

Верни ТОЛЬКО валидный JSON строго такого вида:
{
  "isVerb": true,
  "conjugation": {
    "present": {"1sg":"…","2sg":"…","3sg":"…","1pl":"…","2pl":"…","3pl":"…"},
    "future":  {"1sg":"…","2sg":"…","3sg":"…","1pl":"…","2pl":"…","3pl":"…"},
    "past":    {"1sg":"…","2sg":"…","3sg":"…","1pl":"…","2pl":"…","3pl":"…"}
  }
}
Без markdown, без пояснений, без текста до или после объекта.`;
}

/**
 * Строит таблицу спряжения. Возвращает { isVerb: false } для не-глагола либо
 * { isVerb: true, conjugation: { present:{1sg…}, future:{…}, past:{…} } }.
 * Бросает Error с .status и понятным message (как остальные генерации).
 */
export async function generateConjugation(params) {
  const word = String(params.word ?? "").trim();
  if (!word) {
    const err = new Error("Пустое слово для спряжения.");
    err.status = 400;
    throw err;
  }
  if (word.length > MAX_WORD_LEN) {
    const err = new Error(
      `Слишком длинное слово (максимум ${MAX_WORD_LEN} символов).`,
    );
    err.status = 400;
    throw err;
  }

  const raw = await requestModelJson(
    async () => {
      const message = await client().messages.create({
        model: MODEL,
        max_tokens: 900, // 18 коротких форм — короткий потолок стоимости
        system:
          "Ты — лингвист, который аккуратно строит таблицы спряжения глаголов. " +
          "Даёшь только глагольные формы с правильной диакритикой, без объяснений. " +
          JSON_ONLY_INSTRUCTION,
        messages: [
          { role: "user", content: buildConjugationPrompt({ ...params, word }) },
        ],
      });
      return textOf(message);
    },
    { errorMessage: "Не удалось построить таблицу спряжения. Попробуйте ещё раз." },
  );

  // Не глагол (или пусто) — честно сообщаем: UI покажет короткое пояснение.
  if (!raw || raw.isVerb === false || !raw.conjugation) {
    return { isVerb: false };
  }

  // Нормализуем к фиксированной форме: все времена и лица присутствуют (пустые —
  // пустой строкой), лишние ключи модели отбрасываем.
  const conjugation = {};
  let any = false;
  for (const tense of TENSES) {
    const row = raw.conjugation[tense] || {};
    const out = {};
    for (const p of PERSONS) {
      out[p] = row[p] ? String(row[p]) : "";
      if (out[p]) any = true;
    }
    conjugation[tense] = out;
  }
  if (!any) return { isVerb: false };

  return { isVerb: true, conjugation };
}
