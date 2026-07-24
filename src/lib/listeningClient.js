// Клиент аудирования (фаза 6.2). Своей генерации у формата НЕТ: фразы берём
// у режима чтения (requestReadingText), просто просим нужную длину предложений
// и меньше новых слов. Озвучка — общий TTS-кэш фазы 5.1 со скоростью из уровня
// сложности, разбор ошибки — то же объяснение грамматики, что и в 6.1.
//
// Здесь только: сборка набора фраз, варианты ответа, сверка написанного и
// хранение текущего набора (чтобы возврат на экран не стоил нового запроса).

import { requestReadingText } from "./readingClient.js";

const SETS_KEY = "listeningSets"; // { "de-ru": { items, index, … } }

// Сколько фраз в одном подходе — столько же предложений просим у генерации.
export const PHRASES_PER_SET = 6;
// Сколько вариантов показываем в режиме выбора (правильный + отвлекающие).
export const OPTIONS_PER_PHRASE = 3;
// Новых слов в аудировании заметно меньше, чем в чтении: на слух узнаётся
// только то, что уже видел глазами. Пользователю этот параметр не показываем —
// сложность формата задаётся скоростью и длиной фразы.
const NEW_WORD_SHARE = 0.1;

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

// ---------- Нормализация и сравнение ----------

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
 * "missing" — слово фразы, которого в ответе нет; "extra" — лишнее слово
 * пользователя. Выравнивание по наибольшей общей подпоследовательности, чтобы
 * одно пропущенное слово не сдвигало весь хвост в «ошибку».
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
  return { ops, correct: ops.every((op) => op.type === "same") };
}

// ---------- Варианты ответа ----------

// Похожесть фраз по общим словам (доля Жаккара). Чем ближе отвлекающий вариант
// к правильному, тем честнее задание: выбирать приходится по услышанному,
// а не по одному знакомому слову.
function similarity(a, b) {
  const setA = new Set(toWords(a).map((w) => w.norm));
  const setB = new Set(toWords(b).map((w) => w.norm));
  if (setA.size === 0 || setB.size === 0) return 0;
  let shared = 0;
  for (const w of setA) if (setB.has(w)) shared += 1;
  return shared / (setA.size + setB.size - shared);
}

function shuffle(list) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Варианты для одной фразы: правильный + самые похожие на него соседние фразы
 * этого же набора. Отдельного запроса к ИИ на «неправильные варианты» не шлём —
 * фразы у нас уже есть, и они об одной ситуации и на тех же словах.
 */
export function buildOptions(sentences, index, count = OPTIONS_PER_PHRASE) {
  const correct = sentences[index].text;
  const distractors = sentences
    .filter((_, i) => i !== index)
    .map((s) => s.text)
    .filter((text) => text !== correct)
    .map((text) => ({ text, score: similarity(correct, text) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, Math.max(0, count - 1))
    .map((d) => d.text);

  return shuffle([correct, ...distractors]);
}

// ---------- Набор фраз ----------

/**
 * Новый подход аудирования: фразы вокруг активных слов пары. Возвращает
 * { items, index, createdAt } или бросает Error с .code (offline | server) —
 * коды те же, что в режиме чтения, сообщения локализует экран.
 */
export async function requestListeningSet({
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
    // Слова пользователя этой пары — вокруг них и строится фраза.
    knownWords: takenWords,
    newWordShare: NEW_WORD_SHARE,
    sentences: PHRASES_PER_SET,
    sentenceLength,
  });

  const sentences = text.sentences;
  const items = sentences.map((s, i) => ({
    text: s.text,
    translation: s.translation || "",
    // Варианты считаем один раз при сборке набора: порядок не должен
    // перемешиваться на каждой перерисовке экрана.
    options: buildOptions(sentences, i),
  }));

  return { items, index: 0, createdAt: new Date().toISOString() };
}

// ---------- Хранение текущего набора ----------
// Один текущий набор на языковую пару: вернулся на экран — продолжаешь с той
// же фразы, а не тратишь ещё один запрос к ИИ.

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
