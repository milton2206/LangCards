import { useWordSelection } from "../hooks/useWordSelection.js";
import SelectBar from "../components/SelectBar.jsx";
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
  const items = takenWords.map((word) => ({
    word,
    ...wordInfo[word],
  }));

  const sel = useWordSelection();

  function handleConfirmDelete() {
    onDelete(Array.from(sel.selected));
    sel.cancel();
  }

  return (
    <section className="mywords">
      <header className="mywords__header">
        <button
          type="button"
          className="mywords__back"
          onClick={onBack}
          aria-label="Назад"
        >
          ←
        </button>
        <h1 className="mywords__title">Мои слова</h1>
        <span className="mywords__count">{items.length}</span>
        {items.length > 0 && !sel.selectMode && (
          <button
            type="button"
            className="mywords__select"
            onClick={sel.enter}
          >
            Выбрать
          </button>
        )}
      </header>

      {items.length === 0 ? (
        <div className="mywords__empty">
          <div className="mywords__empty-emoji" aria-hidden="true">
            📭
          </div>
          <p className="mywords__empty-text">
            Пока пусто. Берите слова кнопкой «Взять» — они появятся здесь.
          </p>
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
                      className="mywords__learned"
                      onClick={() => onMarkKnown(item.word)}
                    >
                      Выучил
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

      {sel.selectMode ? (
        <SelectBar
          count={sel.selected.size}
          confirmOpen={sel.confirmOpen}
          onCancel={sel.cancel}
          onRequestDelete={sel.openConfirm}
          onConfirmDelete={handleConfirmDelete}
          onCloseConfirm={sel.closeConfirm}
        />
      ) : (
        <button type="button" className="mywords__nav" onClick={onOpenKnown}>
          <span>Известные слова</span>
          <span className="mywords__nav-count">{knownCount}</span>
        </button>
      )}
    </section>
  );
}
