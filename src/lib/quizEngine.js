import {
  coreWord,
  highlightWordInExample,
  sameWordEntry,
} from "../../lib/highlightWord.js";

// ============================================================================
// Тест с вариантами ответа: СБОРКА ЗАДАНИЙ. Чистые функции — ни React, ни сети,
// ни обращений к модели: задание целиком собирается из того, что у пользователя
// уже есть (его карточки: слово, перевод, пример, часть речи).
// ----------------------------------------------------------------------------
// ДВА РЕЖИМА пользуются ОДНИМ этим модулем:
//   • внутри повторения — часть слов показывается тестом вместо карточки
//     с самооценкой (см. ReviewScreen);
//   • отдельная «игрушка» вне занятия — прогон по любым своим словам, который
//     НИЧЕГО не записывает (см. QuizScreen).
// Разница между режимами — только снаружи (что делать с ответом). Сборка
// заданий, отбор неверных вариантов и перемешивание — общие, второй реализации
// быть не должно.
//
// СЛУЧАЙНОСТЬ ДЕТЕРМИНИРОВАНА (сид + свой генератор), а не Math.random. Причина
// не в тестируемости, а в грабле: перемешивание должно быть СТАБИЛЬНЫМ, пока
// задание на экране. Math.random в рендере давал бы новый порядок на каждой
// перерисовке — варианты прыгали бы под пальцем. Сид складывается из слова,
// номера задания и «соли» прогона, поэтому у разных заданий и у разных заходов
// порядок разный, а у одного задания — один и тот же.
// ============================================================================

// С какого числа своих слов тест вообще имеет смысл. Ниже этого варианты
// начинают повторяться из задания в задание, и тест превращается в угадайку по
// знакомому набору. Порог видимый: пока слов мало, интерфейс говорит, сколько
// осталось (см. quiz.locked), а не прячет функцию молча.
export const QUIZ_MIN_WORDS = 20;

// Три неверных варианта плюс правильный.
export const QUIZ_DISTRACTORS = 3;
export const QUIZ_OPTIONS = QUIZ_DISTRACTORS + 1;

// Форматы заданий. ЧЕРЕДУЮТСЯ САМИ по номеру задания — человек их не выбирает:
// иначе он взял бы самый лёгкий (узнать перевод) и крутил бы только его.
//   wordToTranslation — слово → выбрать перевод (узнавание, самый лёгкий);
//   translationToWord — перевод → выбрать слово (вспоминание, труднее и полезнее);
//   cloze             — пропуск в примере карточки, 4 варианта на подстановку.
export const QUIZ_FORMATS = ["wordToTranslation", "translationToWord", "cloze"];

// Как часто повторение показывает тест вместо карточки: каждое N-е задание,
// начиная со слота SLOT. Тест НЕ заменяет карточки — он с ними ЧЕРЕДУЕТСЯ:
// человек должен продолжать видеть пример и слышать озвучку, это несущая идея
// приложения. Первым идёт обычная карточка (слот 1, а не 0).
export const QUIZ_REVIEW_EVERY = 3;
export const QUIZ_REVIEW_SLOT = 1;

// Длина одного прогона в отдельном (игровом) режиме.
export const QUIZ_RUN_LENGTH = 10;

// Насколько варианты могут расходиться по длине. Похожесть отбираем по
// ФОРМАЛЬНЫМ признакам (часть речи + длина), а не по смыслу: смысловая близость
// как раз и рождает второй верный ответ.
const LENGTH_TOLERANCE_MIN = 4;
const LENGTH_TOLERANCE_RATIO = 0.5;

// Служебные слова, которые часто попадают в перевод и сами по себе о смысле не
// говорят («быть занятым» и «быть готовым» — не синонимы). Иначе они склеивали
// бы неродственные записи и выбрасывали годных кандидатов.
const MEANING_STOP_WORDS = new Set([
  "быть",
  "бути",
  "себя",
  "себе",
  "что-то",
  "кто-то",
  "нибудь",
  "чтобы",
  "этот",
  "того",
  "щось",
  "хтось",
  "щоби",
  "this",
  "that",
  "some",
  "something",
  "someone",
  "somebody",
  "sich",
  "etwas",
  "jemand",
  "jemanden",
  "jemandem",
]);

// Сколько первых букв берём за «корень» при сверке смысла. Короче — чаще
// ложное срабатывание (кандидат отброшен зря), длиннее — «гибкость» и «гибкий»
// разъедутся. Ошибаться безопаснее в сторону отказа: лучше собрать задание из
// других слов, чем показать два верных варианта.
const MEANING_STEM = 4;

