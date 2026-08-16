import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { requestManualCard } from "../lib/manualCard.js";
import { requestPhrase } from "../lib/readingClient.js";
import {
  sentenceWords,
  sliceByWords,
  sameWordEntry,
} from "../../lib/highlightWord.js";
import { apiErrorText } from "../lib/apiClient.js";
import { useI18n } from "../i18n/I18nContext.jsx";

/**
 * Просмотр слова по тапу: перевод/транскрипция/пример от ИИ + добавление в
 * изучение. Общая логика для примера на карточке (фаза 4) и для текста в
 * режиме чтения (фаза 6.1) — параллельной логики карточек не заводим:
 * карточку собирает существующий requestManualCard, а добавляет её в SRS
 * переданный onAdd (в App это handleAddManualCard → vocab.take +
 * rememberCards, вместе с лимитом MAX_ACTIVE_WORDS).
 *
 * РАСШИРЕНИЕ ДО ОБОРОТА. Тап по слову не меняется, но в шторке можно раздвинуть
 * выделение влево/вправо и перевести оборот целиком («kept putting it off»).
 * Границей служит ПРЕДЛОЖЕНИЕ, из которого пришло слово: за него не выходим.
 * Нативное выделение текста для этого не годится — слова отрисованы кнопками.
 *
 * lookup: { word, status, card?, translation?, errorText?, span? }
 *   status: "loading" | "ready" | "error" | "added" | "limit"
 *   card        — есть только у ОДНОГО слова (транскрипция, пример, спряжение);
 *   translation — есть только у оборота (перевод в контексте, и больше ничего:
 *                 транскрипция и таблица форм для оборота бессмысленны);
 *   span        — { sentence, sentenceTranslation, words[], from, to, origin }
 *                 или null, если вызвавший экран не дал контекст предложения
 *                 (тогда стрелок расширения нет — поведение как раньше).
 *   confirm     — подтверждение взятия ОБОРОТА в изучение (у одного слова его
 *                 нет, там путь прежний): { lemma, translation, source,
 *                 example, exampleTranslation }.
 *
 * takenWords — активные слова пары: нужны, чтобы не заводить второй такой же
 * оборот (у обычного взятия дубликат просто молча не добавлялся бы).
 *
 * СНАЧАЛА СМОТРИМ, ЧТО УЖЕ ЕСТЬ. Тап по слову — не генерация текста: тут ждут
 * миллисекунды, а не секунды. Поэтому к модели идём, только если карточки нет
 * ни среди своих слов (wordInfo — взятые, известные, просто показанные), ни
 * среди полученных за эту сессию. Своё слово в тексте стоит в форме, поэтому
 * ищем и по форме тоже — общим sameWordEntry, без второй реализации.
 */

// Пауза перед запросом перевода оборота: три тапа по стрелке подряд должны
// стоить ОДИН вызов, а не три. Выделение и подсветка при этом двигаются сразу.
const EXTEND_DEBOUNCE_MS = 600;

// Сравнение слов/оборотов «по смыслу»: регистр и лишние пробелы не считаются.
function sameEntry(a, b) {
  return (
    String(a ?? "").trim().toLowerCase().replace(/\s+/g, " ") ===
    String(b ?? "").trim().toLowerCase().replace(/\s+/g, " ")
  );
}

const lower = (value) => String(value ?? "").trim().toLowerCase();

// ---------- Карточки, полученные за эту сессию ----------
// Тап по одному и тому же слову дважды — обычное дело при чтении: второй раз
// должен открываться мгновенно. Держим карточки В ПАМЯТИ (Map на модуль, общая
// для чтения и карточки), в localStorage не пишем: данные временные, а
// хранилище и так нагружено словами, текстами и снимками занятия.
//
// Ключ — слово + языковая пара: «Rechnung» для de-ru и de-uk это разные
// карточки. Обороты сюда НЕ попадают: их перевод зависит от предложения, и
// кэшировать его по одной лишь фразе значило бы подсунуть чужой контекст.
const SESSION_CACHE_LIMIT = 200;
const sessionCards = new Map();

function cacheKeyFor(learnLang, nativeLang, word) {
  return `${learnLang}-${nativeLang}|${lower(word)}`;
}

function rememberCard(learnLang, nativeLang, word, card) {
  if (!card) return;
  const key = cacheKeyFor(learnLang, nativeLang, word);
  // Простое ограничение сверху: выбрасываем самую старую запись. Карточки
  // крошечные, но расти без предела памяти всё равно незачем.
  if (sessionCards.size >= SESSION_CACHE_LIMIT) {
    const oldest = sessionCards.keys().next().value;
    sessionCards.delete(oldest);
  }
  sessionCards.set(key, card);
}

