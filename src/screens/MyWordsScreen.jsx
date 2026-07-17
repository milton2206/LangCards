import "./MyWordsScreen.css";

/**
 * Список слов, взятых на изучение (takenWords). Порядок — как добавляли.
 * Перевод берём из wordInfo (данные виденных карточек).
 */
export default function MyWordsScreen({
  takenWords,
  knownCount,
  wordInfo,
  onBack,
  onOpenKnown,
}) {
  const items = takenWords.map((word) => ({
    word,
    translation: wordInfo[word]?.translation || "",
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
              <span className="mywords__word">{item.word}</span>
              {item.translation && (
                <span className="mywords__translation">
                  {item.translation}
                </span>
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
