import { useState, useEffect, useCallback } from "react";

// Ключи в localStorage. Сохраняем, чтобы прогресс не терялся при перезагрузке.
const KEYS = {
  taken: "takenWords", // взятые на изучение
  known: "knownWords", // известные, исключены навсегда
  skipped: "skippedWords", // отложенные (с меткой, когда вернуть)
  seen: "seenCount", // счётчик действий — для возврата отложенных
};

// Через сколько действий отложенное слово вернётся в поток новых.
export const RETURN_AFTER = 3;

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Выбирает текущую карточку из потока новых.
 * Исключает взятые (taken) и известные (known). Отложенные (skipped)
 * возвращаются, когда seenCount догоняет их returnAt. Если готовых нет,
 * но остались только отложенные — возвращаем ту, что должна вернуться раньше.
 */
export function pickCurrentCard(cards, vocab) {
  const { takenWords, knownWords, skippedWords, seenCount } = vocab;
  const taken = new Set(takenWords);
  const known = new Set(knownWords);
  const skipMap = new Map(skippedWords.map((s) => [s.word, s.returnAt]));

  const remaining = cards.filter(
    (c) => !taken.has(c.word) && !known.has(c.word),
  );
  if (remaining.length === 0) return { card: null, done: true };

  const ready = remaining.filter((c) => {
    const returnAt = skipMap.get(c.word);
    return returnAt === undefined || returnAt <= seenCount;
  });
  if (ready.length > 0) return { card: ready[0], done: false };

  // Все оставшиеся отложены — берём ближайшее к возврату.
  const soonest = [...remaining].sort(
    (a, b) => skipMap.get(a.word) - skipMap.get(b.word),
  )[0];
  return { card: soonest, done: false };
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
  const [seenCount, setSeenCount] = useState(() => load(KEYS.seen, 0));

  useEffect(() => {
    localStorage.setItem(KEYS.taken, JSON.stringify(takenWords));
  }, [takenWords]);
  useEffect(() => {
    localStorage.setItem(KEYS.known, JSON.stringify(knownWords));
  }, [knownWords]);
  useEffect(() => {
    localStorage.setItem(KEYS.skipped, JSON.stringify(skippedWords));
  }, [skippedWords]);
  useEffect(() => {
    localStorage.setItem(KEYS.seen, JSON.stringify(seenCount));
  }, [seenCount]);

  // ВЗЯТЬ — в личный список изучения; убрать из отложенных.
  const take = useCallback((word) => {
    setTakenWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setSkippedWords((prev) => prev.filter((s) => s.word !== word));
    setSeenCount((n) => n + 1);
  }, []);

  // ЗНАЮ — исключить навсегда отовсюду (в т.ч. из взятых и отложенных).
  const markKnown = useCallback((word) => {
    setKnownWords((prev) => (prev.includes(word) ? prev : [...prev, word]));
    setTakenWords((prev) => prev.filter((w) => w !== word));
    setSkippedWords((prev) => prev.filter((s) => s.word !== word));
    setSeenCount((n) => n + 1);
  }, []);

  // ПРОПУСТИТЬ — отложить и вернуть в поток позже (не насовсем).
  const skip = useCallback(
    (word) => {
      const returnAt = seenCount + 1 + RETURN_AFTER;
      setSkippedWords((prev) => [
        ...prev.filter((s) => s.word !== word),
        { word, returnAt },
      ]);
      setSeenCount((n) => n + 1);
    },
    [seenCount],
  );

  return {
    takenWords,
    knownWords,
    skippedWords,
    seenCount,
    take,
    markKnown,
    skip,
  };
}
