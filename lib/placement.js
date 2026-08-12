import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { LANGS, LEVELS } from "./generateCards.js";
import { requestModelJson, JSON_ONLY_INSTRUCTION } from "./modelJson.js";
import { shuffled } from "./shuffle.js";

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

// Бюджет времени на ОДИН вызов наполнения. Sonnet отвечает заметно медленнее
// Haiku, а на каждый уровень приходится два вызова (генерация + слепая
// проверка) и до трёх попыток добора — все пять уровней в один запрос к
// серверной функции не помещаются. Поэтому берём столько уровней, сколько
// успеваем: перед КАЖДЫМ уровнем смотрим на часы и, если бюджет вышел,
// возвращаем остаток в ответе вместо того, чтобы быть убитыми по таймауту.
//
// Дублей это не создаёт: каждый уровень пишется в банк сразу после сбора, а
// запись идёт upsert-ом по (learn_lang, question) — повторный вызов дособирает
// недостающее и молча пропустит уже лежащие вопросы.
const FILL_BUDGET_MS = 45_000;

// Банк заданий — ЕДИНСТВЕННОЕ место, где нужна сильная модель, и здесь для неё
// своя переменная окружения. Haiku не тянет составление заданий C1: чтобы
// развести близкие синонимы и не собрать несуществующий оборот («важно ___ на
// точку» с ответом «попадать»), нужно уверенное чувство сочетаемости. Три
// эшелона защиты — промпт, механический фильтр, проверочный вызов — брак не
// убрали, потому что проблема не в инструкциях.
//
// Глобальную ANTHROPIC_MODEL не трогаем: карточки, тексты, диалоги, грамматика
// и спряжения остаются на Haiku — там качество устраивает, а объём вызовов
// несопоставимо больше. Банк наполняется один раз на язык, поэтому разница в
// цене разовая.
const MODEL =
  process.env.ANTHROPIC_MODEL_PLACEMENT || "claude-sonnet-4-6";

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
 *
 * Про однозначность (главная беда качества): модель охотно пишет определение
 * общей идеи, под которое подходит половина синонимического ряда, и помечает
 * верным одно из них наугад. Лечится это НЕ разведением вариантов по смыслу —
 * различать оттенки синонимов и есть проверяемый навык на высоких уровнях, —
 * а требованием к самому определению: в нём должна быть деталь, отсекающая
 * соседей. Плюс явная самопроверка каждого задания перед выдачей.
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
- "vocab" — узнавание слова: question — ОДНО короткое определение на ${learn} (например «Man trinkt es morgens.»), options — 4 слова одной части речи, ровно одно подходит.
  ОПРЕДЕЛЕНИЕ ОБЯЗАНО УКАЗЫВАТЬ НА ОДНО СЛОВО. Назвать общую идею мало: под общую идею подходит половина синонимического ряда. Включи в определение ту деталь, которая отличает нужное слово от близких, — сферу употребления, объект действия, оттенок, регистр, намеренность, отношение говорящего.
  Плохо: «попытка скрыть или смягчить что-то неприятное» — под это подходят сразу несколько слов, и задание становится гаданием.
  Хорошо: «сознательное умолчание о факте, который следовало сообщить» — подходит ровно одному слову, даже когда рядом стоят его синонимы.
- "cloze" — пропуск в предложении: question — предложение на ${learn} с пропуском ровно из трёх подчёркиваний «___», options — 4 варианта.
  ПРЕДЛОЖЕНИЕ ОБЯЗАНО ДОПУСКАТЬ РОВНО ОДИН ВАРИАНТ — и грамматически, и по смыслу. Если осмысленное предложение дают два варианта, задание не годится: добавь в САМО предложение уточняющий контекст (обстоятельство, дополнение, продолжение фразы), после которого остаётся один ответ.

САМОПРОВЕРКА — делай для КАЖДОГО задания, прежде чем включить его в ответ:
- Перебери три неверных варианта по одному и честно спроси: подходит ли ЭТОТ вариант под моё определение (или в мой пропуск)? Если подходит хотя бы один — у задания два верных ответа, в таком виде оно не годится.
- Чинить надо ОПРЕДЕЛЕНИЕ (или контекст предложения), а НЕ варианты. Заменять близкие слова далёкими запрещено: различать оттенки синонимов — это и есть проверяемый навык.
- Если уточнить определение так и не вышло — выбрось это задание и составь вместо него другое.

