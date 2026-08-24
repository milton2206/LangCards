import { useState, useEffect, useRef } from "react";
import { MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { cardForDisplay } from "../lib/displayText.js";
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
 * Повтор известных слов (идея Димы Еремы): быстрая самопроверка списка «Знаю».
 * Лицо карточки — слово; по тапу открывается перевод и пример.
 * «Помню» — просто дальше. «Вернуть в изучение» — слово уходит обратно в
 * takenWords через существующий restoreToStudy (с лимитом активных слов),
 * сохраняется и синхронизируется как обычно.
 *
 * Экран ОДИН на два входа, и второй реализации не заводим:
 *   • вручную с экрана «Известные» — весь список, как было;
 *   • блоком занятия — горсть слов, которые дольше всех не проверялись
 *     (выборку делает lib/knownCheck.js и передаёт сюда пропом words).
 *
 * SRS это по-прежнему не касается: «Помню» пишет ровно одну дату проверки
 * (onChecked), интервалы и серии известных слов не ведутся.
 */
export default function KnownReviewScreen({
  knownWords,
  // Что именно проверять. Не задано — весь список известных (ручной вход).
  words = null,
  wordInfo,
  learnLang,
  nativeLang,
  onRestore,
  // «Помню» — отметить слово проверенным (только дата, см. markKnownChecked).
  onChecked,
  // Очередь пройдена до конца — блок занятия отмечается выполненным.
  onFinished,
  onBack,
  // Мест под активные слова нет — вернуть забытое слово прямо сейчас нельзя
  // (тот же лимит, что и на карточке). Самопроверка при этом работает целиком.
  atLimit = false,
}) {
  const { t } = useI18n();
  // Локальная очередь захода: перемешана один раз при входе.
  const source = words && words.length > 0 ? words : knownWords;
  const [queue, setQueue] = useState(() => shuffle(source));
  const [revealed, setRevealed] = useState(false);
  const [limitNotice, setLimitNotice] = useState(false);
  // Сколько слов человек не вспомнил, но вернуть не смог — мест не было. Их
  // датой НЕ помечаем, поэтому они придут на следующую проверку первыми.
  const [deferred, setDeferred] = useState(0);

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

  // Очередь пройдена — сообщаем ОДИН раз: по этому событию блок занятия
  // отмечается выполненным. Заход и выход без разбора отметку не ставит, как и
  // у чтения с аудированием.
  const finishedRef = useRef(false);
  useEffect(() => {
    if (currentWord || finishedRef.current) return;
    finishedRef.current = true;
    onFinished?.();
  }, [currentWord, onFinished]);

  function next() {
    setQueue((prev) => prev.slice(1));
  }

  // «Помню» — отмечаем дату проверки и идём дальше. Больше НИЧЕГО: ни
  // интервала, ни серии — известные слова вне интервальных повторений.
  function handleRemember() {
    onChecked?.(currentWord);
    next();
  }

  // «Вернуть в изучение» — обратно в активное изучение (существующая механика).
  //
  // МЕСТ МОЖЕТ НЕ БЫТЬ, и тупика здесь быть не должно: человек только что
  // убедился, что слово не помнит, — заставлять его нажать «Помню» значит
  // соврать в собственных данных, а оставить его на этой карточке значит
  // запереть проверку. Поэтому слово просто пропускается БЕЗ отметки о
  // проверке: оно останется в известных и придёт на следующую проверку одним из
  // первых. Сам лимит не трогаем — освободить место человек решает сам.
  function handleRestore() {
    if (atLimit) {
      setDeferred((n) => n + 1);
      setLimitNotice(true);
      next();
      return;
    }
    const ok = onRestore(currentWord);
    if (ok) next();
    else {
      setDeferred((n) => n + 1);
      setLimitNotice(true);
      next();
    }
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
        <p className="knownreview__status-hint">
          {deferred > 0
            ? t("knownReview.doneDeferred", { n: deferred })
            : t("knownReview.doneHint")}
        </p>
        <button type="button" className="knownreview__done" onClick={onBack}>
          {t("common.done")}
        </button>
      </section>
    );
  }

  // Показ — почищенная копия (у старых записей остались знаки ударения).
  // currentWord остаётся ключом: им берётся запись и по нему возвращают слово.
  const info = wordInfo[currentWord] || {};
  const view = cardForDisplay({ ...info, word: currentWord }, learnLang);

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
          {view.word}
        </h1>

        {revealed ? (
          <>
            <div className="knownreview__divider" />
            <div className="knownreview__answer">
              {view.translit && (
                <p className="knownreview__translit">{view.translit}</p>
              )}
              {view.translitApprox && (
                <p className="knownreview__translit knownreview__translit--approx">
                  {view.translitApprox}
                </p>
              )}
              {view.translation && (
                <p className="knownreview__translation" lang={nativeLang}>
                  {view.translation}
                </p>
              )}
              {view.example && (
                <p className="knownreview__example" lang={learnLang}>
                  {view.example}
                </p>
              )}
              {view.exampleTranslation && (
                <p
                  className="knownreview__example-translation"
                  lang={nativeLang}
                >
                  {view.exampleTranslation}
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

      {/* Мест под активные слова нет — объясняем ЗАРАНЕЕ, ещё до нажатия: что
          вернуть слово прямо сейчас некуда и что забытое не потеряется. */}
      {(limitNotice || atLimit) && (
        <p className="knownreview__limit" role="status">
          {t("knownReview.limitHint", { max: MAX_ACTIVE_WORDS })}
        </p>
      )}

      {revealed && (
        <div className="knownreview__actions">
          {/* Мест нет — та же кнопка называется честно: вернуть сейчас некуда,
              слово просто придёт на следующую проверку. Неактивной её не
              делаем, иначе на забытом слове проверка упиралась бы в тупик. */}
          <button
            type="button"
            className="knownreview__btn knownreview__btn--restore"
            onClick={handleRestore}
          >
            {t(atLimit ? "knownReview.forgot" : "knownReview.restore")}
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
