import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { fetchCloudWords, pushCloudWords } from "../lib/cloudWords.js";
import { mergeWordData } from "../lib/wordSync.js";

// Всё хранится по языковым парам: { "de-ru": { takenWords, knownWords,
// skippedWords, wordInfo }, "el-ru": {...} }. Слова разных языков не смешиваются.
const STORE_KEY = "wordsByPair";
// Флаг «есть локальные изменения, ещё не отправленные в облако». Переживает
// перезагрузку — чтобы правки, сделанные офлайн, не потерялись до синхронизации.
const DIRTY_KEY = "wordsSyncDirty";
// Задержка перед отправкой в облако — гасит частые правки в один запрос.
const PUSH_DEBOUNCE_MS = 800;

// Старые «плоские» ключи (до разделения по парам) — для одноразовой миграции.
const LEGACY = {
  taken: "takenWords",
  known: "knownWords",
  skipped: "skippedWords",
  info: "wordInfo",
};

// На сколько дней «Пропустить» откладывает слово.
export const SKIP_DAYS = 3;

// Максимум слов в активном изучении одновременно (takenWords). Легко менять —
// одна константа. При достижении лимита новые слова не добавляются, пока
// часть активных не перейдёт в «Знаю» (или не будет временно возвращена).
export const MAX_ACTIVE_WORDS = 50;

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
// «Легко»: интервал заметно больше обычного — примерно вдвое (бонус удвоен
// с 1.15 до 2.3), чтобы уверенно знакомые слова возвращались значительно позже.
const EASY_BONUS = 2.3;
const FIRST_INTERVAL = 1; // первый успешный повтор → 1 день