БЛИЗОСТЬ ВАРИАНТОВ ЗАВИСИТ ОТ УРОВНЯ, ЧЁТКОСТЬ ОПРЕДЕЛЕНИЯ — НЕТ:
- A1–A2: варианты могут быть далёкими по значению — проверяется базовое узнавание.
- B1: варианты из одной темы или одного смыслового поля.
- B2–C1: варианты — близкие синонимы или паронимы, различие тонкое. Определение при этом обязано быть ТОЧНЕЕ, а не расплывчатее: высокий уровень — это тонкое различие при чётком определении, а не догадка при туманном.

КАЧЕСТВО (иначе тест не измеряет уровень):
- Все 4 варианта правдоподобны: одна часть речи, похожая длина и форма. Неверные варианты не должны быть нелепыми или явно из другой темы.
- Ровно ОДИН вариант верен; остальные должны быть однозначно неверны — никаких «тоже можно так сказать».
- НЕ ставь правильный вариант всегда первым в "options". Распределяй его позицию по заданиям равномерно: примерно поровну на 1-ю, 2-ю, 3-ю и 4-ю. Тест, где верный ответ всегда первый, не измеряет уровень — его проходят, не читая заданий.
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

  // Модель почти всегда ставит правильный вариант первым, и порядок так и
  // доезжал до экрана — тест проходился без чтения заданий. Перемешиваем здесь
  // как СТРАХОВКУ на случай, если банк читают в обход экрана; основное
  // перемешивание — при показе (см. PlacementScreen), потому что оно чинит и
  // задания, уже накопленные в банке со старым порядком.
  return { level, type, question, options: shuffled(options), correctAnswer: correct };
}

// ============================================================================
// Проверки качества ПОСЛЕ генерации, до записи в банк
// ----------------------------------------------------------------------------
// Требований в промпте оказалось мало. Модель не ловит собственные ошибки по
// просьбе «проверь себя»: для неё выбранный ответ и есть верный. В свежем банке
// подряд встречались задания с двумя подходящими вариантами («способность
// быстро адаптироваться» → и гибкость, и пластичность) и задания, где ответ
// лежит в тексте вопроса («сообщение ДЛЯ ПРЕДУПРЕЖДЕНИЯ» → «предупреждение»).
// Поэтому фильтруем снаружи: сперва дёшево и механически, затем вторым вызовом
// модели, которая решает задания ВСЛЕПУЮ — не зная, что помечено верным.
// ============================================================================

// Сколько раз добираем порцию, если после отсева заданий не хватило. Потолок
// нужен, чтобы сорвавшаяся генерация не крутилась и не жгла лимит.
const MAX_FILL_ATTEMPTS = 3;
// Длина общего начала, при которой считаем слова однокоренными.
const STEM_PREFIX = 5;
// Слова короче этого в сравнении не участвуют: артикли и предлоги совпадают
// началами чаще, чем значат что-то общее.
const MIN_WORD_LEN = 4;

function wordsOf(text) {
  return String(text ?? "").toLowerCase().match(/[\p{L}\p{M}]+/gu) || [];
}

function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

// Однокоренные ли слова. Точная лемматизация не нужна: лучше отбросить лишнее
// задание, чем пропустить подсказку. Ловим и словоформы («предупреждение» /
// «предупреждения»), и производные («предупреждение» / «предупредить»), и
// случай, когда одно слово целиком начинает другое («warn» / «warning»).
function sharesStem(a, b) {
  if (a === b) return true;
  const prefix = commonPrefixLen(a, b);
  if (prefix >= STEM_PREFIX) return true;
  const shorter = Math.min(a.length, b.length);
  return prefix === shorter && shorter >= MIN_WORD_LEN;
}

/**
 * Лежит ли ответ в тексте самого задания. Такое задание решается без знания
 * языка, поэтому в банк не идёт. Работает и для vocab (определение), и для
 * cloze (предложение с пропуском) — question в обоих случаях один.
 */
export function answerLeaksInQuestion(question, correct) {
  const inQuestion = wordsOf(question);
  return wordsOf(correct)
    .filter((w) => w.length >= MIN_WORD_LEN)
    .some((answerWord) => inQuestion.some((q) => sharesStem(q, answerWord)));
}

