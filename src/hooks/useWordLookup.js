import { useState, useCallback, useRef, useEffect } from "react";
import { requestManualCard } from "../lib/manualCard.js";
import { requestPhrase } from "../lib/readingClient.js";
import { sentenceWords, sliceByWords } from "../lib/highlightWord.js";
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
 */

// Пауза перед запросом перевода оборота: три тапа по стрелке подряд должны
// стоить ОДИН вызов, а не три. Выделение и подсветка при этом двигаются сразу.
const EXTEND_DEBOUNCE_MS = 600;

export function useWordLookup({ learnLang, nativeLang, level, onAdd }) {
  const { t } = useI18n();
  const [lookup, setLookup] = useState(null);

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
            ? { ...prev, status: "ready", card: null, translation: res.translation }
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

      // Вернулись к исходному слову — карточка уже на руках.
      if (single && originCardRef.current?.word === phrase) {
        setLookup((prev) =>
          prev
            ? {
                ...prev,
                word: phrase,
                span,
                status: "ready",
                card: originCardRef.current.card,
                translation: null,
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
    [cancelPending, loadWord, loadPhrase],
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

      setLookup({ word, status: "loading", span });
      loadWord(word, span, reqId);
    },
    [cancelPending, loadWord],
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
  const add = useCallback(() => {
    if (!lookup || !lookup.card) return;
    const ok = onAdd(lookup.card);
    setLookup((prev) =>
      prev ? { ...prev, status: ok ? "added" : "limit" } : prev,
    );
  }, [lookup, onAdd]);

  const close = useCallback(() => {
    cancelPending();
    originCardRef.current = null;
    setLookup(null);
  }, [cancelPending]);

  return { lookup, open, extend, reset, add, close };
}
