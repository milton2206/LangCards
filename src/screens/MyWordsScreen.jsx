import { CARDS } from "../data/cards.js";
import "./MyWordsScreen.css";

/**
 * Список слов, взятых на изучение (takenWords). Порядок — как добавляли.
 */
export default function MyWordsScreen({ takenWords, knownCount, onBack }) {
  const items = takenWords
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
          {items.map((card) => (
            <li key={card.word} className="mywords__item">
              <span className="mywords__word">{card.word}</span>
              <span className="mywords__translation">{card.translation}</span>
            </li>
          ))}
        </ul>
      )}

      {knownCount > 0 && (
        <p className="mywords__note">Отмечено «знаю»: {knownCount}</p>
      )}
    </section>
  );
}