/**
 * Промпт слепой проверки: модель получает задания БЕЗ пометки правильного
 * ответа и решает их сама. Батчем на весь уровень — так вдвое дешевле и
 * быстрее, чем по одному. Экспортируется для проверки формата без вызова API.
 */
export function buildVerifyPrompt({ learnLang, items }) {
  const learn = LANGS[learnLang]?.name || learnLang;
  const list = items
    .map((item, i) => {
      const head =
        item.type === "cloze"
          ? `Предложение с пропуском: «${item.question}»`
          : `Определение: «${item.question}»`;
      const opts = item.options.map((o) => `«${o}»`).join(", ");
      return `${i + 1}. ${head}\n   Варианты: ${opts}`;
    })
    .join("\n");

  return `Реши тестовые задания по языку ${learn} и оцени, годятся ли они для теста на уровень.

Для КАЖДОГО задания:
- "answer" — вариант, который ты считаешь правильным. Скопируй его ТОЧНО, символ в символ, из списка вариантов этого задания.
- "alsoFit" — список ДРУГИХ вариантов этого же задания, которые тоже подходят под определение (или тоже дают осмысленное и грамматичное предложение в пропуске). Если таких нет — пустой массив.

Как заполнять "alsoFit" (это главное):
- Проверь каждый вариант отдельно и честно. Вопрос не «какой вариант лучше», а «можно ли этот вариант назвать подходящим под определение».
- Близкие синонимы — обычный случай в таком тесте, и сами по себе они не повод считать вариант подходящим. Но если определение сформулировано так широко, что под него честно попадает и второй вариант, — впиши его в "alsoFit".
- Не оправдывай задание. Список "alsoFit" нужен, чтобы отбраковать плохо составленные задания, а не чтобы их защитить.

ЗАДАНИЯ:
${list}

Верни ТОЛЬКО валидный JSON-объект строго такого вида:
{
  "answers": [
    { "n": 1, "answer": "точный текст варианта", "alsoFit": [] }
  ]
}
В массиве "answers" — ровно ${items.length} объектов, по одному на задание, "n" — номер задания. Без markdown, без пояснений, без текста до или после объекта.`;
}

// Приводит вариант к виду для сравнения: регистр и краевые пробелы не считаем
// расхождением (модель их иногда меняет), всё остальное должно совпасть.
function sameOption(a, b) {
  return String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
}

/**
 * Слепая проверка порции заданий моделью. Возвращает { kept, rejected }, где
 * rejected — [{ item, reason }] с причинами:
 *   modelDisagrees — модель выбрала другой вариант (значит верных ответов
 *                    несколько либо помечен неверный);
 *   ambiguous      — модель назвала ещё подходящие варианты;
 *   noVerdict      — на задание не пришло ответа;
 *   verifyFailed   — сам вызов проверки не удался (порцию не пишем: непроверенное
 *                    задание — ровно то, от чего мы уходим).
 */
async function verifyLevelItems({ learnLang, items }) {
  if (items.length === 0) return { kept: [], rejected: [] };

  let raw;
  try {
    raw = await requestModelJson(
      async () => {
        const message = await client().messages.create({
          model: MODEL,
          max_tokens: 1500, // только вердикты: номер, вариант, список подходящих
          system:
            "Ты — придирчивый методист, который принимает чужие тестовые задания. " +
            "Ты решаешь задание сам, не зная авторского ответа, и отмечаешь, если " +
            "под условие подходит больше одного варианта. " +
            JSON_ONLY_INSTRUCTION,
          messages: [
            { role: "user", content: buildVerifyPrompt({ learnLang, items }) },
          ],
        });
        return textOf(message);
      },
      {
        errorMessage: "Не удалось проверить задания.",
        validate: (r) => Array.isArray(r?.answers) && r.answers.length > 0,
      },
    );
  } catch {
    return { kept: [], rejected: items.map((item) => ({ item, reason: "verifyFailed" })) };
  }

  const verdicts = new Map();
  for (const a of Array.isArray(raw.answers) ? raw.answers : []) {
    const n = Number(a?.n);
    if (Number.isInteger(n)) verdicts.set(n, a);
  }

  const kept = [];
  const rejected = [];
  items.forEach((item, i) => {
    const verdict = verdicts.get(i + 1);
    if (!verdict) {
      rejected.push({ item, reason: "noVerdict" });
      return;
    }
    if (!sameOption(verdict.answer, item.correctAnswer)) {
      rejected.push({ item, reason: "modelDisagrees" });
      return;
    }
    const alsoFit = (Array.isArray(verdict.alsoFit) ? verdict.alsoFit : [])
      .map((o) => String(o ?? "").trim())
      .filter((o) => o && !sameOption(o, item.correctAnswer));
    if (alsoFit.length > 0) {
      rejected.push({ item, reason: "ambiguous" });
      return;
    }
    kept.push(item);
  });
  return { kept, rejected };
}