// ---------------------------------------------------------------------------
// Детерминированная случайность
// ---------------------------------------------------------------------------

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Генератор псевдослучайных чисел от сида (mulberry32). */
function makeRng(seed) {
  let a = hashSeed(String(seed)) >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Перемешивание Фишера–Йетса заданным генератором (копия, вход не меняем). */
function shuffle(list, rng) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------------------------------------------------------------------------
// Похожесть и синонимы (формально, без модели)
// ---------------------------------------------------------------------------

const norm = (value) => String(value ?? "").trim().toLowerCase();

const posOf = (entry) => norm(entry?.pos);

/**
 * Варианты перевода одной записи: «счёт, чек (в ресторане)» → ["счёт", "чек"].
 * Скобочные уточнения выбрасываем — они про употребление, а не про значение.
 */
function translationVariants(translation) {
  return String(translation ?? "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/[,;/|]|\bили\b|\bабо\b|\bor\b/u)
    .map((part) => part.replace(/[^\p{L}\p{M}\s'-]/gu, " ").trim())
    .filter(Boolean);
}

/** «Корни» значащих слов перевода — по ним ловим однокоренные и повторы. */
function meaningKeys(translation) {
  const keys = new Set();
  for (const variant of translationVariants(translation)) {
    for (const token of variant.split(/[^\p{L}\p{M}'-]+/u)) {
      if (token.length < MEANING_STEM) continue;
      if (MEANING_STOP_WORDS.has(token)) continue;
      keys.add(token.slice(0, MEANING_STEM));
    }
  }
  return keys;
}

/**
 * Похожи ли записи ПО СМЫСЛУ настолько, что вторая может оказаться вторым
 * верным ответом. Именно на этом мы обожглись в тесте уровня: «гибкость /
 * пластичность», «камуфляж / замалчивание» — выбор без единственного ответа.
 *
 * Модель мы здесь не спрашиваем (задания собираются офлайн из готовых данных),
 * поэтому сверяем ФОРМАЛЬНО: совпадающий вариант перевода целиком или общий
 * корень значащего слова. Это ловит не всякий синоним — зато не пропускает
 * очевидные пары, а сомнительного кандидата дешевле отбросить.
 */
function looksSynonymous(a, b) {
  const va = translationVariants(a.translation);
  const vb = translationVariants(b.translation);
  if (va.some((x) => vb.includes(x))) return true;
  const ka = meaningKeys(a.translation);
  for (const key of meaningKeys(b.translation)) {
    if (ka.has(key)) return true;
  }
  return false;
}

/** Сопоставимая длина показываемых вариантов (короткий среди длинных виден). */
function comparableLength(a, b) {
  const la = norm(a).length;
  const lb = norm(b).length;
  const tolerance = Math.max(
    LENGTH_TOLERANCE_MIN,
    Math.round(Math.max(la, lb) * LENGTH_TOLERANCE_RATIO),
  );
  return Math.abs(la - lb) <= tolerance;
}

// ---------------------------------------------------------------------------
// Пул слов пользователя
// ---------------------------------------------------------------------------

// Что показываем вариантом в каждом формате. Для пропуска в примере берём
// смысловое ядро слова (без артикля): в предложении артикль уже стоит, и
// «der der Arzt» читалось бы нелепо. Часть речи у вариантов одна, поэтому
// набор выглядит однородно и артиклем правильный ответ не выдаётся.
const OPTION_TEXT = {
  wordToTranslation: (entry) => entry.translation,
  translationToWord: (entry) => entry.word,
  cloze: (entry) => coreWord(entry.word),
};

/**
 * Пул для теста из СВОИХ слов пользователя (взятые + известные). Берём только
 * записи, из которых вообще можно собрать задание: слово + перевод. Пример
 * нужен лишь формату с пропуском и обязательным не является.
 */
export function buildQuizPool(words, wordInfo) {
  const seen = new Set();
  const pool = [];
  for (const word of words || []) {
    const key = norm(word);
    if (!key || seen.has(key)) continue;
    const info = wordInfo?.[word];
    const translation = String(info?.translation || "").trim();
    if (!translation) continue;
    seen.add(key);
    pool.push({
      word,
      translation,
      example: String(info?.example || "").trim(),
      pos: info?.pos || "",
    });
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Сборка задания
// ---------------------------------------------------------------------------

/** Формат по номеру задания: форматы чередуются сами, по кругу. */
export function pickQuizFormat(index, offset = 0) {
  const i = (Math.abs(Math.round(index) + Math.round(offset)) || 0) % QUIZ_FORMATS.length;
  return QUIZ_FORMATS[i];
}

/**
 * Кандидаты в неверные варианты: слова САМОГО пользователя, похожие на
 * правильный ответ формально — та же часть речи, сопоставимая длина — и при
 * этом заведомо НЕ синонимы (иначе получим два верных ответа).
 */
function candidatesFor(entry, pool, format) {
  const textOf = OPTION_TEXT[format];
  const answerText = textOf(entry);
  const answerKey = norm(answerText);
  return pool.filter((candidate) => {
    if (candidate.word === entry.word) return false;
    if (posOf(candidate) !== posOf(entry)) return false;
    // Одна и та же словарная запись в двух видах («der Arzt» и «Arzt»).
    if (sameWordEntry(candidate.word, entry.word)) return false;
    const text = textOf(candidate);
    if (!text) return false;
    if (norm(text) === answerKey) return false;
    if (!comparableLength(text, answerText)) return false;
    return !looksSynonymous(candidate, entry);
  });
}

/** Предложение примера с вырезанным изучаемым словом: [{ text, blank }]. */
function clozeSegments(entry, lemmaOf) {
  if (!entry.example) return null;
  const segments = highlightWordInExample(entry.example, entry.word, lemmaOf);
  if (!segments.some((s) => s.highlight)) return null; // слово в примере не найдено
  return segments.map((s) => ({ text: s.text, blank: Boolean(s.highlight) }));
}

/**
 * Собирает ОДНО задание по записи entry. Возвращает задание или null, если
 * собрать нельзя — тогда слово идёт обычной карточкой (в повторении) либо
 * пропускается (в игровом режиме). Лучше пропустить, чем показать очевидное.
 *
 * format — желаемый формат; если он не собирается (например, у слова нет
 * примера — а пропуск без примера не сделать), пробуем остальные по кругу.
 * Порядок вариантов перемешан СРАЗУ и от сида — на экране он не меняется.
 */
export function buildQuizTask({
  entry,
  pool,
  index = 0,
  offset = 0,
  salt = "",
  lemmaOf = null,
}) {
  if (!entry) return null;
  const wanted = pickQuizFormat(index, offset);
  const order = QUIZ_FORMATS.map(
    (_, i) => QUIZ_FORMATS[(QUIZ_FORMATS.indexOf(wanted) + i) % QUIZ_FORMATS.length],
  );

  for (const format of order) {
    const segments = format === "cloze" ? clozeSegments(entry, lemmaOf) : null;
    if (format === "cloze" && !segments) continue; // нет примера или слово в нём не найдено

    const rng = makeRng(`${salt}|${index}|${format}|${entry.word}`);
    const candidates = candidatesFor(entry, pool, format);

    // Из подходящих берём случайные три, следя, чтобы варианты не повторялись
    // текстом (у двух разных слов бывает один перевод).
    const textOf = OPTION_TEXT[format];
    const answerText = textOf(entry);
    const used = new Set([norm(answerText)]);
    const distractors = [];
    for (const candidate of shuffle(candidates, rng)) {
      const text = textOf(candidate);
      const key = norm(text);
      if (used.has(key)) continue;
      used.add(key);
      distractors.push(text);
      if (distractors.length === QUIZ_DISTRACTORS) break;
    }
    if (distractors.length < QUIZ_DISTRACTORS) continue; // не набралось — другой формат

    const options = shuffle(
      [
        { text: answerText, correct: true },
        ...distractors.map((text) => ({ text, correct: false })),
      ],
      rng,
    );

    return {
      word: entry.word,
      format,
      // Что показываем вопросом: слово, перевод или предложение с пропуском.
      prompt: format === "translationToWord" ? entry.translation : entry.word,
      promptLang: format === "translationToWord" ? "native" : "learn",
      segments, // только у формата с пропуском
      optionsLang: format === "wordToTranslation" ? "native" : "learn",
      options,
      answerIndex: options.findIndex((o) => o.correct),
    };
  }
  return null;
}

/**
 * Прогон для отдельного (игрового) режима: до count заданий по случайным словам
 * пула. Слова, из которых задание не собирается, молча пропускаем — их место
 * занимает следующее. На SRS этот прогон не влияет никак: здесь только сборка.
 */
export function buildQuizRun({ pool, count = QUIZ_RUN_LENGTH, salt = "", lemmaOf = null }) {
  const rng = makeRng(`run|${salt}|${pool.length}`);
  const tasks = [];
  for (const entry of shuffle(pool, rng)) {
    if (tasks.length >= count) break;
    const task = buildQuizTask({
      entry,
      pool,
      index: tasks.length,
      salt,
      lemmaOf,
    });
    if (task) tasks.push(task);
  }
  return tasks;
}
