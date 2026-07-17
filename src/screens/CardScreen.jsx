import { CARDS } from "../data/cards.js";
import { pickCurrentCard } from "../hooks/useWordLists.js";
import "./CardScreen.css";

// ВРЕМЕННО (отладка): полоска для прокрутки дней вперёд, чтобы проверить
// возврат отложенных слов, не дожидаясь реальных дней. Потом уберём.
function DebugDayBar({ todayKey, dayOffset, onAdvance }) {
  return (
    <div className="cards__debug">
      <span className="cards__debug-info">
        🐛 Отладка · сегодня {todayKey}
        {dayOffset > 0 ? ` (+${dayOffset} дн.)` : ""}
      </span>
      <button type="button" className="cards__debug-btn" onClick={onAdvance}>
        ⏩ Промотать день вперёд
      </button>
    </div>
  );
}

/**
 * Главный экран: карточки по одной со словом в контексте.
 * Три действия: «Взять» (в личный список), «Пропустить» (отложить на 3 дня
 * по дате), «Знаю» (исключить навсегда). Взятые/известные и ещё не
 * вернувшиеся отложенные в поток не попадают.
 */
export default function CardScreen({ vocab, onOpenSettings, onOpenMyWords }) {
  const { takenWords, knownWords, skippedWords, todayKey, dayOffset } = vocab;
  const { take, skip, markKnown, advanceDay } = vocab;
  const total = CARDS.length;
  const { card, done } = pickCurrentCard(CARDS, vocab);

  const learnedCount = CARDS.filter(
    (c) => takenWords.includes(c.word) || knownWords.includes(c.word),
  ).length;
  const remaining = total - learnedCount;

  // Отложенные слова, которые ещё не вернулись (дата возврата в будущем).
  const deferredCount = skippedWords.filter(
    (s) =>
      !takenWords.includes(s.word) &&
      !knownWords.includes(s.word) &&
      s.returnDate > todayKey,
  ).length;

  if (done) {
    return (
      <section className="cards cards--done">
        <DebugDayBar
          todayKey={todayKey}
          dayOffset={dayOffset}
          onAdvance={advanceDay}
        />
        <div className="cards__done-center">
          <div className="cards__done-emoji" aria-hidden="true">
            🎉
          </div>
          <h1 className="cards__done-title">На сегодня всё</h1>
          <p className="cards__done-hint">
            Новых карточек сейчас нет. Взято на изучение — {takenWords.length},
            отмечено «знаю» — {knownWords.length}.
            {deferredCount > 0
              ? ` Отложено на потом — ${deferredCount} (вернутся в свой день).`
              : ""}
          </p>
          <button
            type="button"
            className="cards__restart"
            onClick={onOpenMyWords}
          >
            📚 Мои слова
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="cards" aria-labelledby="card-word">
      <DebugDayBar
        todayKey={todayKey}
        dayOffset={dayOffset}
        onAdvance={advanceDay}
      />

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
