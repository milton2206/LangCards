import { useEffect, useRef } from "react";
import { pickCurrentCard } from "../hooks/useWordLists.js";
import { useCards } from "../hooks/useCards.js";
import "./CardScreen.css";

/**
 * Главный экран: карточки со словом в контексте, сгенерированные Claude API
 * (через серверную функцию /api/cards). Три действия: «Взять», «Пропустить»,
 * «Знаю». Взятые/известные и отложенные слова в поток не попадают.
 */
export default function CardScreen({
  vocab,
  settings,
  onOpenSettings,
  onOpenMyWords,
}) {
  const { takenWords, knownWords, skippedWords, todayKey } = vocab;
  const { take, skip, markKnown, rememberCards } = vocab;
  const { cards, loading, error, load } = useCards();

  // Параметры запроса: тема/уровень/языки + исключения (взятые, известные,
  // ещё не вернувшиеся отложенные).
  function buildParams() {
    const deferred = skippedWords
      .filter((s) => (s.returnDate ?? "") > todayKey)
      .map((s) => s.word);
    return {
      learnLang: settings.learnLang,
      nativeLang: settings.nativeLang,
      topic: settings.topic,
      level: settings.level,
      exclude: [...new Set([...takenWords, ...knownWords, ...deferred])],
      count: 10,
    };
  }

  // Первичная загрузка порции при входе на экран (один раз).
  const startedRef = useRef(false);
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    load(buildParams());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Запоминаем данные полученных карточек для экранов списков.
  useEffect(() => {
    if (cards.length) rememberCards(cards);
  }, [cards, rememberCards]);

  if (loading) {
    return (
      <section className="cards cards--status">
        <div className="cards__spinner" aria-hidden="true" />
        <h1 className="cards__status-title">Генерируем карточки…</h1>
        <p className="cards__status-hint">
          Подбираем слова по вашей теме и уровню с помощью ИИ.
        </p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="cards cards--status">
        <div className="cards__status-emoji" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="cards__status-title">Не удалось загрузить</h1>
        <p className="cards__status-hint">{error}</p>
        <div className="cards__status-actions">
          <button
            type="button"
            className="cards__retry"
            onClick={() => load(buildParams())}
          >
            Повторить
          </button>
          <button
            type="button"
            className="cards__ghost"
            onClick={onOpenSettings}
          >
            Изменить настройки
          </button>
        </div>
      </section>
    );
  }

  const { card, done } = pickCurrentCard(cards, vocab);
  const total = cards.length;
  const learnedInBatch = cards.filter(
    (c) => takenWords.includes(c.word) || knownWords.includes(c.word),
  ).length;
  const remaining = total - learnedInBatch;

  if (done) {
    return (
      <section className="cards cards--status">
        <div className="cards__status-emoji" aria-hidden="true">
          🎉
        </div>
        <h1 className="cards__status-title">На сегодня всё</h1>
        <p className="cards__status-hint">
          Карточки из этой порции разобраны. Взято на изучение —{" "}
          {takenWords.length}, отмечено «знаю» — {knownWords.length}.
        </p>
        <div className="cards__status-actions">
          <button
            type="button"
            className="cards__retry"
            onClick={() => load(buildParams())}
          >
            Загрузить ещё
          </button>
          <button
            type="button"
            className="cards__ghost"
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
          style={{ width: `${(learnedInBatch / total) * 100}%` }}
        />
      </div>
      <p className="cards__remaining">Осталось в порции: {remaining}</p>

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