function emptyStats() {
  return {
    attempts: 0,
    generated: 0,
    kept: 0,
    written: 0,
    rejected: {
      answerInQuestion: 0,
      modelDisagrees: 0,
      ambiguous: 0,
      noVerdict: 0,
      verifyFailed: 0,
    },
  };
}

/**
 * Набирает годные задания одного уровня: генерация → механический фильтр →
 * слепая проверка моделью, и так до MAX_FILL_ATTEMPTS раз, пока не наберётся
 * нужное количество. Не бросает: сколько набралось, столько и вернёт — банк с
 * недобором лучше, чем упавшее наполнение.
 */
async function collectLevelItems({ learnLang, level, need }) {
  const stats = emptyStats();
  const kept = [];
  const seen = new Set(); // одинаковые вопросы внутри одного набора не копим

  for (let attempt = 1; attempt <= MAX_FILL_ATTEMPTS && kept.length < need; attempt += 1) {
    stats.attempts = attempt;

    let batch;
    try {
      batch = await generateLevelItems({
        learnLang,
        level,
        count: need - kept.length,
      });
    } catch {
      break; // генерация сорвалась (внутри уже был повтор) — уровень пропускаем
    }
    stats.generated += batch.length;

    // 1) Механический фильтр: ответ не должен лежать в тексте задания.
    const candidates = [];
    for (const item of batch) {
      if (seen.has(item.question)) continue;
      if (answerLeaksInQuestion(item.question, item.correctAnswer)) {
        stats.rejected.answerInQuestion += 1;
        continue;
      }
      candidates.push(item);
    }

    // 2) Слепая проверка моделью.
    const { kept: passed, rejected } = await verifyLevelItems({
      learnLang,
      items: candidates,
    });
    for (const r of rejected) {
      stats.rejected[r.reason] = (stats.rejected[r.reason] || 0) + 1;
    }
    for (const item of passed) {
      if (seen.has(item.question)) continue;
      seen.add(item.question);
      kept.push(item);
    }
  }

  stats.kept = kept.length;
  return { items: kept, stats };
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
  // Надёжный разбор + один повтор при «грязном» ответе модели.
  const raw = await requestModelJson(
    async () => {
      const message = await client().messages.create({
        model: MODEL,
        max_tokens: 4000, // потолок стоимости: 20 коротких заданий помещаются с запасом
        system:
          "Ты — методист, который составляет тестовые задания для определения уровня " +
          "владения иностранным языком по шкале CEFR. Задания одноязычные: и вопрос, " +
          "и варианты только на изучаемом языке. " +
          JSON_ONLY_INSTRUCTION,
        messages: [
          {
            role: "user",
            content: buildPlacementPrompt({ learnLang, level, count }),
          },
        ],
      });
      return textOf(message);
    },
    {
      errorMessage: "Не удалось подготовить задания. Попробуйте ещё раз.",
      validate: (r) =>
        (Array.isArray(r?.items) ? r.items : [])
          .map((i) => normalizeItem(i, level))
          .filter(Boolean).length > 0,
    },
  );

  const items = Array.isArray(raw.items) ? raw.items : [];
  return items.map((i) => normalizeItem(i, level)).filter(Boolean);
}

