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
};

// Загрузка хранилища с одноразовой миграцией старых общих списков.
function loadStore() {
  const existing = loadJSON(STORE_KEY, null);
  if (existing) return existing;

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
    const store = {
      [key]: {
        takenWords: legacyTaken,
        knownWords: legacyKnown,
        skippedWords: legacySkipped,
        wordInfo: legacyInfo,
      },
    };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      localStorage.removeItem(LEGACY.taken);
      localStorage.removeItem(LEGACY.known);
      localStorage.removeItem(LEGACY.skipped);
      localStorage.removeItem(LEGACY.info);
    } catch {
      // ignore
    }
    return store;
  }
  return {};
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
  const { takenWords, knownWords, skippedWords, wordInfo } = current;

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
  const take = useCallback(
    (word) => {
      updatePair((cur) => ({
        ...cur,
        takenWords: cur.takenWords.includes(word)
          ? cur.takenWords
          : [...cur.takenWords, word],
        skippedWords: cur.skippedWords.filter((s) => s.word !== word),
      }));
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
  const restoreToStudy = useCallback(
    (word) => {
      updatePair((cur) => ({
        ...cur,
        knownWords: cur.knownWords.filter((w) => w !== word),
        takenWords: cur.takenWords.includes(word)
          ? cur.takenWords
          : [...cur.takenWords, word],
      }));
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
    todayKey,
    take,
    markKnown,
    skip,
    restoreToStudy,
    rememberCards,
  };
}
