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
import { authHeaders, makeApiError } from "./apiClient.js";

const SETS_KEY = "listeningSets"; // { "de-ru": { format, items, index, … } }

// Сколько заданий в одном подходе.
export const PHRASES_PER_SET = 6;
// Сколько вариантов показываем в режиме выбора (правильный + отвлекающие).
export const OPTIONS_PER_PHRASE = 3;
// Доля нового в gap-фразе по источнику:
//   mine  — новое добирается только по необходимости (сам промпт «предпочитай
//           мои»), поэтому доля минимальная;
//   mixed — новое добавляется НАМЕРЕННО и заметно (расширение словаря).
const GAP_NEW_SHARE_MINE = 0.1;
const GAP_NEW_SHARE_MIXED = 0.35;
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
 * Подход формата «пропущенное слово». Способ построения зависит от источника:
 *   mine/mixed — пропущено ЗНАКОМОЕ слово (можно вписать или выбрать); фраза
 *                из режима чтения (mine — преимущественно мои, mixed — с заметной
 *                долей нового), пропуск делаем локально из takenWords;
 *   new        — пропущено НОВОЕ слово, ответ ТОЛЬКО выбором из вариантов (см.
 *                requestGapNewSet).
 * Возвращает { format:"gap", source, items, … } или бросает Error с .code.
 */
export async function requestGapSet(params) {
  if (params.source === "new") return requestGapNewSet(params);

  const {
    learnLang,
    nativeLang,
    topic,
    level,
    takenWords = [],
    sentenceLength,
    source = "mixed",
  } = params;

  const text = await requestReadingText({
    learnLang,
    nativeLang,
    topic,
    level,
    // Активные слова уходят в промпт; сервер по source решает, как их вплетать.
    // Пропуск делаем из takenWords — значит фраза должна их содержать (mine/mixed).
    knownWords: takenWords,
    newWordShare: source === "mixed" ? GAP_NEW_SHARE_MIXED : GAP_NEW_SHARE_MINE,
    sentences: PHRASES_PER_SET,
    sentenceLength,
    source,
  });

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

/**
 * Подход «пропущенное слово», источник «Новые»: пропущено НЕЗНАКОМОЕ слово,
 * поэтому вписать его нельзя — отвечаем выбором из вариантов. И скрываемое
 * слово, и варианты приходят от той же генерации чтения (gapChoices), пропуск
 * ставим по её метке. Возвращает { format:"gap", source:"new", items, … }.
 */
export async function requestGapNewSet({
  learnLang,
  nativeLang,
  topic,
  level,
  takenWords = [],
  sentenceLength,
}) {
  const text = await requestReadingText({
    learnLang,
    nativeLang,
    topic,
    level,
    // Слова пользователя — как «избегать» (source=new), чтобы фраза была новой.
    knownWords: takenWords,
    sentences: PHRASES_PER_SET,
    sentenceLength,
    source: "new",
    gapChoices: true, // просим у модели скрываемое слово и варианты
  });

  const usedKeys = new Set();
  const items = [];
  for (const s of text.sentences) {
    const blank = String(s.blank || "").trim();
    const rawOptions = Array.isArray(s.options)
      ? s.options.map((o) => String(o || "").trim()).filter(Boolean)
      : [];
    if (!blank || rawOptions.length < 2) continue; // без выбора нет задания

    // Находим скрываемое слово в предложении (ловит и словоформу) и заменяем ___.
    const segs = highlightWordInExample(s.text, blank);
    const hitIdx = segs.findIndex((x) => x.highlight);
    if (hitIdx === -1) continue; // слово не нашли в тексте — пропускаем

    const key = blank.toLowerCase();
    if (usedKeys.has(key)) continue; // не повторяем то же слово в подходе
    usedKeys.add(key);

    const display = segs
      .map((x, i) => (i === hitIdx ? BLANK : x.text))
      .join("");

    // Ответ — само скрытое слово (blank). Гарантируем, что оно есть среди
    // вариантов, дедупим и режем до 4.
    const seen = new Set();
    const options = [];
    for (const o of [blank, ...rawOptions]) {
      const k = o.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      options.push(o);
      if (options.length >= OPTIONS_PER_PHRASE + 1) break;
    }

    items.push({
      kind: "gap",
      text: s.text, // звучит целиком
      display, // на экране — с пропуском
      answer: blank, // новое слово
      choiceOnly: true, // незнакомое — только выбор, без ввода
      choices: shuffle(options),
      translation: s.translation || "",
    });
  }

  return {
    format: "gap",
    source: "new",
    items,
    index: 0,
    correctCount: 0,
    createdAt: new Date().toISOString(),
  };
}

// ---------- Формат «на слух» (похожие по звучанию) ----------

/**
 * Запрос слов на слух по источнику + похоже звучащих дистракторов к серверу.
 * Возвращает [{ word, distractors[], translation }] или бросает Error с .code.
 */
async function fetchSoundAlikes({ learnLang, nativeLang, level, words, source, count }) {
  let res;
  try {
    res = await fetch("/api/listening", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({
        action: "soundalike",
        learnLang,
        nativeLang,
        level,
        words,
        source,
        count,
      }),
    });
  } catch {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }
  if (!res.ok) {
    throw await makeApiError(res);
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

/**
 * Подход формата «на слух». Звучать может любое слово по источнику:
 *   mine  — преимущественно из takenWords (недостающее сервер добирает новыми);
 *   mixed — знакомые пополам с новыми;
 *   new   — незнакомые слова под уровень.
 * Слова пользователя (ядра, без артикля) отдаём серверу как источник или как
 * «избегать» (для new); похожие по звучанию варианты сервер подбирает так же,
 * как раньше, независимо от источника.
 * Возвращает { format:"soundalike", source, items, … } или бросает Error с .code.
 */
export async function requestSoundAlikeSet({
  learnLang,
  nativeLang,
  level,
  takenWords = [],
  wordInfo = {},
  source = "mixed",
  count = PHRASES_PER_SET,
}) {
  // Ядро → перевод своих слов (артикль убираем: на слух важно само слово).
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

  const entries = await fetchSoundAlikes({
    learnLang,
    nativeLang,
    level,
    words: cores,
    source,
    count,
  });

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
      // Перевод: свой (wordInfo) для знакомого слова, иначе — с сервера (новые).
      translation:
        trByCore.get(word.toLowerCase()) || String(e.translation || ""),
    });
    if (items.length >= count) break;
  }

  return {
    format: "soundalike",
    source,
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