/**
 * Карточка слова из УЖЕ ИМЕЮЩИХСЯ данных: сначала точное совпадение, потом — по
 * форме. Форма нужна, потому что в тексте слово стоит в падеже или во времени
 * («Rechnungen», «ging»), а в wordInfo лежит словарная запись.
 *
 * Сравнение по формам берём готовое — sameWordEntry из lib/highlightWord.js:
 * тем же сравнением подсвечивается слово в примере и отсеиваются дубликаты при
 * генерации. Третьей реализации «то же слово или нет» в проекте быть не должно.
 *
 * exactIndex — заранее собранный индекс точных совпадений (см. useMemo ниже):
 * он снимает перебор в самом частом случае.
 */
function localCardFor(word, wordInfo, exactIndex) {
  const clean = String(word ?? "").trim();
  if (!clean || !wordInfo) return null;

  const usable = (key) => {
    const info = wordInfo[key];
    // Без перевода карточка бесполезна — за такой словом всё равно к модели.
    return info && String(info.translation ?? "").trim() ? { word: key, ...info } : null;
  };

  const exact = exactIndex?.get(lower(clean));
  if (exact) {
    const card = usable(exact);
    if (card) return card;
  }

  for (const key of Object.keys(wordInfo)) {
    if (!sameWordEntry(clean, key)) continue;
    const card = usable(key);
    if (card) return card;
  }
  return null;
}

