// Клиент аудирования (фаза 6.2). Два честных формата вместо старого «выбери
// услышанную фразу целиком» (тот проверял чтение: по первым словам глаз находил
// совпадение). Убран полностью.
//
//   gap        — «пропущенное слово»: звучит ВСЁ предложение, на экране одно
//                слово скрыто (___). Пропуск — одно из активных слов пары.
//                Предложение берём у режима чтения (requestReadingText, 6.1),
//                пропуск делаем здесь: своей генерации у формата нет.
//   soundalike — «на слух»: звучит слово, варианты ПОХОЖИ по звучанию (их
//                подбирает модель на сервере, см. /api/listening). Слово — тоже
//                из активных слов пользователя.
//
// Озвучка обоих форматов — общий TTS-кэш фазы 5.1 (в экране). Разбор ошибки для
// gap — то же объяснение грамматики, что и в 6.1.

import { requestReadingText } from "./readingClient.js";
import { highlightWordInExample, coreWord } from "./highlightWord.js";

const SETS_KEY = "listeningSets"; // { "de-ru": { format, items, index, … } }

// Сколько заданий в одном подходе.
export const PHRASES_PER_SET = 6;
// Сколько вариантов показываем в режиме выбора (правильный + отвлекающие).
export const OPTIONS_PER_PHRASE = 3;
// Новых слов в аудировании заметно меньше, чем в чтении: на слух узнаётся
// только то, что уже видел глазами. Пользователю этот параметр не показываем.
const NEW_WORD_SHARE = 0.1;
// Сколько активных слов отдаём модели на подбор похоже звучащих: с запасом,
// потому что для части слов пары не найдётся и они отсеются.
const SOUNDALIKE_CANDIDATES = 14;

// Плейсхолдер пропуска. Экспортируется — экран рисует по нему и сам пропуск,
// и раскрытие (подставляет ответ на место ___).
export const BLANK = "___";

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // хранилище переполнено/недоступно — набор просто не переживёт перезаход
  }
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ---------- Нормализация и сравнение ответа ----------

// Слова фразы с нормализованной формой: регистр и пунктуация при сверке не
// важны (на слух их не слышно), диакритика важна — это часть написания слова.
export function toWords(text) {
  const re = /[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}'-]*/gu;
  const words = [];
  let m;
  while ((m = re.exec(String(text ?? "")))) {
    words.push({ raw: m[0], norm: m[0].toLowerCase() });
  }
  return words;
}

/**
 * Пословный разбор ответа: [{ type: "same" | "missing" | "extra", text }].
 * "missing" — слово-ответ, которого во вводе нет; "extra" — лишнее слово
 * пользователя. Выравнивание по наибольшей общей подпоследовательности.
 * Для пропущенного слова ответ короткий (обычно одно слово), но разбор общий.
 */
export function diffAnswer(input, correct) {
  const a = toWords(input);
  const b = toWords(correct);
  const n = a.length;
  const m = b.length;

  // dp[i][j] — длина общей подпоследовательности хвостов a[i…] и b[j…].
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] =
        a[i].norm === b[j].norm
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i].norm === b[j].norm) {
      ops.push({ type: "same", text: b[j].raw });
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: "extra", text: a[i].raw });
      i += 1;
    } else {
      ops.push({ type: "missing", text: b[j].raw });
      j += 1;
    }
  }
  while (i < n) {
    ops.push({ type: "extra", text: a[i].raw });
    i += 1;
  }
  while (j < m) {
    ops.push({ type: "missing", text: b[j].raw });
    j += 1;
  }
  return ops;
}

/** Ответ засчитан, если совпали все слова (регистр и пунктуация не считаются). */
export function checkAnswer(input, correct) {
  const ops = diffAnswer(input, correct);
  return { ops, correct: ops.length > 0 && ops.every((op) => op.type === "same") };
}

