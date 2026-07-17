import { useState, useEffect, useCallback } from "react";

// Ключи в localStorage. Сохраняем, чтобы прогресс не терялся между заходами.
const KEYS = {
  taken: "takenWords", // взятые на изучение
  known: "knownWords", // известные, исключены навсегда
  skipped: "skippedWords", // отложенные (с датой возврата)
};

// На сколько дней «Пропустить» откладывает слово.
export const SKIP_DAYS = 3;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

// Ключ даты «YYYY-MM-DD» по локальному календарю — без времени суток,
// чтобы сравнивать только по дню. Строки такого формата сравнимы напрямую.
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
 * Текущая карточка из потока новых.
 * Исключены взятые (taken) и известные (known). Отложенное (skipped) НЕ
 * показывается, пока не наступила его дата возврата. Сравнение — по дате
 * (todayKey), без учёта времени суток. Если готовых карточек нет — done.
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
    // не отложено ИЛИ дата возврата уже наступила/прошла
    return returnDate === undefined || returnDate <= todayKey;
  });

  if (ready.length === 0) return { card: null, done: true };
  return { card: ready[0], done: false };
}

/**
 * Управление личными списками слов с сохранением в localStorage.
 */
export function useWordLists() {
  const [takenWords, setTakenWords] = useState(() => load(KEYS.taken, []));
  const [knownWords, setKnownWords] = useState(() => load(KEYS.known, []));
  const [skippedWords, setSkippedWords] = useState(() =>
    load(KEYS.skipped, []),
  );

  useEffect(() => {
    localStorage.setItem(KEYS.taken, JSON.stringify(takenWords));
  }, [takenWords]);
  useEffect(() => {
    localStorage.setItem(KEYS.known, JSON.stringify(knownWords));
  }, [knownWords]);
  useEffect(() => {
    localStorage.setItem(KEYS.skipped, JSON.stringify(skippedWords));
  }, [skippedWords]);

  // «Сегодня» по реальной локальной дате.
  const todayKey = toDayKey(new Date());

  // ВЗЯТЬ — в личный список изучения; убрать из отложенных.
  const take = useCallback((word) => {
    setTakenWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setSkippedWords((prev) => prev.filter((s) => s.word !== word));
  }, []);

  // ЗНАЮ — исключить навсегда (в т.ч. из взятых и отложенных).
  const markKnown = useCallback((word) => {
    setKnownWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setTakenWords((prev) => prev.filter((w) => w !== word));
    setSkippedWords((prev) => prev.filter((s) => s.word !== word));
  }, []);

  // ПРОПУСТИТЬ — отложить на SKIP_DAYS дней вперёд (по дате возврата).
  const skip = useCallback((word) => {
    const returnDate = toDayKey(addDays(new Date(), SKIP_DAYS));
    setSkippedWords((prev) => [
      ...prev.filter((s) => s.word !== word),
      { word, returnDate },
    ]);
  }, []);

  // ВЕРНУТЬ В ИЗУЧЕНИЕ — из известных обратно в личный список.
  const restoreToStudy = useCallback((word) => {
    setKnownWords((prev) => prev.filter((w) => w !== word));
    setTakenWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
  }, []);

  return {
    takenWords,
    knownWords,
    skippedWords,
    todayKey,
    take,
    markKnown,
    skip,
    restoreToStudy,
  };
}
