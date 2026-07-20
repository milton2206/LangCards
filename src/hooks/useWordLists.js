import { useState, useEffect, useCallback } from "react";

// Всё хранится по языковым парам: { "de-ru": { takenWords, knownWords,
// skippedWords, wordInfo }, "el-ru": {...} }. Слова разных языков не смешиваются.
const STORE_KEY = "wordsByPair";

// Старые «плоские» ключи (до разделения по парам) — для одноразовой миграции.
const LEGACY = {
  taken: "takenWords",
  known: "knownWords",
  skipped: "skippedWords",
  info: "wordInfo",
};

// На сколько дней «Пропустить» откладывает слово.
export const SKIP_DAYS = 3;

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

const EMPTY_PAIR = {
  takenWords: [],
  knownWords: [],
  skippedWords: [],
  wordInfo: {},
  // Состояние интервального повторения по каждому взятому слову.
  srsByWord: {},
};

// Стартовые значения интервального повторения для только что взятого слова.
// (Сам алгоритм повторения здесь НЕ реализуется — только структура данных.)
function startSrs(todayKey) {
  return {
    interval: 0, // текущий интервал в днях
    nextReviewDate: todayKey, // когда показать на повтор (старт: сегодня)
    ease: 2.5, // коэффициент лёгкости (старт: среднее значение)
    repetitions: 0, // сколько раз успешно повторено подряд
    lastReviewed: null, // дата последнего повтора (старт: null)
  };
}

// Гарантирует, что у каждого ВЗЯТОГО слова есть поля интервального повторения.
// Идемпотентно; не трогает knownWords / skippedWords / wordInfo и уже
// существующие srs-записи (не теряет прогресс).
function ensureSrsFields(store, todayKey) {
  let changed = false;
  const next = {};
  for (const [pair, data] of Object.entries(store)) {
    const srs = { ...(data.srsByWord || {}) };
    let pairChanged = !data.srsByWord;
    for (const word of data.takenWords || []) {
      if (!srs[word]) {
        srs[word] = startSrs(todayKey);
        pairChanged = true;
      }
    }
    next[pair] = pairChanged ? { ...data, srsByWord: srs } : data;
    if (pairChanged) changed = true;
  }
  return changed ? next : store;
}

// Загрузка хранилища: миграция старых общих списков + добавление полей
// интервального повторения ко взятым словам.
function loadStore() {
  let store = loadJSON(STORE_KEY, null);

  if (!store) {
    // Миграция старых «плоских» ключей (до разделения по парам).
    const legacyTaken = loadJSON(LEGACY.taken, []);
    const legacyKnown = loadJSON(LEGACY.known, []);
    const legacySkipped = loadJSON(LEGACY.skipped, []);
    const legacyInfo = loadJSON(LEGACY.info, {});
    const hasLegacy =
      legacyTaken.length ||
      legacyKnown.length ||
      legacySkipped.length ||
      Object.keys(legacyInfo).length;

    if (hasLegacy) {
      // Привязываем старые слова к текущей паре из настроек, иначе к de-ru
      // (не теряем существующий прогресс).
      const settings = loadJSON("settings", {});
      const key =
        settings.learnLang && settings.nativeLang
          ? `${settings.learnLang}-${settings.nativeLang}`
          : "de-ru";
      store = {
        [key]: {
          takenWords: legacyTaken,
          knownWords: legacyKnown,
          skippedWords: legacySkipped,
          wordInfo: legacyInfo,
        },
      };
      try {
        localStorage.removeItem(LEGACY.taken);
        localStorage.removeItem(LEGACY.known);
        localStorage.removeItem(LEGACY.skipped);
        localStorage.removeItem(LEGACY.info);
      } catch {
        // ignore
      }
    } else {
      store = {};
    }
  }

  // Добавляем srs-поля ко всем взятым словам (для новых и мигрированных пар).
  return ensureSrsFields(store, toDayKey(new Date()));
}

// Ключ даты «YYYY-MM-DD» по локальному календарю (сравнение только по дню).
export function toDayKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

