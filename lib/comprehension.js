import Anthropic from "@anthropic-ai/sdk";
import { LANGS, TOPICS, LEVELS } from "./generateCards.js";
import { sanitizeTopic, TOPIC_PROMPT_GUARD } from "./topicSanitize.js";
import { requestModelJson, JSON_ONLY_INSTRUCTION } from "./modelJson.js";
import {
  buildWordSourceGoal,
  buildDiversityBlock,
  buildRealUsageBlock,
} from "./wordSourceGoal.js";
import { speakerGendersFor, GENDERS } from "./tts.js";

// ============================================================================
// Проверка ПОНИМАНИЯ (фаза 6.2), серверная часть. Общий механизм на два режима:
//   • аудирование — короткий диалог (2–4 реплики) вокруг активных слов + вопросы;
//   • чтение — вопросы к уже готовому тексту.
// ----------------------------------------------------------------------------
// ГЛАВНОЕ. Вопросы «верно/неверно» + объяснение ошибки — ОДНА логика для обоих
// источников: normalizeQuestions() и buildQuestionsBlock() общие, отличается лишь
// то, ОТКУДА берётся текст (сгенерированный диалог или готовый текст чтения).
//
// Переиспуем строительные блоки 6.1 (LANGS/TOPICS/LEVELS, вплетание активных слов
// через wordSourceGoal, разбор JSON через modelJson) — второй генерации «с нуля»
// не заводим. Озвучка диалога — общий TTS-кэш (плеер на клиенте).
// ============================================================================

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";

// ---------- Ограничители стоимости ----------
// Число вопросов и длина диалога зажаты: это прямые деньги на счёте Claude API.
export const DEFAULT_QUESTIONS = 3;
export const MAX_QUESTIONS = 4;
const MIN_QUESTIONS = 2;
export const DIALOGUE_MIN_LINES = 2;
export const DIALOGUE_MAX_LINES = 4;
// Текст для вопросов чтения не может быть бесконечным — режем на входе.
const MAX_PASSAGE_LEN = 2000;

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    const err = new Error("Сервер не настроен: не задан ключ ANTHROPIC_API_KEY.");
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

// ---------- Общий механизм вопросов ----------

/**
 * Блок промпта «вопросы на понимание» — ОДИН для диалога и текста. Меняется лишь
 * название источника, и нужно оно в родительном падеже: «содержание диалога»,
 * «списывать с текста», «два места диалога» — так фразы промпта согласуются.
 */
function buildQuestionsBlock({ learn, native, count, sourceGen }) {
  return `ВОПРОСЫ НА ПОНИМАНИЕ (главное — понимание СОДЕРЖАНИЯ, как на языковом экзамене):
- Составь РОВНО ${count} утверждений о содержании ${sourceGen} — о фактах, действиях, намерениях говорящих, а НЕ о грамматике или отдельных словах.
- Часть утверждений сделай ВЕРНЫМИ (соответствуют содержанию), часть — НЕВЕРНЫМИ (противоречат ему). Стремись к балансу верных и неверных.
- ЗАПРЕТ ДОСЛОВНОСТИ (главное требование). Утверждение нельзя списывать с ${sourceGen}: его нужно ПЕРЕФОРМУЛИРОВАТЬ — синонимом, обобщением, другой конструкцией. Целые фразы из источника переносить нельзя; ${MAX_COPIED_RUN} и больше подряд идущих слов источника — это списывание, такое утверждение не годится. Общие короткие совпадения (имя, число, название) допустимы.
  Пример. В источнике: «Анна опоздала на поезд, потому что будильник не зазвонил».
  • ПЛОХО: «Анна опоздала на поезд» — копия куска: ответ находится сличением строк, читать и понимать не нужно.
  • ХОРОШО: «Анна не успела уехать вовремя» — тот же факт, другими словами.
  НЕВЕРНЫЕ утверждения переформулируй ТОЧНО ТАК ЖЕ. Подменить одно слово в скопированной фразе — тот же дефект, только наоборот: «Анна опоздала на автобус» — плохо, потому что ищется тем же сличением. ХОРОШО: «Анна уехала вовремя, как и собиралась».
- ЧАСТЬ УТВЕРЖДЕНИЙ — НА ВЫВОД. Хотя бы одно должно требовать СВЯЗАТЬ два разных места ${sourceGen} или сделать простой вывод из сказанного — то, что нельзя проверить, глядя в одну строку (причина и следствие, кто чего хочет, чем всё кончилось, что было раньше). Вывод должен быть очевидным для уровня ученика: на начальных уровнях (A1–A2) — самый простой, без домысливания того, чего в источнике нет.
- Каждое утверждение — на языке ${learn}, короткое и однозначное, чтобы на него можно было чётко ответить «верно/неверно». Дай его перевод на ${native}.
- Для каждого утверждения укажи "answer": true, если оно ВЕРНОЕ по содержанию, иначе false.
- Для каждого дай "explanation" на языке ${native}: почему ответ именно такой. Это объяснение показывается пользователю, когда он ошибается, и к нему жёсткие требования:
  • НЕ начинай с вердикта и вообще не повторяй его: никаких «Это неправильно», «Это верно», «Нет, это не так» — интерфейс уже показал результат отдельной строкой. Сразу переходи к сути.
  • ОДНА-ДВЕ короткие фразы, не больше. Длинное объяснение не читают.
  • Ссылайся на содержание ${sourceGen} КРАТКО и СВОИМИ СЛОВАМИ. НЕ цитируй предложение целиком и тем более не приводи его вместе с переводом — достаточно назвать нужный факт.
  • Ключевые слова переводи ТОЧНО. Проверяй ложных друзей и созвучия: например, «лёгкий багаж» — это про вес вещей, а не про костёр или огонь. Если сомневаешься в точном соответствии слова — перефразируй мысль, а не переводи дословно.`;
}

