import { useEffect } from "react";
import { useWordSelection } from "../hooks/useWordSelection.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import SelectBar from "../components/SelectBar.jsx";
import WordListTabs from "../components/WordListTabs.jsx";
import PlayButton from "../components/PlayButton.jsx";
import "./MyWordsScreen.css";

/**
 * Список слов, взятых на изучение (takenWords). Порядок — как добавляли.
 * Полные данные (перевод, транскрипция, пример) берём из wordInfo — там же,
 * где их сохраняет главный экран при показе карточек.
 *
 * Режим выбора («Выбрать») позволяет отметить слова чекбоксами и удалить
 * их совсем (из списков и хранилища) с подтверждением.
 */
export default function MyWordsScreen({
  takenWords,
  knownCount,
  wordInfo,
  learnLang,
  nativeLang,
  onMarkKnown,
  onDelete,
  onBack,
  onOpenKnown,
}) {
  const { t } = useI18n();
  const items = takenWords.map((word) => ({
    word,
    ...wordInfo[word],
  }));

  // Открываем список с начала: при переключении вкладок сверху не остаёмся
  // прокрученными в середину нового (другого по длине) списка.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

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
          <h1 className="mywords__title">{t("words.mineTitle")}</h1>
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
          active="mine"
          takenCount={items.length}
          knownCount={knownCount}
          onOpenKnown={onOpenKnown}
        />
      </div>

      {items.length === 0 ? (
        <div className="mywords__empty">
          <div className="mywords__empty-emoji" aria-hidden="true">
            📭
          </div>
          <p className="mywords__empty-text">{t("words.mineEmpty")}</p>
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
                    <span className="mywords__word-row">
                      <span className="mywords__word" lang={learnLang}>
                        {item.word}
                      </span>
                      {!sel.selectMode && (
                        <PlayButton
                          text={item.word}
                          learnLang={learnLang}
                          kind="word"
                        />
                      )}
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
                      className="mywords__learned"
                      onClick={() => onMarkKnown(item.word)}
                    >
                      {t("words.learned")}
                    </button>
                  )}
                </div>

                {item.example && (
                  <div className="mywords__example">
                    <div className="mywords__example-row">
                      <p className="mywords__example-text" lang={learnLang}>
                        {item.example}
                      </p>
                      {!sel.selectMode && (
                        <PlayButton
                          text={item.example}
                          learnLang={learnLang}
                          kind="example"
                        />
                      )}
                    </div>
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
