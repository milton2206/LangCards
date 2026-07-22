import { useState, useEffect } from "react";
import { highlightWordInExample } from "../lib/highlightWord.js";
import { formatInterval } from "../i18n/format.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { nextSrs } from "../hooks/useWordLists.js";
import "./ReviewScreen.css";

const GRADES = [
  // «Не помню» не откладывает слово на интервал, а возвращает его дальше в
  // текущей сессии (replay) — поэтому вместо срока показываем «повторить сейчас».
  { grade: "again", cls: "again", replay: true },
  { grade: "hard", cls: "hard" },
  { grade: "good", cls: "good" },
  { grade: "easy", cls: "easy" },
];

// На сколько карточек назад отправить слово при «Не помню» — чтобы был
// небольшой промежуток на вспоминание, а не мгновенный повтор.
const REQUEUE_GAP = 3;

/**
 * Экран повторения ВЗЯТЫХ слов (интервальное повторение) — отдельный режим
 * от потока новых карточек (Взять/Пропустить/Знаю там не трогаем).
 *
 * Лицо карточки — пример предложения целиком, с выделенным изучаемым словом
 * (учим слово в контексте, а не изолированно). По тапу «Показать перевод»
 * открывается само слово, транскрипция, перевод слова и перевод предложения,
 * затем самооценка (4 кнопки) пересчитывает интервал повтора (см. nextSrs
 * в useWordLists.js) и переходит к следующему слову.
 *
 * dueWords — живой список слов «пора повторить» (пересчитывается в App.jsx
 * после каждой оценки: слово с обновлённым nextReviewDate уходит из очереди
 * само, отдельный index не нужен).
 *
 * Порядок показа держим в ЛОКАЛЬНОЙ очереди сессии (queue): «Не помню» не
 * трогает интервал слова (оно остаётся «пора повторить»), а лишь отправляет
 * его на несколько карточек назад — так слово крутится в текущей сессии, пока
 * по нему не нажмут другую кнопку. Остальные оценки применяют интервал через
 * onReview → слово выпадает из dueWords и очередь его убирает при синхронизации.
 */
export default function ReviewScreen({
  dueWords,
  wordInfo,
  srsByWord,
  todayKey,
  learnLang,
  nativeLang,
  onReview,
  onBack,
}) {
  const { t, lang } = useI18n();
  const [revealed, setRevealed] = useState(false);
  const [queue, setQueue] = useState(() => dueWords);

  // Синхронизация очереди с актуальным набором «пора повторить»: убираем слова,
  // которые уже ушли на интервал (после Трудно/Нормально/Легко), и добавляем
  // новые. Локальный порядок (в т.ч. переносы от «Не помню») сохраняется.
  // «Не помню» не меняет dueWords, поэтому эта синхронизация не сбрасывает его.
  useEffect(() => {
    setQueue((prev) => {
      const due = new Set(dueWords);
      const kept = prev.filter((w) => due.has(w));
      const keptSet = new Set(kept);
      const added = dueWords.filter((w) => !keptSet.has(w));
      const next = [...kept, ...added];
      const same =
        next.length === prev.length && next.every((w, i) => w === prev[i]);
      return same ? prev : next;
    });
  }, [dueWords]);

  const total = queue.length;
  const currentWord = queue[0];

  // Новое слово в очереди — прячем ответ снова.
  useEffect(() => {
    setRevealed(false);
  }, [currentWord]);

  // «Не помню» — вернуть слово в текущую сессию через несколько карточек, не
  // применяя интервал. Остальные оценки — обычный SRS (слово покидает сессию).
  function handleGrade(word, grade) {
    setRevealed(false);
    if (grade === "again") {
      setQueue((prev) => {
        if (prev.length <= 1) return prev; // некуда переносить — покажем снова
        const [first, ...rest] = prev;
        const pos = Math.min(REQUEUE_GAP, rest.length);
        return [...rest.slice(0, pos), first, ...rest.slice(pos)];
      });
      return;
    }
    onReview(word, grade);
  }

  if (!currentWord) {
    return (
      <section className="review review--status">
        <button
          type="button"
          className="review__back-corner"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <div className="review__status-emoji" aria-hidden="true">
          🎉
        </div>
        <h1 className="review__status-title">{t("review.doneTitle")}</h1>
        <p className="review__status-hint">{t("review.doneHint")}</p>
        <button type="button" className="review__done" onClick={onBack}>
          {t("common.done")}
        </button>
      </section>
    );
  }

  const info = wordInfo[currentWord] || {};
  const hasExample = Boolean(info.example);
  const segments = hasExample
    ? highlightWordInExample(info.example, currentWord)
    : [];

  // Какой интервал реально применится при каждой оценке — считаем той же
  // функцией, что и на самом нажатии (nextSrs), с текущими параметрами
  // ИМЕННО этого слова, поэтому у разных слов подписи разные.
  const currentSrs = srsByWord[currentWord];
  const gradesWithInterval = GRADES.map((g) => ({
    ...g,
    interval: nextSrs(currentSrs, g.grade, todayKey).interval,
  }));

  return (
    <section className="review" aria-labelledby="review-word">
      <header className="review__header">
        <button
          type="button"
          className="review__back"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <span className="review__remaining">
          {t("review.remaining", { n: total })}
        </span>
      </header>

      <article className="review__card">
        {/* Лицо: предложение целиком, изучаемое слово выделено */}
        {hasExample ? (
          <p className="review__sentence" lang={learnLang}>
            {segments.map((seg, i) =>
              seg.highlight ? (
                <mark key={i} className="review__highlight">
                  {seg.text}
                </mark>
              ) : (
                <span key={i}>{seg.text}</span>
              ),
            )}
          </p>
        ) : (
          // Нет сохранённого примера (редкий случай для старых данных) —
          // показываем хотя бы само слово, чтобы экран оставался рабочим.
          <p className="review__sentence" lang={learnLang}>
            {currentWord}
          </p>
        )}

        {revealed ? (
          <>
            <div className="review__divider" />
            <div className="review__answer">
              <h1 id="review-word" className="review__word" lang={learnLang}>
                {currentWord}
              </h1>
              {info.translit && (
                <p className="review__translit">{info.translit}</p>
              )}
              {info.translation && (
                <p className="review__translation">{info.translation}</p>
              )}
              {info.exampleTranslation && (
                <div className="review__sentence-translation-block">
                  <span className="review__sentence-translation-label">
                    {t("review.exampleTranslation")}
                  </span>
                  <p
                    className="review__sentence-translation"
                    lang={nativeLang}
                  >
                    {info.exampleTranslation}
                  </p>
                </div>
              )}
              {info.note && (
                <div className="review__sentence-translation-block">
                  <span className="review__sentence-translation-label">
                    {t("cards.usageNote")}
                  </span>
                  <p className="review__sentence-translation" lang={nativeLang}>
                    {info.note}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            className="review__reveal"
            onClick={() => setRevealed(true)}
          >
            {t("review.reveal")}
          </button>
        )}
      </article>

      {revealed && (
        <div className="review__grades">
          {gradesWithInterval.map(({ grade, cls, interval, replay }) => (
            <button
              key={grade}
              type="button"
              className={`review__grade review__grade--${cls}`}
              onClick={() => handleGrade(currentWord, grade)}
            >
              <span className="review__grade-label">{t(`grade.${grade}`)}</span>
              <span className="review__grade-interval">
                {replay
                  ? t("review.replayNow")
                  : formatInterval(t, lang, interval)}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
