import { CARDS } from "../data/cards.js";
import "./MyWordsScreen.css";

/**
 * Список известных слов (knownWords, отмеченных «Знаю»).
 * У каждого — кнопка «Вернуть»: слово уходит из известных обратно в изучение.
 * Оформление — по образцу экрана «Мои слова».
 */
export default function KnownWordsScreen({
  knownWords,
  takenCount,
  onRestore,
  onBack,
  onOpenMyWords,
}) {
  const items = knownWords
    .map((word) => CARDS.find((c) => c.word === word))
    .filter(Boolean);

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
        <h1 className="mywords__title">Известные слова</h1>
        <span className="mywords__count">{items.length}</span>
      </header>

      {items.length === 0 ? (
        <div className="mywords__empty">
          <div className="mywords__empty-emoji" aria-hidden="true">
            🧠
          </div>
          <p className="mywords__empty-text">
            Пока пусто. Слова, отмеченные «Знаю», будут собираться здесь.
          </p>
        </div>
      ) : (
        <ul className="mywords__list">
          {items.map((card) => (
            <li key={card.word} className="mywords__item mywords__item--row">
              <div className="mywords__item-text">
                <span className="mywords__word">{card.word}</span>
                <span className="mywords__translation">
                  {card.translation}
                </span>
              </div>
              <button
                type="button"
                className="mywords__restore"
                onClick={() => onRestore(card.word)}
              >
                ↩ Вернуть
              </button>
            </li>
          ))}
        </ul>
      )}

      <button type="button" className="mywords__nav" onClick={onOpenMyWords}>
        <span>📚 Мои слова</span>
        <span className="mywords__nav-count">{takenCount}</span>
      </button>
    </section>
  );
}