// Схема одного вопроса в JSON — тоже общая.
function questionSchema(learn, native) {
  return `{ "statement": "утверждение о содержании СВОИМИ СЛОВАМИ на ${learn} (не копия фразы из источника)", "statementTranslation": "перевод утверждения на ${native}", "answer": true, "explanation": "одна-две короткие фразы на ${native}: суть без повтора вердикта и без цитаты целиком" }`;
}

// ---------- Фильтр дословности ----------
// Инструкции модели мало (это уже видно по банку теста уровня), поэтому
// списывание ловим механически. Утверждение, в котором есть длинный дословный
// кусок источника, проверяет не понимание, а совпадение строк: ответ находится
// сличением, читать не нужно. Такой вопрос бракуется.
//
// Порог в СЛОВАХ: сколько подряд идущих слов источника считаем копированием.
// Меньше — это имена, числа и термины, без них про источник ничего не скажешь.
export const MAX_COPIED_RUN = 5;

// Слова без знаков препинания и регистра: сравниваем смысловые единицы, а не
// пунктуацию. \p{L}\p{N} — чтобы работало и с умлаутами, и с греческим.
function wordsOf(text) {
  return String(text ?? "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/**
 * Есть ли в утверждении дословный кусок источника длиной run слов и больше.
 * Чистая функция — проверяется без вызова модели.
 */
export function copiesSource(statement, source, run = MAX_COPIED_RUN) {
  const src = wordsOf(source);
  const st = wordsOf(statement);
  if (run < 1 || src.length < run || st.length < run) return false;

  const runs = new Set();
  for (let i = 0; i + run <= src.length; i += 1) {
    runs.add(src.slice(i, i + run).join(" "));
  }
  for (let i = 0; i + run <= st.length; i += 1) {
    if (runs.has(st.slice(i, i + run).join(" "))) return true;
  }
  return false;
}

// Булев ответ модели может прийти как true/false, строкой или локализованным
// словом — приводим к настоящему boolean, иначе вопрос отбраковываем.
function coerceBool(value) {
  if (typeof value === "boolean") return value;
  const s = String(value ?? "").trim().toLowerCase();
  if (["true", "1", "yes", "да", "верно", "richtig", "wahr", "true."].includes(s))
    return true;
  if (["false", "0", "no", "нет", "неверно", "falsch"].includes(s)) return false;
  return null;
}

/**
 * Приводит сырой массив вопросов модели к чистому виду:
 * [{ statement, statementTranslation, answer:boolean, explanation }].
 * Отбрасывает вопросы без утверждения, без внятного булева ответа И списанные
 * дословно с источника (source — текст источника на изучаемом языке: реплики
 * диалога или текст чтения; пустой source проверку отключает). Режет по лимиту.
 * Чистая функция — вынесена, чтобы проверять без вызова модели.
 */
export function normalizeQuestions(raw, max = MAX_QUESTIONS, source = "") {
  const out = [];
  for (const q of Array.isArray(raw) ? raw : []) {
    const statement = String(q?.statement ?? "").trim();
    const answer = coerceBool(q?.answer);
    if (!statement || answer === null) continue;
    // Списано с источника — проверяет сличение строк, а не понимание.
    if (source && copiesSource(statement, source)) continue;
    out.push({
      statement,
      statementTranslation: String(q?.statementTranslation ?? "").trim(),
      answer,
      explanation: String(q?.explanation ?? "").trim(),
    });
    if (out.length >= max) break;
  }
  return out;
}

// Общие «шапки» параметров генерации (язык/родной/тема/уровень) — как в 6.1.
function resolveNames({ learnLang, nativeLang, topic, level }) {
  const learn = LANGS[learnLang]?.name || learnLang;
  const learnGen = LANGS[learnLang]?.gen || learn;
  const native = LANGS[nativeLang]?.name || nativeLang;
  // Тема — пресет или своя тема пользователя; свою ещё раз чистим (клиенту не
  // доверяем — строка уходит в промпт), пустую заменяем нейтральным пресетом.
  const topicName = TOPICS[topic] || sanitizeTopic(topic) || TOPICS.daily;
  // Уровень — обязательный ориентир; если не дошёл, берём начальный.
  const levelName = LEVELS[level] || level || LEVELS.a1;
  return { learn, learnGen, native, topicName, levelName };
}

// ---------- Диалог + вопросы (аудирование) ----------

/**
 * Блок промпта про ПОЛ ГОВОРЯЩИХ. Реплики озвучиваются разными голосами, и голос
 * выбирается по полу (см. VOICES в lib/tts.js) — значит пол должен прийти из
 * генерации, а не угадываться. Иначе выходит то, на что жаловались тестеры:
 * мужской голос говорит о себе в женском роде («я пришла», «я устала»).
 *
 * Состав собеседников свободный (женщина с мужчиной, две женщины, двое мужчин) —
 * кроме языков, где у нас нет голосов нужного пола: там просим только тот пол,
 * который умеем озвучить. Список берётся из таблицы голосов, чтобы правило не
 * разъезжалось с ней (greek: только женские).
 */
function buildGenderBlock(learnLang, learn) {
  const genders = speakerGendersFor(learnLang);
  const onlyFemale = genders.length === 1 && genders[0] === "female";
  const onlyMale = genders.length === 1 && genders[0] === "male";

  const composition = onlyFemale
    ? `- ОБА собеседника — ЖЕНЩИНЫ (для языка ${learn} это обязательное условие): у каждой реплики "gender": "female". Разговор двух женщин, мужских персонажей в диалоге нет.`
    : onlyMale
      ? `- ОБА собеседника — МУЖЧИНЫ (для языка ${learn} это обязательное условие): у каждой реплики "gender": "male".`
      : `- Состав свободный: женщина с мужчиной, две женщины или двое мужчин — как уместнее по теме и ситуации.`;

  return `ПОЛ ГОВОРЯЩИХ (обязательно):
${composition}
- У КАЖДОЙ реплики укажи "gender" — "female" или "male". У всех реплик одного собеседника пол ОДИН И ТОТ ЖЕ.
- СОГЛАСУЙ РЕЧЬ ПО РОДУ. Всё, что в языке ${learn} меняется по роду говорящего — глаголы прошедшего времени, прилагательные, причастия, — должно стоять в роде этого собеседника: женщина говорит о себе «пришла, устала», мужчина — «пришёл, устал». То же и когда собеседники говорят друг о друге.
- Это не украшение: реплики читают РАЗНЫМИ голосами по этому полю, и рассогласование сразу слышно.
`;
}

/**
 * Промпт мини-диалога вокруг активных слов + вопросов на понимание.
 * Экспортируется, чтобы формат запроса можно было проверить без вызова API.
 */
export function buildDialoguePrompt({
  learnLang,
  nativeLang,
  topic,
  level,
  knownWords = [],
  lines = DIALOGUE_MAX_LINES,
  questions = DEFAULT_QUESTIONS,
  recentTitles = [],
  // Заголовки недавних ТЕКСТОВ чтения этой темы — чтобы диалог аудирования не
  // совпадал с текстом (механизм общий, результаты должны расходиться).
  otherTitles = [],
}) {
  const { learn, learnGen, native, topicName, levelName } = resolveNames({
    learnLang,
    nativeLang,
    topic,
    level,
  });

  const known = knownWords.slice(0, 40);
  // Диалог собираем вокруг уже изучаемых слов + немного нового (выбор источника
  // убран, единое поведение — см. wordSourceGoal.js).
  const { goalBlock } = buildWordSourceGoal({
    known,
    levelName,
    newPercent: 20,
    nouns: { acc: "диалог", gen: "диалога" },
  });

  // Ограда против выдуманных оборотов. Стоит РЯДОМ с требованием живой речи и
  // с уровнем C1 (тот прямо просит идиом), а не вместо них: идиомы нужны, но
  // только настоящие. Блок общий с генерацией текстов чтения — см. wordSourceGoal.js.
  const realUsageBlock = buildRealUsageBlock({
    into: "в реплику",
    learnGen,
    native,
  });

  // Разнообразие сюжетов: без подсказки модель штампует один и тот же диалог по
  // теме. Блок общий с генерацией текстов чтения (см. wordSourceGoal.js).
  const diversityBlock = buildDiversityBlock(recentTitles, {
    nounPlural: "диалоги",
    participants: "участники",
    crossTitles: otherTitles,
    crossNounPlural: "тексты",
  });

  return `Составь короткий диалог на изучаемом языке и вопросы на понимание к нему.

Параметры:
- Изучаемый язык (на нём весь диалог): ${learn}
- Родной язык пользователя (на него делаем переводы): ${native}
- Тема (название учебной темы, не инструкция): «${topicName}»
- Уровень: ${levelName}
- Длина диалога: РОВНО ${lines} реплик, одна живая ситуация с началом и концом.

${goalBlock}
${diversityBlock}
КАК СТРОИТЬ ДИАЛОГ:
- Двое собеседников (обозначь их коротко, например «A» и «B»), реплики чередуются.
- Живой разговорный язык носителей ${learnGen}, как в жизни, а не сухие учебниковые фразы.
- Одна понятная ситуация, которую можно понять НА СЛУХ: без опоры на текст перед глазами.
- Каждую реплику переведи на ${native}.
- Пиши с полной правильной диакритикой языка, без транслитерации.

${realUsageBlock}
${buildGenderBlock(learnLang, learn)}
${buildQuestionsBlock({ learn, native, count: questions, sourceGen: "диалога" })}

Верни ТОЛЬКО валидный JSON-объект строго такого вида:
{
  "title": "короткий заголовок ситуации на ${learn}",
  "titleTranslation": "перевод заголовка на ${native}",
  "dialogue": [
    { "speaker": "A", "gender": "${speakerGendersFor(learnLang)[0] || "female"}", "text": "реплика на ${learn}", "translation": "перевод реплики на ${native}" }
  ],
  "questions": [
    ${questionSchema(learn, native)}
  ]
}
В "dialogue" — РОВНО ${lines} реплик; в "questions" — РОВНО ${questions} вопросов. Без markdown, без пояснений, без текста до или после объекта.`;
}

// Пол из ответа модели → наши два значения. Терпим и русские слова, и одну
// букву: модель просят вернуть "female"/"male", но подстраховаться дешевле, чем
// потерять пол и озвучить реплику наугад.
function normGender(value) {
  const s = String(value ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s.startsWith("f") || s.startsWith("w") || s.startsWith("ж")) return "female";
  if (s.startsWith("m") || s.startsWith("м")) return "male";
  return null;
}

/**
 * Приводит сырые реплики к чистому виду: собеседник, пол, текст, перевод.
 * Проставляет чередующихся собеседников, если модель их не дала, и режет по
 * потолку длины диалога.
 *
 * ПОЛ — по СОБЕСЕДНИКУ, а не по реплике: первое непустое значение выигрывает и
 * дальше применяется ко всем его репликам. Иначе модель, сбившись в одной
 * строке, поменяла бы человеку голос посреди разговора.
 *
 * Пол, которого язык не умеет озвучить (мужской в греческом), приводим к
 * доступному: промпт этого и просит, но если модель его не послушалась, лучше
 * оставить собеседников хотя бы различимыми по голосу — второй получит тот же
 * голос ниже тоном (см. resolveVoice).
 */
function normalizeDialogue(raw, learnLang) {
  const allowed = speakerGendersFor(learnLang);
  const genderOf = new Map(); // собеседник → пол (первое внятное значение)
  const out = [];
  for (const line of Array.isArray(raw) ? raw : []) {
    const text = String(line?.text ?? "").trim();
    if (!text) continue;
    const speaker = String(line?.speaker ?? "").trim() || (out.length % 2 === 0 ? "A" : "B");

    if (!genderOf.has(speaker)) {
      // Пола нет вовсе (старый ответ, модель забыла) — раздаём доступные полы
      // по очереди появления: так двое собеседников звучат по-разному.
      const said = normGender(line?.gender);
      const fallback = allowed[genderOf.size % allowed.length] || GENDERS[0];
      const gender = said && allowed.includes(said) ? said : said ? allowed[0] : fallback;
      genderOf.set(speaker, gender || GENDERS[0]);
    }

    out.push({
      speaker,
      gender: genderOf.get(speaker),
      text,
      translation: String(line?.translation ?? "").trim(),
    });
    if (out.length >= DIALOGUE_MAX_LINES) break;
  }
  return out;
}

// Источник для фильтра дословности в аудировании — реплики диалога на изучаемом
// языке (переводы не нужны: утверждения тоже на изучаемом).
function dialogueSource(lines) {
  return lines.map((l) => l.text).join(" ");
}

/**
 * Генерирует мини-диалог вокруг активных слов пользователя и вопросы на
 * понимание к нему в ОДНОМ вызове модели (диалог и вопросы кэшируются вместе).
 * Возвращает { title, titleTranslation, dialogue[], questions[] }.
 * Бросает Error с .status и понятным message.
 */
export async function generateDialogueComprehension(params) {
  if (!LANGS[params.learnLang]) {
    const err = new Error(`Неизвестный изучаемый язык: «${params.learnLang}».`);
    err.status = 400;
    throw err;
  }
  const lines = clampInt(params.lines, DIALOGUE_MIN_LINES, DIALOGUE_MAX_LINES, DIALOGUE_MAX_LINES);
  const questions = clampInt(params.questions, MIN_QUESTIONS, MAX_QUESTIONS, DEFAULT_QUESTIONS);

  // Лучшая из попыток: полный набор вопросов принимаем сразу, неполный (часть
  // забраковал фильтр дословности) запоминаем и делаем повтор — вдруг выйдет
  // лучше. Если и повтор не дал полного набора, отдаём лучшее из попыток: два
  // честных вопроса полезнее ошибки. Совсем пустой результат остаётся ошибкой.
  let best = null;
  const keepBest = (r) => {
    // Не путать с lines выше: там ЗАКАЗАННОЕ число реплик, здесь — сами реплики.
    const replies = normalizeDialogue(r?.dialogue, params.learnLang);
    if (replies.length === 0) return false;
    const list = normalizeQuestions(r?.questions, questions, dialogueSource(replies));
    if (list.length === 0) return false;
    if (!best || list.length > best.count) best = { raw: r, count: list.length };
    return list.length >= questions;
  };

  // Надёжный разбор + один повтор при «грязном» ответе модели.
  let raw;
  try {
    raw = await requestModelJson(
      async () => {
        const message = await client().messages.create({
          model: MODEL,
          max_tokens: 1300, // диалог + вопросы с переводами и объяснениями — с запасом
          system:
            "Ты — автор коротких диалогов для изучающих язык и вопросов на понимание к ним. " +
            "Пишешь живым разговорным языком носителей, вплетая слова, которые ученик уже учит; " +
            "вопросы проверяют понимание СОДЕРЖАНИЯ, а не грамматику. " +
            JSON_ONLY_INSTRUCTION +
            " " +
            TOPIC_PROMPT_GUARD,
          messages: [
            {
              role: "user",
              content: buildDialoguePrompt({ ...params, lines, questions }),
            },
          ],
        });
        return textOf(message);
      },
      {
        errorMessage: "Не удалось составить диалог. Попробуйте ещё раз.",
        // Пустой диалог/вопросы — тоже неудачная попытка: повторяем автоматически,
        // раньше человек видел ошибку и жал «ещё раз» руками.
        validate: keepBest,
      },
    );
  } catch (err) {
    // Полного набора не вышло, но что-то годное было — отдаём его.
    if (!best) throw err;
    raw = best.raw;
  }

  const dialogue = normalizeDialogue(raw.dialogue, params.learnLang);
  const list = normalizeQuestions(raw.questions, questions, dialogueSource(dialogue));
  if (dialogue.length === 0 || list.length === 0) {
    const err = new Error("Не удалось составить диалог. Попробуйте ещё раз.");
    err.status = 502;
    err.code = "generationFailed";
    throw err;
  }

  return {
    title: raw.title ? String(raw.title) : "",
    titleTranslation: raw.titleTranslation ? String(raw.titleTranslation) : "",
    dialogue,
    questions: list,
  };
}

// ---------- Вопросы к готовому тексту (чтение) ----------

/**
 * Промпт вопросов на понимание к УЖЕ готовому тексту (режим чтения). Тот же
 * механизм вопросов, что и у диалога, только источник — переданный текст.
 * Экспортируется для проверки формата без вызова API.
 */
export function buildTextQuestionsPrompt({
  passage,
  learnLang,
  nativeLang,
  level,
  questions = DEFAULT_QUESTIONS,
}) {
  const { learn, native, levelName } = resolveNames({
    learnLang,
    nativeLang,
    level,
  });

  return `Прочитай текст на изучаемом языке и составь вопросы на понимание его содержания.

Параметры:
- Язык текста: ${learn}
- Родной язык пользователя (на него переводы и объяснения): ${native}
- Уровень пользователя: ${levelName}

Текст (источник вопросов):
«${passage}»

${buildQuestionsBlock({ learn, native, count: questions, sourceGen: "текста" })}

Верни ТОЛЬКО валидный JSON-объект строго такого вида:
{
  "questions": [
    ${questionSchema(learn, native)}
  ]
}
В "questions" — РОВНО ${questions} вопросов. Без markdown, без пояснений, без текста до или после объекта.`;
}

/**
 * Генерирует вопросы на понимание к переданному тексту. Возвращает { questions }.
 * Бросает Error с .status и понятным message.
 */
export async function generateTextComprehension(params) {
  const passage = String(params.passage ?? "").trim().slice(0, MAX_PASSAGE_LEN);
  if (!passage) {
    const err = new Error("Пустой текст для вопросов.");
    err.status = 400;
    throw err;
  }
  const questions = clampInt(params.questions, MIN_QUESTIONS, MAX_QUESTIONS, DEFAULT_QUESTIONS);

  // Та же логика «лучшей из попыток», что и в диалоге: полный набор принимаем
  // сразу, неполный после фильтра дословности — повторяем один раз и отдаём
  // лучшее из двух. Пустой набор остаётся ошибкой.
  let best = null;
  const keepBest = (r) => {
    const list = normalizeQuestions(r?.questions, questions, passage);
    if (list.length === 0) return false;
    if (!best || list.length > best.count) best = { raw: r, count: list.length };
    return list.length >= questions;
  };

  let raw;
  try {
    raw = await requestModelJson(
      async () => {
        const message = await client().messages.create({
          model: MODEL,
          max_tokens: 900, // только вопросы к готовому тексту — короче диалога
          system:
            "Ты — преподаватель, который составляет вопросы на понимание содержания текста " +
            "(верно/неверно) с коротким объяснением ответа. Проверяешь понимание смысла, а не грамматику. " +
            JSON_ONLY_INSTRUCTION,
          messages: [
            {
              role: "user",
              content: buildTextQuestionsPrompt({ ...params, passage, questions }),
            },
          ],
        });
        return textOf(message);
      },
      {
        errorMessage: "Не удалось составить вопросы. Попробуйте ещё раз.",
        validate: keepBest,
      },
    );
  } catch (err) {
    if (!best) throw err;
    raw = best.raw;
  }

  const list = normalizeQuestions(raw.questions, questions, passage);
  if (list.length === 0) {
    const err = new Error(
      "Не удалось составить вопросы к этому тексту. Попробуйте ещё раз.",
    );
    err.status = 502;
    err.code = "generationFailed";
    throw err;
  }
  return { questions: list };
}
