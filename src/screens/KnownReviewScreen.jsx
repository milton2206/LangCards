import { useState, useEffect } from "react";
import { MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./KnownReviewScreen.css";

// Перемешивание Фишера–Йетса: каждый заход — новый порядок слов.
function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Повтор известных слов (идея Димы Еремы): быстрая самопроверка списка «Знаю»
 * по желанию пользователя — без расписания и без влияния на SRS.
 * Лицо карточки — слово; по тапу открывается перевод и пример.
 * «Помню» — просто дальше. «Вернуть в изучение» — слово уходит обратно в
 * takenWords через существующий restoreToStudy (с лимитом активных слов),
 * сохраняется и синхронизируется как обычно.
 */
export default function KnownReviewScreen({
  knownWords,
  wordInfo,
  learnLang,
  nativeLang,
  onRestore,
  onBack,
}) {
  const { t } = useI18n();
  // Локальная очередь сессии: перемешана один раз при входе.
  const [queue, setQueue] = useState(() => shuffle(knownWords));
  const [revealed, setRevealed] = useState(false);
  const [limitNotice, setLimitNotice] = useState(false);

  useEffect(() => {
    if (!limitNotice) return;
    const timer = setTimeout(() => setLimitNotice(false), 4000);
    return () => clearTimeout(timer);
  }, [limitNotice]);

  const currentWord = queue[0];

  // Новое слово — прячем ответ снова.
  useEffect(() => {
    setRevealed(false);
  }, [currentWord]);

  function next() {
    setQueue((prev) => prev.slice(1));
  }

  // «Помню» — идём дальше, ничего не меняя (это самопроверка, не SRS).
  function handleRemember() {
    next();
  }

  // «Вернуть в изучение» — обратно в активное изучение (существующая механика).
  function handleRestore() {
    const ok = onRestore(currentWord);
    if (ok) next();
    else setLimitNotice(true);
  }

  if (!currentWord) {
    return (
      <section className="knownreview knownreview--status">
        <button
          type="button"
          className="knownreview__back-corner"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <div className="knownreview__status-emoji" aria-hidden="true">
          🎉
        </div>
        <h1 className="knownreview__status-title">
          {t("knownReview.doneTitle")}
        </h1>
        <p className="knownreview__status-hint">{t("knownReview.doneHint")}</p>
        <button type="button" className="knownreview__done" onClick={onBack}>
          {t("common.done")}
        </button>
      </section>
    );
  }

  const info = wordInfo[currentWord] || {};

  return (
    <section className="knownreview" aria-labelledby="knownreview-word">
      <header className="knownreview__header">
        <button
          type="button"
          className="knownreview__back"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <span className="knownreview__remaining">
          {t("review.remaining", { n: queue.length })}
        </span>
      </header>

      <article className="knownreview__card">
        {/* Лицо — само слово: «помню ли я, что это значит?» */}
        <h1 id="knownreview-word" className="knownreview__word" lang={learnLang}>
          {currentWord}
        </h1>

        {revealed ? (
          <>
            <div className="knownreview__divider" />
            <div className="knownreview__answer">
              {info.translit && (
                <p className="knownreview__translit">{info.translit}</p>
              )}
              {info.translation && (
                <p className="knownreview__translation" lang={nativeLang}>
                  {info.translation}
                </p>
              )}
              {info.example && (
                <p className="knownreview__example" lang={learnLang}>
                  {info.example}
                </p>
              )}
              {info.exampleTranslation && (
                <p
                  className="knownreview__example-translation"
                  lang={nativeLang}
                >
                  {info.exampleTranslation}
                </p>
              )}
            </div>
          </>
        ) : (
          <button
            type="button"
            className="knownreview__reveal"
            onClick={() => setRevealed(true)}
          >
            {t("review.reveal")}
          </button>
        )}
      </article>

      {limitNotice && (
        <p className="knownreview__limit" role="status">
          {t("common.activeLimit", { max: MAX_ACTIVE_WORDS })}
        </p>
      )}

      {revealed && (
        <div className="knownreview__actions">
          <button
            type="button"
            className="knownreview__btn knownreview__btn--restore"
            onClick={handleRestore}
          >
            {t("knownReview.restore")}
          </button>
          <button
            type="button"
            className="knownreview__btn knownreview__btn--remember"
            onClick={handleRemember}
          >
            {t("knownReview.remember")}
          </button>
        </div>
      )}
    </section>
  );
}
