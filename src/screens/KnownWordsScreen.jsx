import { useEffect, useState } from "react";
import { MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { useWordSelection } from "../hooks/useWordSelection.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import SelectBar from "../components/SelectBar.jsx";
import WordListTabs from "../components/WordListTabs.jsx";
import "./MyWordsScreen.css";

/**
 * Список известных слов (knownWords, отмеченных «Знаю»).
 * У каждого — кнопка «Вернуть»: слово уходит из известных обратно в изучение.
 * Оформление — по образцу экрана «Мои слова». Полные данные (перевод,
 * транскрипция, пример) — из wordInfo.
 *
 * Режим выбора («Выбрать») позволяет отметить слова чекбоксами и удалить
 * их совсем (из списков и хранилища) с подтверждением.
 */
export default function KnownWordsScreen({
  knownWords,
  takenCount,
  wordInfo,
  learnLang,
  nativeLang,
  onRestore,
  onDelete,
  onBack,
  onOpenMyWords,
  onOpenKnownReview,
}) {
  const { t } = useI18n();
  const items = knownWords.map((word) => ({
    word,
    ...wordInfo[word],
  }));

  // Открываем список с начала: при переключении вкладок сверху не остаёмся
  // прокрученными в середину нового (другого по длине) списка.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Мягкое сообщение, если «Вернуть» упирается в лимит активных слов.
  const [limitNotice, setLimitNotice] = useState(false);
  useEffect(() => {
    if (!limitNotice) return;
    const timer = setTimeout(() => setLimitNotice(false), 4000);
    return () => clearTimeout(timer);
  }, [limitNotice]);

  function handleRestore(word) {
    const ok = onRestore(word);
    if (!ok) setLimitNotice(true);
  }

  const sel = useWordSelection();

  function handleConfirmDelete() {
    onDelete(Array.from(sel.selected));
    sel.cancel();
  }

  return (
    <section className="mywords">
      <div className="mywords__top">
        <header className="mywords__header">
          <button
            type="button"
            className="mywords__back"
            onClick={onBack}
            aria-label={t("common.back")}
          >
            ←
          </button>
          <h1 className="mywords__title">{t("words.knownTitle")}</h1>
          {items.length > 0 && !sel.selectMode && (
            <button
              type="button"
              className="mywords__select"
              onClick={sel.enter}
            >
              {t("words.select")}
            </button>
          )}
        </header>

        <WordListTabs
          active="known"
          takenCount={takenCount}
          knownCount={items.length}
          onOpenMyWords={onOpenMyWords}
        />

        {/* Повтор известных (идея Димы Еремы): необязательная самопроверка по
            желанию — никакого расписания, только когда пользователь сам хочет. */}
        {items.length > 0 && !sel.selectMode && (
          <button
            type="button"
            className="mywords__review-known"
            onClick={onOpenKnownReview}
          >
            🔄 {t("knownReview.entry")}
          </button>
        )}

        {limitNotice && (
          <p className="mywords__limit-notice" role="status">
            {t("common.activeLimit", { max: MAX_ACTIVE_WORDS })}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mywords__empty">
          <div className="mywords__empty-emoji" aria-hidden="true">
            🧠
          </div>
          <p className="mywords__empty-text">{t("words.knownEmpty")}</p>
        </div>
      ) : (
        <ul className="mywords__list">
          {items.map((item) => {
            const checked = sel.selected.has(item.word);
            return (
              <li
                key={item.word}
                className={
                  "mywords__item" +
                  (sel.selectMode ? " mywords__item--selectable" : "") +
                  (checked ? " is-selected" : "")
                }
                onClick={
                  sel.selectMode ? () => sel.toggle(item.word) : undefined
                }
              >
                <div className="mywords__item-row">
                  {sel.selectMode && (
                    <span
                      className={
                        "mywords__checkbox" + (checked ? " is-checked" : "")
                      }
                      aria-hidden="true"
                    >
                      {checked ? "✓" : ""}
                    </span>
                  )}
                  <div className="mywords__item-text">
                    <span className="mywords__word" lang={learnLang}>
                      {item.word}
                    </span>
                    {item.translit && (
                      <span className="mywords__translit">
                        {item.translit}
                      </span>
                    )}
                    {item.translation && (
                      <span className="mywords__translation">
                        {item.translation}
                      </span>
                    )}
                  </div>
                  {!sel.selectMode && (
                    <button
                      type="button"
                      className="mywords__restore"
                      onClick={() => handleRestore(item.word)}
                    >
                      {t("words.restore")}
                    </button>
                  )}
                </div>

                {item.example && (
                  <div className="mywords__example">
                    <p className="mywords__example-text" lang={learnLang}>
                      {item.example}
                    </p>
                    {item.exampleTranslation && (
                      <p
                        className="mywords__example-translation"
                        lang={nativeLang}
                      >
                        {item.exampleTranslation}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sel.selectMode && (
        <SelectBar
          count={sel.selected.size}
          confirmOpen={sel.confirmOpen}
          onCancel={sel.cancel}
          onRequestDelete={sel.openConfirm}
          onConfirmDelete={handleConfirmDelete}
          onCloseConfirm={sel.closeConfirm}
        />
      )}
    </section>
  );
}