// Прибавляет дни к ключу даты "YYYY-MM-DD" (по локальному календарю).
function addDaysToKey(dayKey, days) {
  const [y, m, d] = dayKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

// ---------- Алгоритм интервального повторения (упрощённый SM-2) ----------
const MIN_EASE = 1.3; // ниже не опускаем, чтобы трудные слова не застревали
const EASE_DELTA = { again: -0.2, hard: -0.15, good: 0, easy: 0.15 };
const HARD_FACTOR = 1.2; // «Трудно»: небольшой рост интервала
const EASY_BONUS = 1.15; // «Легко»: рост больше обычного
const FIRST_INTERVAL = 1; // первый успешный повтор → 1 день

/**
 * Пересчёт состояния повторения после самооценки.
 * grade: "again" | "hard" | "good" | "easy".
 * Правила интервала: 1-й успех → 1 день, дальше interval × множитель
 * ("Нормально" → × ease, "Трудно" → ×1.2, "Легко" → × ease × 1.15).
 * "Не помню" сбрасывает серию (завтра, repetitions = 0). ease меняется по grade,
 * не опускаясь ниже 1.3. Возвращает новую srs-запись (чистая функция).
 */
export function nextSrs(srs, grade, todayKey) {
  const prevEase = typeof srs?.ease === "number" ? srs.ease : 2.5;
  const prevInterval = typeof srs?.interval === "number" ? srs.interval : 0;
  const prevReps = typeof srs?.repetitions === "number" ? srs.repetitions : 0;

  let ease = prevEase + (EASE_DELTA[grade] ?? 0);
  if (ease < MIN_EASE) ease = MIN_EASE;
  ease = Math.round(ease * 100) / 100;

  let interval;
  let repetitions;

  if (grade === "again") {
    // «Не помню» — сброс: показать завтра, серия обнулена.
    repetitions = 0;
    interval = 1;
  } else {
    repetitions = prevReps + 1;
    if (repetitions === 1) {
      interval = FIRST_INTERVAL; // первый успешный повтор
    } else {
      const factor =
        grade === "hard"
          ? HARD_FACTOR
          : grade === "easy"
            ? ease * EASY_BONUS
            : ease; // "good"
      // растём минимум на 1 день, чтобы «Трудно» тоже двигалось вперёд
      interval = Math.max(prevInterval + 1, Math.round(prevInterval * factor));
    }
  }

  return {
    interval,
    ease,
    repetitions,
    nextReviewDate: addDaysToKey(todayKey, interval),
    lastReviewed: todayKey,
  };
}

/**
 * Текущая карточка из потока новых (см. прежнюю логику: исключены взятые и
 * известные, отложенные скрыты до даты возврата).
 */
export function pickCurrentCard(cards, vocab) {
  const { takenWords, knownWords, skippedWords, todayKey } = vocab;
  const taken = new Set(takenWords);
  const known = new Set(knownWords);
  const skipMap = new Map(skippedWords.map((s) => [s.word, s.returnDate]));

  const remaining = cards.filter(
    (c) => !taken.has(c.word) && !known.has(c.word),
  );

  const ready = remaining.filter((c) => {
    const returnDate = skipMap.get(c.word);
    return returnDate === undefined || returnDate <= todayKey;
  });

  if (ready.length === 0) return { card: null, done: true };
  return { card: ready[0], done: false };
}

/**
 * Слова из takenWords, которым сегодня пора на повтор (nextReviewDate
 * наступила или прошла). Это ОТДЕЛЬНЫЙ от «Пропустить» механизм: здесь речь
 * о взятых словах, там — об отсрочке ещё не взятых новых карточек.
 */
export function getDueWords(takenWords, srsByWord, todayKey) {
  return takenWords.filter((word) => {
    const srs = srsByWord[word];
    return srs && srs.nextReviewDate <= todayKey;
  });
}

/**
 * Списки слов, разделённые по языковой паре (pairKey, напр. "de-ru").
 * Возвращает срезы ТОЛЬКО текущей пары; слова других пар сохраняются, но не
 * показываются, пока не переключишься обратно.
 */
export function useWordLists(pairKey) {
  const [store, setStore] = useState(loadStore);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }, [store]);

  const current = store[pairKey] || EMPTY_PAIR;
  const { takenWords, knownWords, skippedWords, wordInfo, srsByWord } = current;

  // «Сегодня» по реальной локальной дате.
  const todayKey = toDayKey(new Date());

  // Обновляет срез текущей пары в общем хранилище.
  const updatePair = useCallback(
    (updater) => {
      setStore((prev) => {
        const cur = prev[pairKey] || EMPTY_PAIR;
        return { ...prev, [pairKey]: updater(cur) };
      });
    },
    [pairKey],
  );

  // ВЗЯТЬ — в личный список изучения; убрать из отложенных.
  // Заодно заводим стартовую запись интервального повторения для этого слова.
  const take = useCallback(
    (word) => {
      const today = toDayKey(new Date());
      updatePair((cur) => {
        const srs = cur.srsByWord || {};
        return {
          ...cur,
          takenWords: cur.takenWords.includes(word)
            ? cur.takenWords
            : [...cur.takenWords, word],
          skippedWords: cur.skippedWords.filter((s) => s.word !== word),
          srsByWord: srs[word] ? srs : { ...srs, [word]: startSrs(today) },
        };
      });
    },
    [updatePair],
  );

  // ЗНАЮ — исключить навсегда (в т.ч. из взятых и отложенных).
  const markKnown = useCallback(
    (word) => {
      updatePair((cur) => ({
        ...cur,
        knownWords: cur.knownWords.includes(word)
          ? cur.knownWords
          : [...cur.knownWords, word],
        takenWords: cur.takenWords.filter((w) => w !== word),
        skippedWords: cur.skippedWords.filter((s) => s.word !== word),
      }));
    },
    [updatePair],
  );

  // ПРОПУСТИТЬ — отложить на SKIP_DAYS дней вперёд (по дате возврата).
  // ОТДЕЛЬНЫЙ механизм от интервального повторения: касается только ещё
  // НЕ взятых новых карточек (skippedWords), не трогает srsByWord.
  const skip = useCallback(
    (word) => {
      const returnDate = toDayKey(addDays(new Date(), SKIP_DAYS));
      updatePair((cur) => ({
        ...cur,
        skippedWords: [
          ...cur.skippedWords.filter((s) => s.word !== word),
          { word, returnDate },
        ],
      }));
    },
    [updatePair],
  );

  // ВЕРНУТЬ В ИЗУЧЕНИЕ — из известных обратно в личный список.
  // Гарантируем srs-запись (если её ещё нет) — слово снова участвует в повторе.
  const restoreToStudy = useCallback(
    (word) => {
      const today = toDayKey(new Date());
      updatePair((cur) => {
        const srs = cur.srsByWord || {};
        return {
          ...cur,
          knownWords: cur.knownWords.filter((w) => w !== word),
          takenWords: cur.takenWords.includes(word)
            ? cur.takenWords
            : [...cur.takenWords, word],
          srsByWord: srs[word] ? srs : { ...srs, [word]: startSrs(today) },
        };
      });
    },
    [updatePair],
  );

  // ПОВТОР — применить самооценку к взятому слову (интервальное повторение).
  // grade: "again" | "hard" | "good" | "easy". Пересчитывает только srs-запись,
  // членство в списках (taken/known/skipped) не трогает — ОТДЕЛЬНО от «Пропустить».
  const reviewWord = useCallback(
    (word, grade) => {
      const today = toDayKey(new Date());
      updatePair((cur) => {
        const srs = cur.srsByWord || {};
        const prev = srs[word] || startSrs(today);
        return {
          ...cur,
          srsByWord: { ...srs, [word]: nextSrs(prev, grade, today) },
        };
      });
    },
    [updatePair],
  );

  // Запомнить данные показанных карточек (для экранов списков).
  const rememberCards = useCallback(
    (cards) => {
      updatePair((cur) => {
        const info = { ...cur.wordInfo };
        for (const c of cards) {
          info[c.word] = {
            translit: c.translit,
            translation: c.translation,
            example: c.example,
            exampleTranslation: c.exampleTranslation,
          };
        }
        return { ...cur, wordInfo: info };
      });
    },
    [updatePair],
  );

  return {
    takenWords,
    knownWords,
    skippedWords,
    wordInfo,
    srsByWord, // состояние интервального повторения по слову (для Этапа 2)
    todayKey,
    take,
    markKnown,
    skip,
    restoreToStudy,
    reviewWord, // самооценка при интервальном повторении (Этап 2)
    rememberCards,
  };
}