/** Совпадение выбранного варианта с правильным (регистр/пунктуация не важны). */
export function optionMatches(option, correct) {
  const a = toWords(option)
    .map((w) => w.norm)
    .join(" ");
  const b = toWords(correct)
    .map((w) => w.norm)
    .join(" ");
  return a.length > 0 && a === b;
}

// ---------- Формат «пропущенное слово» ----------

/**
 * Делает из предложения пропуск на месте одного из активных слов. Возвращает
 * { display, answer, key } или null, если ни одно активное слово в предложении
 * не нашли. Слово ищем существующим сопоставлением (highlightWordInExample —
 * ловит и словоформы). Из нескольких подходящих берём:
 *   • сначала ещё не использованное в этом подходе (разнообразие пропусков);
 *   • среди них — вхождение ПОЗЖЕ в предложении, чтобы фразу надо было
 *     дослушать, а не угадать по первому слову.
 */
export function makeGap(sentence, takenWords, usedKeys = new Set()) {
  let best = null;
  for (const word of takenWords) {
    const segs = highlightWordInExample(sentence, word);
    const hitIdx = segs.findIndex((s) => s.highlight);
    if (hitIdx === -1) continue;

    const answer = segs[hitIdx].text;
    const key = answer.toLowerCase();
    const start = segs
      .slice(0, hitIdx)
      .reduce((sum, s) => sum + s.text.length, 0);
    const display = segs
      .map((s, i) => (i === hitIdx ? BLANK : s.text))
      .join("");

    // Свежий (ещё не пропускавшийся) ответ важнее позиции; при равенстве —
    // тот, что стоит позже (больше start).
    const fresh = usedKeys.has(key) ? 0 : 1;
    const score = fresh * 1e6 + start;
    if (!best || score > best.score) {
      best = { display, answer, key, score };
    }
  }
  if (!best) return null;
  return { display: best.display, answer: best.answer, key: best.key };
}

/**
 * Варианты для формата «пропущенное слово» в режиме выбора: правильное слово +
 * ядра других активных слов пользователя. Похожесть по звучанию тут не нужна —
 * само слово скрыто, и услышать его надо в контексте предложения.
 */
export function buildGapChoices(answer, takenWords, count = OPTIONS_PER_PHRASE) {
  const answerNorm = answer.toLowerCase();
  const pool = [];
  const seen = new Set([answerNorm]);
  for (const w of shuffle(takenWords)) {
    const core = coreWord(w);
    const key = core.toLowerCase();
    if (!core || seen.has(key)) continue;
    seen.add(key);
    pool.push(core);
    if (pool.length >= count - 1) break;
  }
  return shuffle([answer, ...pool]);
}

/**
 * Подход формата «пропущенное слово». Предложения — из режима чтения (вокруг
 * активных слов пары), пропуск делаем локально. Возвращает
 * { format:"gap", items, index, correctCount, createdAt } или бросает Error
 * с .code (offline | server).
 */
export async function requestGapSet({
  learnLang,
  nativeLang,
  topic,
  level,
  takenWords = [],
  sentenceLength,
  source = "mixed",
}) {
  const text = await requestReadingText({
    learnLang,
    nativeLang,
    topic,
    level,
    // Активные слова пары уходят в промпт всегда; сервер по source решает,
    // вплетать их (mine/mixed) или избегать (new). Пропуск делаем из takenWords.
    knownWords: takenWords,
    newWordShare: NEW_WORD_SHARE,
    sentences: PHRASES_PER_SET,
    sentenceLength,
    source,
  });

  // Пропуск всегда берём из активных слов пользователя, даже если источник —
  // «Новые»: искать в тексте нечего, кроме взятых слов (в «Новых» их там мало,
  // поэтому набор для gap выйдет короче — это ожидаемо).
  const usedKeys = new Set();
  const items = [];
  for (const s of text.sentences) {
    const gap = makeGap(s.text, takenWords, usedKeys);
    if (!gap) continue; // в предложении не нашлось активного слова — пропускаем
    usedKeys.add(gap.key);
    items.push({
      kind: "gap",
      text: s.text, // звучит целиком
      display: gap.display, // на экране — с пропуском
      answer: gap.answer,
      translation: s.translation || "",
      choices: buildGapChoices(gap.answer, takenWords),
    });
  }

  return {
    format: "gap",
    source,
    items,
    index: 0,
    correctCount: 0,
    createdAt: new Date().toISOString(),
  };
}