// Сводка отсева по всем уровням — чтобы не считать её глазами в ответе.
function totalsOf(quality) {
  const totals = { generated: 0, kept: 0, written: 0, rejected: {} };
  for (const stats of Object.values(quality)) {
    totals.generated += stats.generated;
    totals.kept += stats.kept;
    totals.written += stats.written;
    for (const [reason, n] of Object.entries(stats.rejected)) {
      totals.rejected[reason] = (totals.rejected[reason] || 0) + n;
    }
  }
  const dropped = totals.generated - totals.kept;
  totals.dropped = dropped;
  // Доля отсева от того, что выдала модель, в процентах (для отчёта в логе).
  totals.droppedPercent =
    totals.generated > 0 ? Math.round((dropped / totals.generated) * 100) : 0;
  return totals;
}

/**
 * Наполняет банк заданий языка — ОДИН РАЗ. Уровни, где заданий уже достаточно,
 * пропускаются без обращения к модели: повторный вызов почти бесплатен и
 * возвращает { created: 0 }.
 *
 * Каждая порция проходит отсев (см. блок проверок выше) и добирается до нормы,
 * поэтому наполнение стоит примерно вдвое дороже прежнего: на каждую порцию
 * приходится второй вызов модели — слепое решение заданий. Это разовая операция
 * на язык, и качество банка тут важнее экономии.
 *
 * За один вызов наполняется столько уровней, сколько влезает в бюджет времени
 * (см. FILL_BUDGET_MS); недособранные уровни возвращаются в remaining, и их
 * доберёт следующий вызов. level — наполнить ровно один уровень (для ручного
 * запуска); без него берутся все недостающие по очереди.
 *
 * Возвращает { learnLang, created, byLevel, remaining, quality, qualityTotals }
 * или бросает Error с .status.
 */
export async function ensurePlacementBank({
  learnLang,
  force = false,
  level = null,
  budgetMs = FILL_BUDGET_MS,
}) {
  if (!LANGS[learnLang]) {
    const err = new Error(`Неизвестный изучаемый язык: «${learnLang}».`);
    err.status = 400;
    throw err;
  }

  if (level && !PLACEMENT_LEVELS.includes(level)) {
    const err = new Error(`Неизвестный уровень: «${level}».`);
    err.status = 400;
    throw err;
  }

  const supabase = serviceClient();
  const { byLevel } = await countBank(learnLang);

  // Что реально нужно догенерировать (обычно — ничего).
  const missing = (level ? [level] : PLACEMENT_LEVELS).filter(
    (id) => force || byLevel[id] < MIN_ITEMS_PER_LEVEL,
  );
  if (missing.length === 0) {
    return { learnLang, created: 0, byLevel, cached: true, remaining: [] };
  }

  const startedAt = Date.now();
  const remaining = [];
  let created = 0;
  // Отчёт по качеству: без него не понять, работают ли фильтры и насколько
  // плоха исходная выдача модели. Уходит наверх в ответе /api/placement.
  const quality = {};
  for (const level of missing) {
    // Часы смотрим ПЕРЕД уровнем, а не внутри: начатый уровень доводим до
    // записи, иначе потраченные вызовы модели пропадут впустую.
    if (Date.now() - startedAt > budgetMs) {
      remaining.push(level);
      continue;
    }

    // Догенерируем только недостающее, а не весь уровень заново.
    const need = force
      ? ITEMS_PER_LEVEL
      : Math.max(0, ITEMS_PER_LEVEL - byLevel[level]);
    if (need === 0) continue;

    // Генерация + отсев + добор до нормы. Один уровень не удался — не роняем
    // остальные: тест устойчив к тому, что на каком-то уровне заданий меньше
    // (алгоритм берёт ближайший).
    const { items, stats } = await collectLevelItems({ learnLang, level, need });
    quality[level] = stats;
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
    stats.written = (data || []).length;
    created += stats.written;
  }

  const after = await countBank(learnLang);
  return {
    learnLang,
    created,
    byLevel: after.byLevel,
    cached: false,
    // Уровни, до которых не дошли по времени (или которые остались пустыми):
    // их доберёт следующий вызов, дублей не будет.
    remaining: [
      ...new Set([
        ...remaining,
        ...missing.filter((id) => after.byLevel[id] < MIN_ITEMS_PER_LEVEL),
      ]),
    ],
    // Что модель выдала и сколько из этого не дошло до банка — по уровням и
    // сводно. Доля отсева и есть оценка качества исходной выдачи.
    quality,
    qualityTotals: totalsOf(quality),
  };
}
