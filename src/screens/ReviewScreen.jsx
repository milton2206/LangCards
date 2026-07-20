import { useState, useEffect } from "react";
import "./ReviewScreen.css";

const GRADES = [
  { grade: "again", label: "Не помню", cls: "again" },
  { grade: "hard", label: "Трудно", cls: "hard" },
  { grade: "good", label: "Нормально", cls: "good" },
  { grade: "easy", label: "Легко", cls: "easy" },
];

/**
 * Экран повторения ВЗЯТЫХ слов (интервальное повторение) — отдельный режим
 * от потока новых карточек. Показывает слово; по тапу открывается перевод
 * и пример, затем самооценка (4 кнопки) пересчитывает интервал повтора
 * (см. nextSrs в useWordLists.js) и переходит к следующему слову.
 *
 * dueWords — живой список слов «пора повторить» (пересчитывается в App.jsx
 * после каждой оценки: слово с обновлённым nextReviewDate уходит из очереди
 * само, отдельный index не нужен).
 */
export default function ReviewScreen({
  dueWords,
  wordInfo,
  learnLang,
  nativeLang,
  onReview,
  onBack,
}) {
  const total = dueWords.length;
  const currentWord = dueWords[0];
  const [revealed, setRevealed] = useState(false);

  // Новое слово в очереди — прячем ответ снова.
  useEffect(() => {
    setRevealed(false);
  }, [currentWord]);

  if (!currentWord) {
    return (
      <section className="review review--status">
        <button
          type="button"
          className="review__back-corner"
          onClick={onBack}
          aria-label="Назад"
        >
          ←
        </button>
        <div className="review__status-emoji" aria-hidden="true">
          🎉
        </div>
        <h1 className="review__status-title">
          Повторение на сегодня завершено
        </h1>
        <p className="review__status-hint">
          Новые слова на повтор появятся, когда подойдёт их срок.
        </p>
        <button type="button" className="review__done" onClick={onBack}>
          Готово
        </button>
      </section>
    );
  }

  const info = wordInfo[currentWord] || {};

  return (
    <section className="review" aria-labelledby="review-word">
      <header className="review__header">
        <button
          type="button"
          className="review__back"
          onClick={onBack}
          aria-label="Назад"
        >
          ←
        </button>
        <span className="review__remaining">Осталось повторить: {total}</span>
      </header>

      <article className="review__card">
        <h1 id="review-word" className="review__word" lang={learnLang}>
          {currentWord}
        </h1>

        {revealed ? (
          <>
            <div className="review__divider" />
            <div className="review__answer">
              {info.translit && (
                <p className="review__translit">{info.translit}</p>
              )}
              {info.translation && (
                <p className="review__translation">{info.translation}</p>
              )}
              {info.example && (
                <div className="review__example">
                  <span className="review__example-label">Пример</span>
                  <p className="review__example-text" lang={learnLang}>
                    {info.example}
                  </p>
                  {info.exampleTranslation && (
                    <p
                      className="review__example-translation"
                      lang={nativeLang}
                    >
                      {info.exampleTranslation}
                    </p>
                  )}
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
            Показать перевод
          </button>
        )}
      </article>

      {revealed && (
        <div className="review__grades">
          {GRADES.map(({ grade, label, cls }) => (
            <button
              key={grade}
              type="button"
              className={`review__grade review__grade--${cls}`}
              onClick={() => onReview(currentWord, grade)}
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