// ---------- Формат «на слух» (похожие по звучанию) ----------

/**
 * Запрос похоже звучащих дистракторов к серверу. Возвращает
 * [{ word, distractors[] }] или бросает Error с .code (offline | server).
 */
async function fetchSoundAlikes({ learnLang, words }) {
  let res;
  try {
    res = await fetch("/api/listening", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "soundalike", learnLang, words }),
    });
  } catch {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }
  if (!res.ok) {
    let serverMsg = null;
    try {
      const data = await res.json();
      if (data && data.error) serverMsg = data.error;
    } catch {
      // тело не JSON — покажем общий текст
    }
    const err = new Error(serverMsg || "server");
    err.code = "server";
    err.raw = serverMsg || null;
    throw err;
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * Подход формата «на слух». Берём выборку активных слов пары (по ядру, без
 * артикля — чтобы сравнивалось само звучание слова), просим у модели похоже
 * звучащие пары и собираем задания только из тех слов, где пары нашлись.
 * Возвращает { format:"soundalike", items, … } или бросает Error с .code.
 */
export async function requestSoundAlikeSet({
  learnLang,
  takenWords = [],
  wordInfo = {},
  count = PHRASES_PER_SET,
}) {
  // Ядро → перевод (для показа после ответа). Артикль убираем: на слух важно
  // само слово, а дистракторы модель подбирает к ядру.
  const trByCore = new Map();
  const cores = [];
  for (const w of shuffle(takenWords)) {
    const core = coreWord(w);
    if (!core) continue;
    const key = core.toLowerCase();
    if (trByCore.has(key)) continue;
    trByCore.set(key, wordInfo?.[w]?.translation || "");
    cores.push(core);
    if (cores.length >= SOUNDALIKE_CANDIDATES) break;
  }

  const entries = await fetchSoundAlikes({ learnLang, words: cores });

  const items = [];
  for (const e of entries) {
    const word = String(e.word || "").trim();
    const distractors = (e.distractors || [])
      .map((d) => String(d || "").trim())
      .filter(Boolean)
      .slice(0, OPTIONS_PER_PHRASE - 1);
    if (!word || distractors.length === 0) continue; // без пары — пропускаем слово
    items.push({
      kind: "soundalike",
      word, // звучит и является правильным ответом
      options: shuffle([word, ...distractors]),
      translation: trByCore.get(word.toLowerCase()) || "",
    });
    if (items.length >= count) break;
  }

  return {
    format: "soundalike",
    items,
    index: 0,
    correctCount: 0,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Единая точка входа: собирает подход нужного формата.
 * format: "gap" (по умолчанию) | "soundalike".
 */
export async function requestListeningSet(params) {
  if (params.format === "soundalike") {
    return requestSoundAlikeSet(params);
  }
  return requestGapSet(params);
}

// ---------- Хранение текущего набора ----------
// Один текущий набор на языковую пару: вернулся на экран — продолжаешь с той
// же фразы, а не тратишь ещё один запрос к ИИ. В наборе хранится и формат —
// экран покажет его, только если он совпадает с выбранным сейчас форматом.

export function loadSet(pairKey) {
  const store = loadJSON(SETS_KEY, {});
  const set = store[pairKey];
  return set && Array.isArray(set.items) && set.items.length > 0 ? set : null;
}

export function saveSet(pairKey, set) {
  const store = loadJSON(SETS_KEY, {});
  store[pairKey] = set;
  saveJSON(SETS_KEY, store);
}
