import { CARDS } from "../data/cards.js";
import { pickCurrentCard } from "../hooks/useWordLists.js";
import "./CardScreen.css";

/**
 * Главный экран: показывает карточки по одной со словом в контексте.
 * Три действия: «Взять» (в личный список), «Пропустить» (отложить и вернуть
 * позже), «Знаю» (исключить навсегда). Взятые и известные не попадают в поток.
 */
export default function CardScreen({ vocab, onOpenSettings, onOpenMyWords }) {
  const { takenWords, knownWords, take, skip, markKnown } = vocab;
  const total = CARDS.length;
  const { card, done } = pickCurrentCard(CARDS, vocab);

  const learnedCount = CARDS.filter(
    (c) => takenWords.includes(c.word) || knownWords.includes(c.word),
  ).length;
  const remaining = total - learnedCount;

  if (done) {
    return (
      <section className="cards cards--done">
        <div className="cards__done-emoji" aria-hidden="true">
          🎉
        </div>
        <h1 className="cards__done-title">На сегодня всё</h1>
        <p className="cards__done-hint">
          Новых карточек по теме больше нет. Вы взяли на изучение{" "}
          {takenWords.length}, отметили «знаю» — {knownWords.length}.
        </p>
        <button
          type="button"
          className="cards__restart"
          onClick={onOpenMyWords}
        >
          📚 Мои слова
        </button>
      </section>
    );
  }

  return (
    <section className="cards" aria-labelledby="card-word">
      <header className="cards__topbar">
        <button
          type="button"
          className="cards__mywords"
          onClick={onOpenMyWords}
        >
          📚 Мои слова
          <span className="cards__badge">{takenWords.length}</span>
        </button>
        <button
          type="button"
          className="cards__settings"
          onClick={onOpenSettings}
          aria-label="Настройки"
        >
          ⚙️
        </button>
      </header>

      <div className="cards__progressbar" aria-hidden="true">
        <span
          className="cards__progressbar-fill"
          style={{ width: `${(learnedCount / total) * 100}%` }}
        />
      </div>
      <p className="cards__remaining">Осталось новых: {remaining}</p>

      <article className="cards__card">
        <div className="cards__word-block">
          <h1 id="card-word" className="cards__word">
            {card.word}
          </h1>
          {card.translit && (
            <p className="cards__translit">{card.translit}</p>
          )}
          <p className="cards__translation">{card.translation}</p>
        </div>

        <div className="cards__divider" />

        <div className="cards__example">
          <span className="cards__example-label">Пример</span>
          <p className="cards__example-text">{card.example}</p>
          <p className="cards__example-translation">
            {card.exampleTranslation}
          </p>
        </div>
      </article>

      <div className="cards__actions">
        <button
          type="button"
          className="cards__action cards__action--take"
          onClick={() => take(card.word)}
        >
          <span className="cards__action-emoji" aria-hidden="true">
            ➕
          </span>
          Взять
        </button>
        <div className="cards__actions-row">
          <button
            type="button"
            className="cards__action cards__action--skip"
            onClick={() => skip(card.word)}
          >
            <span className="cards__action-emoji" aria-hidden="true">
              ⏭️
            </span>
            Пропустить
          </button>
          <button
            type="button"
            className="cards__action cards__action--known"
            onClick={() => markKnown(card.word)}
          >
            <span className="cards__action-emoji" aria-hidden="true">
              ✓
            </span>
            Знаю
          </button>
        </div>
      </div>
    </section>
  );
}