/**
 * Пересчёт состояния повторения после самооценки.
 * grade: "again" | "hard" | "good" | "easy".
 * Правила интервала: 1-й успех → 1 день, дальше interval × множитель
 * ("Нормально" → × ease, "Трудно" → ×1.2, "Легко" → × ease × 2.3 — вдвое больше обычного).
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
export function useWordLists(pairKey, user) {
  const [store, setStore] = useState(loadStore);

  // localStorage — источник правды для UI (мгновенно и работает офлайн). Облако
  // (Supabase) — зеркало для синхронизации между устройствами.
  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }, [store]);

  const current = store[pairKey] || EMPTY_PAIR;
  const { takenWords, knownWords, skippedWords, wordInfo, srsByWord } = current;

  // «Сегодня» по реальной локальной дате.
  const todayKey = toDayKey(new Date());

  // ---------- Синхронизация с облаком ----------
  // Статус для UI: disabled (нет аккаунта/Supabase) | syncing | synced | offline | error.
  const [syncStatus, setSyncStatus] = useState("disabled");
  // Код причины сбоя (не текст — локализуется в UI): null | offline | missing-table | error.
  const [syncReason, setSyncReason] = useState(null);

  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const dirtyRef = useRef(localStorage.getItem(DIRTY_KEY) === "1");
  const lastSyncedAtRef = useRef(null); // updated_at облачной версии, что у нас есть
  const lastPushedJsonRef = useRef(null); // что реально отправлено (чтобы не слать одно и то же)
  const syncedUserRef = useRef(null); // id пользователя, для которого прошёл первичный sync
  const pushTimerRef = useRef(null);
  const apiRef = useRef({}); // «живые» функции синка для слушателей событий

  function setDirty(value) {
    dirtyRef.current = value;
    try {
      if (value) localStorage.setItem(DIRTY_KEY, "1");
      else localStorage.removeItem(DIRTY_KEY);
    } catch {
      // ignore
    }
  }

  // Применить готовое хранилище локально (из облака): и в state, и в ref сразу.
  function applyStore(next) {
    storeRef.current = next;
    setStore(next);
  }

  function reportFailure(reason) {
    setSyncReason(reason);
    setSyncStatus(reason === "offline" ? "offline" : "error");
  }

  // Отправка текущего состояния в облако (с дедупом по содержимому).
  async function pushNow() {
    if (!user || !supabase) return;
    if (syncedUserRef.current !== user.id) return; // до первичного sync не шлём
    const json = JSON.stringify(storeRef.current);
    if (json === lastPushedJsonRef.current) {
      setDirty(false);
      setSyncStatus("synced");
      return;
    }
    setSyncStatus("syncing");
    const res = await pushCloudWords(user.id, storeRef.current);
    if (res.ok) {
      lastPushedJsonRef.current = json;
      lastSyncedAtRef.current = res.updatedAt;
      setDirty(false);
      setSyncStatus("synced");
      setSyncReason(null);
    } else {
      reportFailure(res.reason); // остаёмся dirty — повторим на онлайне/фокусе
    }
  }

  function schedulePush() {
    setDirty(true);
    if (!user || !supabase || syncedUserRef.current !== user.id) return;
    clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      apiRef.current.pushNow();
    }, PUSH_DEBOUNCE_MS);
  }

  // Применить облачную версию к локальной. Если есть несохранённые локальные
  // правки — сливаем (ничего не теряем) и отправляем; иначе принимаем облако как
  // есть (так распространяются и удаления).
  function applyCloudVersion(cloudData, cloudUpdatedAt) {
    const cloud = cloudData || {};
    if (dirtyRef.current) {
      const merged = ensureSrsFields(
        mergeWordData(cloud, storeRef.current),
        todayKey,
      );
      applyStore(merged);
      schedulePush();
    } else {
      const normalized = ensureSrsFields(cloud, todayKey);
      applyStore(normalized);
      lastPushedJsonRef.current = JSON.stringify(normalized);
      lastSyncedAtRef.current = cloudUpdatedAt;
      setSyncStatus("synced");
      setSyncReason(null);
    }
  }

  // Первичная синхронизация при входе: сливаем облако + локальные слова (миграция
  // существующего прогресса, ничего не теряем) и, если появились отличия, шлём вверх.
  async function initialSync() {
    setSyncStatus("syncing");
    const res = await fetchCloudWords(user.id);
    if (!res.ok) {
      reportFailure(res.reason); // офлайн/ошибка — останемся на локальных данных
      return;
    }
    const cloud = res.data || {};
    const merged = ensureSrsFields(
      mergeWordData(cloud, storeRef.current),
      todayKey,
    );
    applyStore(merged);
    syncedUserRef.current = user.id;

    const mergedJson = JSON.stringify(merged);
    if (mergedJson !== JSON.stringify(cloud)) {
      setSyncStatus("syncing");
      const pres = await pushCloudWords(user.id, merged);
      if (pres.ok) {
        lastPushedJsonRef.current = mergedJson;
        lastSyncedAtRef.current = pres.updatedAt;
        setDirty(false);
        setSyncStatus("synced");
        setSyncReason(null);
      } else {
        reportFailure(pres.reason);
      }
    } else {
      lastPushedJsonRef.current = mergedJson;
      lastSyncedAtRef.current = res.updatedAt;
      setDirty(false);
      setSyncStatus("synced");
      setSyncReason(null);
    }
  }

  // Подтянуть свежее из облака (фокус окна / возврат связи / ручной повтор).
  async function pullNow() {
    if (!user || !supabase || syncedUserRef.current !== user.id) return;
    const res = await fetchCloudWords(user.id);
    if (!res.ok) {
      reportFailure(res.reason);
      return;
    }
    if (dirtyRef.current) {
      applyCloudVersion(res.data, res.updatedAt);
      await apiRef.current.pushNow();
    } else if (res.updatedAt !== lastSyncedAtRef.current) {
      applyCloudVersion(res.data, res.updatedAt);
    } else {
      setSyncStatus("synced");
    }
  }

  // Держим ссылки на актуальные версии функций (свежие user/todayKey) — их
  // зовут слушатели событий, таймеры и мемоизированный updatePair.
  apiRef.current = {
    pushNow,
    pullNow,
    initialSync,
    applyCloudVersion,
    schedulePush,
  };

  // Ручной повтор синхронизации (кнопка в настройках при офлайн/ошибке).
  const retrySync = useCallback(() => {
    if (syncedUserRef.current == null) apiRef.current.initialSync();
    else if (dirtyRef.current) apiRef.current.pushNow();
    else apiRef.current.pullNow();
  }, []);

  // Настройка синхронизации на время, пока есть вошедший пользователь.
  useEffect(() => {
    if (!user || !supabase) {
      setSyncStatus("disabled");
      setSyncReason(null);
      syncedUserRef.current = null;
      return;
    }

    let cancelled = false;
    syncedUserRef.current = null;
    (async () => {
      if (!cancelled) await apiRef.current.initialSync();
    })();

    // Реалтайм: правки с других устройств приходят почти мгновенно.
    const channel = supabase
      .channel(`user_words_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "user_words",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const row = payload.new;
          if (!row || !row.updated_at) return;
          if (row.updated_at === lastSyncedAtRef.current) return; // наше же эхо
          apiRef.current.applyCloudVersion(row.data, row.updated_at);
        },
      )
      .subscribe();

    // Фолбэки, если реалтайм недоступен: фокус вкладки и возврат сети.
    const onFocus = () => {
      if (navigator.onLine) apiRef.current.pullNow();
    };
    const onOnline = () => {
      if (dirtyRef.current) apiRef.current.pushNow();
      else apiRef.current.pullNow();
    };
    const onOffline = () => setSyncStatus("offline");

    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      cancelled = true;
      clearTimeout(pushTimerRef.current);
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Обновляет срез текущей пары в общем хранилище + планирует отправку в облако.
  const updatePair = useCallback(
    (updater) => {
      setStore((prev) => {
        const cur = prev[pairKey] || EMPTY_PAIR;
        return { ...prev, [pairKey]: updater(cur) };
      });
      // Через apiRef, чтобы всегда планировать отправку со свежим user (после
      // входа updatePair не пересоздаётся, но apiRef обновляется каждый рендер).
      apiRef.current.schedulePush();
    },
    [pairKey],
  );

  // ВЗЯТЬ — в личный список изучения; убрать из отложенных.
  // Заодно заводим стартовую запись интервального повторения для этого слова.
  // При достижении MAX_ACTIVE_WORDS новое слово не добавляется — вызывающий
  // код (UI) сам решает, как мягко об этом сообщить (по возвращаемому false).
  const take = useCallback(
    (word) => {
      const alreadyTaken = takenWords.includes(word);
      if (!alreadyTaken && takenWords.length >= MAX_ACTIVE_WORDS) {
        return false;
      }
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
      return true;
    },
    [updatePair, takenWords],
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
  // Тот же лимит MAX_ACTIVE_WORDS, что и для «Взять» — иначе лимит можно
  // было бы обойти, массово возвращая известные слова обратно.
  const restoreToStudy = useCallback(
    (word) => {
      if (
        !takenWords.includes(word) &&
        takenWords.length >= MAX_ACTIVE_WORDS
      ) {
        return false;
      }
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
      return true;
    },
    [updatePair, takenWords],
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

  // УДАЛИТЬ СОВСЕМ — полностью убрать слова из пары: из всех списков
  // (taken/known/skipped) и из сопутствующих данных (wordInfo, srsByWord).
  // Принимает массив слов (режим выбора в списках). Изменение сохраняется в
  // localStorage через общий эффект — удалённое не вернётся после перезагрузки.
  const deleteWords = useCallback(
    (words) => {
      const toDelete = new Set(words);
      if (toDelete.size === 0) return;
      updatePair((cur) => {
        const info = { ...cur.wordInfo };
        const srs = { ...(cur.srsByWord || {}) };
        for (const w of toDelete) {
          delete info[w];
          delete srs[w];
        }
        return {
          ...cur,
          takenWords: cur.takenWords.filter((w) => !toDelete.has(w)),
          knownWords: cur.knownWords.filter((w) => !toDelete.has(w)),
          skippedWords: cur.skippedWords.filter((s) => !toDelete.has(s.word)),
          wordInfo: info,
          srsByWord: srs,
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
            // Культурный контекст режима «Контекст носителей» (у обычных слов нет):
            // register — короткий ярлык стиля, note — уместность/ситуация.
            register: c.register || "",
            note: c.note || "",
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
    deleteWords, // полное удаление слов (режим выбора в списках)
    // Синхронизация с облаком (Supabase).
    syncStatus, // disabled | syncing | synced | offline | error
    syncReason, // код причины сбоя (offline | missing-table | error) — текст в UI
    retrySync, // ручной повтор синхронизации
  };
}
