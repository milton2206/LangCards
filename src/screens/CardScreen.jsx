import { useEffect, useState } from "react";
import { pickCurrentCard, MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { useSwipeCard, SWIPE_THRESHOLD } from "../hooks/useSwipeCard.js";
import { GENERATE_COUNT_OPTIONS } from "../lib/generateCount.js";
import { pluralRu } from "../lib/humanizeInterval.js";
import "./CardScreen.css";

// Переключатель «сколько карточек генерировать за раз» (5/10/20) — рядом с
// кнопкой генерации в обоих местах, где она встречается на этом экране.
function GenerateCountPicker({ value, onChange }) {
  return (
    <div className="cards__count-picker">
      <span className="cards__count-label">Сколько карточек:</span>
      <div className="cards__count-options">
        {GENERATE_COUNT_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            className={
              "cards__count-chip" + (value === n ? " is-active" : "")
            }
            aria-pressed={value === n}
            onClick={() => onChange(n)}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Главный экран. Карточки НЕ генерируются автоматически — только по кнопке
 * «Сгенерировать новые карточки». Текущая порция берётся из props (persist
 * в localStorage), позиция определяется списками taken/known/skipped.
 */
export default function CardScreen({
  vocab,
  cards,
  loading,
  error,
  learnLang,
  dueCount,
  generateCount,
  onChangeGenerateCount,
  onGenerate,
  onClearError,
  onOpenSettings,
  onOpenMyWords,
  onOpenReview,
  onOpenStats,
}) {
  const { takenWords, knownWords, take, skip, markKnown, rememberCards } = vocab;

  // Мягкое сообщение при достижении лимита активных слов (см. MAX_ACTIVE_WORDS
  // в useWordLists.js) — не блокировка, просто понятная подсказка на пару секунд.
  const [limitNotice, setLimitNotice] = useState(false);
  useEffect(() => {
    if (!limitNotice) return;
    const timer = setTimeout(() => setLimitNotice(false), 4000);
    return () => clearTimeout(timer);
  }, [limitNotice]);

  function handleTake(word) {
    const ok = take(word);
    if (!ok) setLimitNotice(true);
  }

  // Запоминаем данные показанных карточек для экранов «Мои слова»/«Известные».
  useEffect(() => {
    if (cards.length) rememberCards(cards);
  }, [cards, rememberCards]);

  // pickCurrentCard/swipe вызываются ДО ранних return (loading/error) —
  // хуки должны отрабатывать в одном порядке на каждый рендер.
  const { card, done } = pickCurrentCard(cards, vocab);
  const empty = cards.length === 0;

  // Свайп — ОСНОВНОЙ способ разобрать новое слово (кнопок «Взять»/«Знаю»
  // больше нет): вправо = Взять (в изучение), влево = Знаю (навсегда).
  // «Пропустить» осталось отдельной кнопкой. Активно при наличии карточки.
  const swipe = useSwipeCard({
    enabled: Boolean(card),
    onSwipeRight: () => card && handleTake(card.word),
    onSwipeLeft: () => card && markKnown(card.word),
  });
  const swipeRightProgress = Math.max(0, Math.min(swipe.dragX / SWIPE_THRESHOLD, 1));
  const swipeLeftProgress = Math.max(0, Math.min(-swipe.dragX / SWIPE_THRESHOLD, 1));
  // Подсветка стороны, к которой тянут карточку: зелёный (Знаю) слева,
  // акцент (Взять) справа — чтобы было понятно действие ДО отпускания.
  const swipeGlow =
    swipe.dragX > 0
      ? `108, 140, 255` // Взять — акцент
      : `53, 200, 139`; // Знаю — зелёный
  const swipeGlowStrength = Math.max(swipeRightProgress, swipeLeftProgress);
  const cardStyle = {
    ...swipe.style,
    boxShadow: swipeGlowStrength
      ? `0 0 0 2px rgba(${swipeGlow}, ${swipeGlowStrength}), 0 12px 32px rgba(${swipeGlow}, ${swipeGlowStrength * 0.4})`
      : undefined,
  };

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
        <h1 className="cards__status-title">Не удалось сгенерировать</h1>
        <p className="cards__status-hint">{error}</p>
        <div className="cards__status-actions">
          <button type="button" className="cards__retry" onClick={onGenerate}>
            Повторить
          </button>
          <button type="button" className="cards__ghost" onClick={onClearError}>
            Назад
          </button>
        </div>
      </section>
    );
  }

  const total = cards.length;
  const learnedInBatch = cards.filter(
    (c) => takenWords.includes(c.word) || knownWords.includes(c.word),
  ).length;
  const remaining = total - learnedInBatch;

  const topbar = (
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
        onClick={onOpenStats}
        aria-label="Статистика"
      >
        📊
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
  );

  // Ежедневная сводка: ведём пользователя, а не заставляем решать самому.
  // Приоритет — повтору (закрепить выученное раньше, чем брать новое),
  // но выбор всегда за пользователем: ни то, ни другое не запускается само.
  const dailySummary =
    dueCount > 0 ? (
      <div className="cards__daily cards__daily--due">
        <div className="cards__daily-text">
          <p className="cards__daily-title">
            На сегодня: {dueCount}{" "}
            {pluralRu(dueCount, "слово", "слова", "слов")} повторить
          </p>
          <p className="cards__daily-hint">
            Сначала закрепим то, что уже учили
          </p>
        </div>
        <button
          type="button"
          className="cards__daily-cta"
          onClick={onOpenReview}
        >
          🔁 Повторить сейчас
        </button>
      </div>
    ) : (
      <div className="cards__daily cards__daily--clear">
        <p className="cards__daily-title">✅ На сегодня всё повторено</p>
        <p className="cards__daily-hint">
          Можешь взять новые слова, если есть настроение — торопиться некуда.
        </p>
      </div>
    );

  // Нет текущей карточки: либо порция ещё не сгенерирована, либо разобрана.
  if (empty || done) {
    return (
      <section className="cards">
        {topbar}
        {dailySummary}
        <div className="cards__center">
          {empty ? (
            <>
              <div className="cards__status-emoji" aria-hidden="true">
                🃏
              </div>
              <h1 className="cards__status-title">Пока нет карточек</h1>
              <p className="cards__status-hint">
                Нажмите «Сгенерировать новые карточки», чтобы получить порцию по
                вашей теме и уровню.
              </p>
            </>
          ) : (
            <>
              <div className="cards__status-emoji" aria-hidden="true">
                🎉
              </div>
              <h1 className="cards__status-title">Порция разобрана</h1>
              <p className="cards__status-hint">
                Взято на изучение — {takenWords.length}, отмечено «знаю» —{" "}
                {knownWords.length}. Сгенерируйте новую порцию.
              </p>
            </>
          )}
          <div className="cards__status-actions">
            <GenerateCountPicker
              value={generateCount}
              onChange={onChangeGenerateCount}
            />
            <button type="button" className="cards__retry" onClick={onGenerate}>
              🔄 Сгенерировать новые карточки
            </button>
            {!empty && (
              <button
                type="button"
                className="cards__ghost"
                onClick={onOpenMyWords}
              >
                📚 Мои слова
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="cards" aria-labelledby="card-word">
      {topbar}
      {dailySummary}

      <div className="cards__progressbar" aria-hidden="true">
        <span
          className="cards__progressbar-fill"
          style={{ width: `${(learnedInBatch / total) * 100}%` }}
        />
      </div>
      <p className="cards__remaining">Осталось в порции: {remaining}</p>

      {/* Подсказки направлений — НАД карточкой, вне зоны текста: без кнопок
          «Взять»/«Знаю» это единственный способ понять управление. Всегда
          видны приглушённо, при свайпе к своей стороне разгораются. */}
      <div className="cards__swipe-hints" aria-hidden="true">
        <span
          className="cards__swipe-hint cards__swipe-hint--know"
          style={{
            opacity: 0.55 + 0.45 * swipeLeftProgress,
            backgroundColor: `rgba(53, 200, 139, ${0.12 + 0.3 * swipeLeftProgress})`,
          }}
        >
          ← Знаю
        </span>
        <span
          className="cards__swipe-hint cards__swipe-hint--take"
          style={{
            opacity: 0.55 + 0.45 * swipeRightProgress,
            backgroundColor: `rgba(108, 140, 255, ${0.12 + 0.3 * swipeRightProgress})`,
          }}
        >
          Взять →
        </span>
      </div>

      <article
        className="cards__card"
        ref={swipe.cardRef}
        style={cardStyle}
      >
        <div className="cards__word-block">
          <h1 id="card-word" className="cards__word" lang={learnLang}>
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
          <p className="cards__example-text" lang={learnLang}>
            {card.example}
          </p>
          <p className="cards__example-translation">
            {card.exampleTranslation}
          </p>
        </div>
      </article>

      <div className="cards__actions">
        {limitNotice && (
          <p className="cards__limit-notice" role="status">
            ⚠️ Сначала повтори или выучи слова из активных — в изучении уже{" "}
            {MAX_ACTIVE_WORDS} слов.
          </p>
        )}
        <button
          type="button"
          className="cards__action cards__action--skip"
          onClick={() => skip(card.word)}
        >
          <span className="cards__action-main">
            <span className="cards__action-emoji" aria-hidden="true">
              ⏭️
            </span>
            Пропустить
          </span>
          <span className="cards__action-hint">вернётся позже</span>
        </button>
        <GenerateCountPicker
          value={generateCount}
          onChange={onChangeGenerateCount}
        />
        <button
          type="button"
          className="cards__generate"
          onClick={onGenerate}
        >
          🔄 Сгенерировать новые карточки
        </button>
      </div>
    </section>
  );
}
