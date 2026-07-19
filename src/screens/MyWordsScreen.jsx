import "./MyWordsScreen.css";

/**
 * Список слов, взятых на изучение (takenWords). Порядок — как добавляли.
 * Полные данные (перевод, транскрипция, пример) берём из wordInfo — там же,
 * где их сохраняет главный экран при показе карточек.
 */
export default function MyWordsScreen({
  takenWords,
  knownCount,
  wordInfo,
  learnLang,
  nativeLang,
  onMarkKnown,
  onBack,
  onOpenKnown,
}) {
  const items = takenWords.map((word) => ({
    word,
    ...wordInfo[word],
  }));

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
          {items.map((item) => (
            <li key={item.word} className="mywords__item">
              <div className="mywords__item-row">
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
                <button
                  type="button"
                  className="mywords__learned"
                  onClick={() => onMarkKnown(item.word)}
                >
                  ✓ Выучил
                </button>
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
          ))}
        </ul>
      )}

      <button type="button" className="mywords__nav" onClick={onOpenKnown}>
        <span>✅ Известные слова</span>
        <span className="mywords__nav-count">{knownCount}</span>
      </button>
    </section>
  );
}