export function useWordLookup({
  learnLang,
  nativeLang,
  level,
  onAdd,
  takenWords = [],
  // Карточки слов, которые у человека уже есть (wordInfo пары): взятые,
  // известные и просто показанные. По ним тап открывается БЕЗ запроса к модели.
  wordInfo = null,
}) {
  const { t } = useI18n();
  const [lookup, setLookup] = useState(null);

  // Индекс точных совпадений по нижнему регистру: самый частый случай не должен
  // перебирать весь словарь пользователя на каждый тап.
  const exactIndex = useMemo(() => {
    const index = new Map();
    for (const key of Object.keys(wordInfo || {})) index.set(lower(key), key);
    return index;
  }, [wordInfo]);

  /**
   * Карточка, которую можно показать СРАЗУ: своя (wordInfo) или полученная за
   * эту сессию. Возвращает null, если её нет и надо идти к модели.
   */
  const readyCardFor = useCallback(
    (word) =>
      localCardFor(word, wordInfo, exactIndex) ||
      sessionCards.get(cacheKeyFor(learnLang, nativeLang, word)) ||
      null,
    [wordInfo, exactIndex, learnLang, nativeLang],
  );

  // Таймер отложенного запроса и номер актуального запроса: ответ на устаревшее
  // выделение игнорируем (пользователь мог успеть раздвинуть дальше).
  const timerRef = useRef(null);
  const reqIdRef = useRef(0);
  // Карточка исходного слова: по «вернуться к одному слову» отдаём её сразу,
  // не запрашивая то же самое ещё раз.
  const originCardRef = useRef(null);

  const cancelPending = useCallback(() => {
    clearTimeout(timerRef.current);
    timerRef.current = null;
    reqIdRef.current += 1;
  }, []);

  useEffect(() => cancelPending, [cancelPending]);

  const errorTextFor = useCallback(
    (err) =>
      err?.code === "notRecognized"
        ? t("addWord.notRecognized")
        : // Серверную строку не показываем — она по-русски (см. apiClient).
          apiErrorText(err, t, "addWord.failed"),
    [t],
  );

  // Загрузка ОДНОГО слова — прежний путь (карточка от requestManualCard).
  const loadWord = useCallback(
    async (word, span, reqId) => {
      try {
        const card = await requestManualCard({ learnLang, nativeLang, word });
        if (reqIdRef.current !== reqId) return;
        // Полученную карточку держим до конца сессии: второй тап по тому же
        // слову к модели уже не пойдёт.
        rememberCard(learnLang, nativeLang, word, card);
        originCardRef.current = { word, card };
        setLookup((prev) =>
          prev ? { ...prev, word, span, status: "ready", card } : prev,
        );
      } catch (err) {
        if (reqIdRef.current !== reqId) return;
        setLookup((prev) =>
          prev
            ? { ...prev, word, span, status: "error", errorText: errorTextFor(err) }
            : prev,
        );
      }
    },
    [learnLang, nativeLang, errorTextFor],
  );

  // Загрузка ОБОРОТА — только перевод в контексте предложения.
  const loadPhrase = useCallback(
    async (phrase, span, reqId) => {
      try {
        const res = await requestPhrase({
          phrase,
          sentence: span.sentence,
          learnLang,
          nativeLang,
          level,
        });
        if (reqIdRef.current !== reqId) return;
        setLookup((prev) =>
          prev
            ? {
                ...prev,
                status: "ready",
                card: null,
                translation: res.translation,
                // Словарная форма пришла тем же вызовом — в изучение оборот
                // уедет в ней, а не буквальным куском текста.
                lemma: res.lemma || "",
              }
            : prev,
        );
      } catch (err) {
        if (reqIdRef.current !== reqId) return;
        setLookup((prev) =>
          prev
            ? { ...prev, status: "error", card: null, errorText: errorTextFor(err) }
            : prev,
        );
      }
    },
    [learnLang, nativeLang, level, errorTextFor],
  );

  /**
   * Применяет новые границы выделения: подсветка и текст фразы меняются СРАЗУ,
   * а перевод запрашивается после паузы (см. EXTEND_DEBOUNCE_MS).
   *
   * Целое предложение отдельным случаем: его перевод уже лежит в данных чтения
   * (поле translation у предложения), поэтому к API не идём вообще.
   */
  const applySpan = useCallback(
    (span) => {
      cancelPending();
      const reqId = reqIdRef.current;
      const phrase = sliceByWords(span.sentence, span.from, span.to);
      const single = span.from === span.to;

      // Одно слово, карточка на руках (то самое исходное слово, своё слово из
      // wordInfo или уже полученное в этой сессии) — показываем без запроса и
      // без паузы: ждать тут нечего.
      const known =
        single &&
        (originCardRef.current?.word === phrase
          ? originCardRef.current.card
          : readyCardFor(phrase));
      if (known) {
        setLookup((prev) =>
          prev
            ? {
                ...prev,
                word: phrase,
                span,
                status: "ready",
                card: known,
                translation: null,
                lemma: "",
                confirm: null,
              }
            : prev,
        );
        return;
      }

      const whole = span.from === 0 && span.to === span.words.length - 1;
      const ready = whole && String(span.sentenceTranslation ?? "").trim();

      setLookup((prev) =>
        prev
          ? {
              ...prev,
              word: phrase,
              span,
              card: null,
              translation: ready || null,
              // Целое предложение показывается из готового перевода, без вызова,
              // а значит и словарной формы у него нет — в изучение не предлагаем.
              lemma: "",
              confirm: null,
              errorText: null,
              status: ready ? "ready" : "loading",
            }
          : prev,
      );
      // Перевод целого предложения уже показан — запрашивать нечего.
      if (ready) return;

      timerRef.current = setTimeout(() => {
        if (reqIdRef.current !== reqId) return;
        if (single) loadWord(phrase, span, reqId);
        else loadPhrase(phrase, span, reqId);
      }, EXTEND_DEBOUNCE_MS);
    },
    [cancelPending, loadWord, loadPhrase, readyCardFor],
  );

  /**
   * Открыть просмотр слова.
   * context (необязателен) — { sentence, sentenceTranslation, wordIndex }:
   * предложение, из которого взято слово, его готовый перевод (если есть) и
   * номер слова в нём. Без контекста стрелок расширения не будет.
   */
  const open = useCallback(
    (word, context = null) => {
      cancelPending();
      const reqId = reqIdRef.current;
      originCardRef.current = null;

      let span = null;
      const sentence = String(context?.sentence ?? "");
      const words = sentence ? sentenceWords(sentence).map((w) => w.text) : [];
      const index = Number(context?.wordIndex);
      if (words.length > 0 && Number.isInteger(index) && words[index] != null) {
        span = {
          sentence,
          sentenceTranslation: context?.sentenceTranslation || "",
          words,
          from: index,
          to: index,
          origin: index,
        };
      }

      // ГЛАВНАЯ развилка тапа: карточка уже есть (своё слово из wordInfo либо
      // полученная в этой сессии) — открываем шторку сразу готовой, без
      // состояния «Ищем перевод…» и без похода к модели. Ждать несколько секунд
      // ради слова, которое человек сам же и учит, незачем.
      const ready = readyCardFor(word);
      if (ready) {
        originCardRef.current = { word, card: ready };
        setLookup({ word, status: "ready", card: ready, span, confirm: null });
        return;
      }

      // Незнакомое слово — запрос всё равно нужен. Шторка при этом открывается
      // сразу же (состояние ставится синхронно по тапу), а ожидание видно уже
      // внутри неё.
      setLookup({ word, status: "loading", span, confirm: null });
      loadWord(word, span, reqId);
    },
    [cancelPending, loadWord, readyCardFor],
  );

  // Присоединить соседнее слово. dir: -1 — влево, +1 — вправо. За границы
  // предложения не выходим (кнопка в эту сторону к тому моменту уже погашена).
  const extend = useCallback(
    (dir) => {
      const span = lookup?.span;
      if (!span) return;
      const from = dir < 0 ? span.from - 1 : span.from;
      const to = dir > 0 ? span.to + 1 : span.to;
      if (from < 0 || to > span.words.length - 1) return;
      applySpan({ ...span, from, to });
    },
    [lookup, applySpan],
  );

  // Вернуться к одному слову — тому, по которому тапнули.
  const reset = useCallback(() => {
    const span = lookup?.span;
    if (!span || (span.from === span.origin && span.to === span.origin)) return;
    applySpan({ ...span, from: span.origin, to: span.origin });
  }, [lookup, applySpan]);

  // Добавление в изучение: onAdd вернёт false при достижении лимита активных слов.
  // Важно: onAdd вызываем В ОБРАБОТЧИКЕ, а не внутри updater-а setLookup —
  // иначе он обновлял бы состояние App во время рендера (React ругается).
  //
  // ОДНО СЛОВО — прежний путь, без подтверждения. ОБОРОТ — сначала показываем,
  // что именно сохранится: диапазон стрелками легко промахнуть, и «but kept
  // putting» в списке слов никому не нужен.
  const add = useCallback(() => {
    if (!lookup) return;
    const span = lookup.span;
    const isPhrase = Boolean(span && span.to > span.from);

    if (!isPhrase) {
      if (!lookup.card) return;
      const ok = onAdd(lookup.card);
      setLookup((prev) =>
        prev ? { ...prev, status: ok ? "added" : "limit" } : prev,
      );
      return;
    }

    // Без словарной формы (её даёт тот же вызов, что и перевод) сохранять нечего.
    if (!lookup.lemma || !lookup.translation) return;
    setLookup((prev) =>
      prev
        ? {
            ...prev,
            confirm: {
              lemma: prev.lemma,
              translation: prev.translation,
              // Как оборот выглядел в тексте — показываем отдельной строкой,
              // чтобы было видно, что сохраняется НЕ буквальный кусок.
              source: prev.word,
              // Пример карточки — предложение, из которого выделили, с его
              // готовым переводом. Отдельной генерации примера не делаем.
              example: span.sentence,
              exampleTranslation: span.sentenceTranslation || "",
            },
          }
        : prev,
    );
  }, [lookup, onAdd]);

  // Подтвердить сохранение оборота: те же проверки, что и при обычном взятии
  // (лимит активных слов), плюс защита от второго такого же оборота.
  const confirmAdd = useCallback(() => {
    const data = lookup?.confirm;
    if (!data) return;
    if ((takenWords || []).some((w) => sameEntry(w, data.lemma))) {
      setLookup((prev) =>
        prev ? { ...prev, confirm: null, status: "duplicate" } : prev,
      );
      return;
    }
    const ok = onAdd({
      word: data.lemma,
      translation: data.translation,
      translit: "",
      example: data.example,
      exampleTranslation: data.exampleTranslation,
      // Оборот — не часть речи: таблицу спряжения для него не показываем
      // (её рисуют только при pos === "verb").
      pos: "phrase",
    });
    setLookup((prev) =>
      prev
        ? { ...prev, confirm: null, status: ok ? "added" : "limit" }
        : prev,
    );
  }, [lookup, onAdd, takenWords]);

  // Отмена: возвращаемся к шторке с ТЕМ ЖЕ диапазоном — выделение не сбрасываем.
  const cancelAdd = useCallback(() => {
    setLookup((prev) => (prev ? { ...prev, confirm: null } : prev));
  }, []);

  const close = useCallback(() => {
    cancelPending();
    originCardRef.current = null;
    setLookup(null);
  }, [cancelPending]);

  return { lookup, open, extend, reset, add, confirmAdd, cancelAdd, close };
}
