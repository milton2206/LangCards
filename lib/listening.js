import Anthropic from "@anthropic-ai/sdk";
import { LANGS, LEVELS } from "./generateCards.js";
import { requestModelJson, JSON_ONLY_INSTRUCTION } from "./modelJson.js";

// Аудирование (фаза 6.2), серверная часть. Формат «на слух»: к слову подбираем
// настоящие слова того же языка, которые легко спутать на слух (минимальные
// пары вроде Kirche/Kirsche, ship/sheep). Сами слова берутся по источнику
// (mine/mixed/new): «мои» — преимущественно из слов пользователя, «смешанно» —
// пополам с новыми, «новые» — незнакомые слова под уровень (модель их подбирает).
//
// Формат «пропущенное слово» своей серверной генерации НЕ имеет — предложения
// берутся у режима чтения (lib/reading.js). Справочники (LANGS/LEVELS) и ключ
// API не дублируем.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

// Сколько слов пользователя за один запрос отдаём модели — предохранитель
// стоимости. Часть слов модель пропустит (нет хороших пар) — просим с запасом.
export const MAX_SOUNDALIKE_WORDS = 15;
// Сколько дистракторов на слово максимум (правильный + дистракторы = варианты).
const DISTRACTORS_PER_WORD = 3;
// Сколько заданий в подходе просим у модели по умолчанию.
const DEFAULT_SOUNDALIKE_COUNT = 6;

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

function textOf(message) {
  return message.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

/**
 * Промпт подбора похоже звучащих дистракторов, зависящий от источника слов.
 * Экспортируется, чтобы формат запроса можно было проверить без вызова API.
 */
export function buildSoundAlikePrompt({
  learnLang,
  nativeLang,
  level,
  words = [],
  source = "mixed",
  count = DEFAULT_SOUNDALIKE_COUNT,
}) {
  const learn = LANGS[learnLang]?.name || learnLang;
  const native = LANGS[nativeLang]?.name || nativeLang;
  const levelName = LEVELS[level] || level || "";
  const list = words.length
    ? words.map((w, i) => `${i + 1}. ${w}`).join("\n")
    : "(список пуст)";

  // Правило выбора слов по источнику. Само задание (похожая по звучанию пара +
  // перевод) одинаково для всех источников — меняется только, ОТКУДА брать слова.
  let sourceRule;
  if (source === "new") {
    sourceRule = `ИСТОЧНИК СЛОВ — НОВЫЕ (расширение словаря):
- Возьми ${count} РЕАЛЬНЫХ слов языка ${learn} уровня «${levelName}», которые пользователь, скорее всего, ещё НЕ знает.
- Слова из списка ниже НЕ используй как задания — они уже знакомы, они здесь только как «избегать».`;
  } else if (source === "mine") {
    sourceRule = `ИСТОЧНИК СЛОВ — ПРЕИМУЩЕСТВЕННО МОИ:
- Бери слова в основном из списка ниже — те, для которых есть настоящая похоже звучащая пара.
- Если таких набирается меньше ${count}, ДОБЕРИ недостающее реальными словами уровня «${levelName}» с парами. Но слова из списка должны остаться БОЛЬШИНСТВОМ.`;
  } else {
    sourceRule = `ИСТОЧНИК СЛОВ — СМЕШАННО:
- Примерно половину из ${count} слов возьми из списка ниже (те, для которых есть похоже звучащая пара), остальные — реальные слова уровня «${levelName}» с парами.`;
  }

  return `Язык: ${learn}.

Собери ${count} заданий на распознавание слова НА СЛУХ. Для каждого выбранного слова нужна похоже звучащая пара — настоящие слова того же языка, которые легко перепутать на слух (минимальные пары: отличие в одном звуке, например Kirche/Kirsche, ship/sheep, live/leave).

${sourceRule}

Список слов пользователя (по правилу выше — источник или «избегать»):
${list}

Для КАЖДОГО выбранного слова:
- подбери до ${DISTRACTORS_PER_WORD} РЕАЛЬНЫХ похоже звучащих слов языка ${learn} (минимальные пары, отличие в одном звуке);
- дай короткий перевод самого слова на родной язык пользователя (${native}).

ЖЁСТКИЕ ПРАВИЛА:
- Только настоящие, употребительные слова языка ${learn}. Ничего не выдумывай и не коверкай.
- Дистрактор близок по ЗВУЧАНИЮ (а не по написанию/смыслу) и не совпадает с самим словом.
- Если для слова НЕТ хорошей похоже звучащей пары — НЕ придумывай кривую, просто не бери это слово. Лучше меньше заданий, чем натянутые пары.

Верни ТОЛЬКО валидный JSON-массив объектов такого вида:
[{ "word": "слово", "distractors": ["похожее1", "похожее2"], "translation": "перевод на ${native}" }]
Включай только слова с настоящей похоже звучащей парой (хотя бы одной). Без markdown, без пояснений, без текста до или после массива.`;
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
    const translation = String(entry?.translation ?? "").trim();
    items.push({ word: original, distractors, translation });
  }
  return items;
}

/**
 * Подбирает слова на слух по источнику (mine/mixed/new) и к каждому — похоже
 * звучащую пару. Возвращает [{ word, distractors[], translation }] только для
 * слов с настоящей парой. Бросает Error с .status и понятным message.
 */
export async function generateSoundAlikes({
  learnLang,
  nativeLang,
  level,
  words,
  source = "mixed",
  count = DEFAULT_SOUNDALIKE_COUNT,
}) {
  if (!LANGS[learnLang]) {
    const err = new Error(`Неизвестный изучаемый язык: «${learnLang}».`);
    err.status = 400;
    throw err;
  }

  const src = ["mine", "mixed", "new"].includes(source) ? source : "mixed";

  // Чистим слова пользователя: убираем пустые, дедупим, режем по лимиту.
  const clean = [];
  const seen = new Set();
  for (const raw of Array.isArray(words) ? words : []) {
    const w = String(raw ?? "").trim();
    if (!w || seen.has(norm(w))) continue;
    seen.add(norm(w));
    clean.push(w);
    if (clean.length >= MAX_SOUNDALIKE_WORDS) break;
  }
  // Для «мои»/«смешанно» нужны слова пользователя; для «новые» модель берёт
  // слова уровня сама, поэтому пустой список допустим.
  if (clean.length === 0 && src !== "new") {
    const err = new Error("Не переданы слова для подбора вариантов.");
    err.status = 400;
    throw err;
  }

  // Надёжный разбор + один повтор при «грязном» ответе модели.
  const raw = await requestModelJson(
    async () => {
      const message = await client().messages.create({
        model: MODEL,
        max_tokens: 1600, // 6 заданий с парами и переводами — с запасом
        system:
          "Ты — фонетист-носитель языка. Ты подбираешь слова, которые звучат почти одинаково " +
          "и которые легко спутать на слух (минимальные пары). Берёшь только настоящие слова языка, " +
          "ничего не выдумываешь; если похожей пары нет — пропускаешь слово. " +
          JSON_ONLY_INSTRUCTION,
        messages: [
          {
            role: "user",
            content: buildSoundAlikePrompt({
              learnLang,
              nativeLang,
              level,
              words: clean,
              source: src,
              count,
            }),
          },
        ],
      });
      return textOf(message);
    },
    {
      errorMessage: "Не удалось составить задание. Попробуйте ещё раз.",
      validate: (r) => normalizeSoundAlikes(r, clean).length > 0,
    },
  );

  // askedWords передаём для сохранения исходного регистра «моих» слов; новые
  // слова модели пройдут как есть.
  return normalizeSoundAlikes(raw, clean);
}
