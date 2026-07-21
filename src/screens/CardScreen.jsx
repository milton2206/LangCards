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

  // Свайп — ОСНОВНОЙ способ разобрать новое слово: вправо = Взять (в изучение),
  // влево = Знаю (навсегда). Три кнопки внизу дублируют жест теми же цветами.
  const swipe = useSwipeCard({
    enabled: Boolean(card),
    onSwipeRight: () => card && handleTake(card.word),
    onSwipeLeft: () => card && markKnown(card.word),
  });
  const swipeRightProgress = Math.max(0, Math.min(swipe.dragX / SWIPE_THRESHOLD, 1));
  const swipeLeftProgress = Math.max(0, Math.min(-swipe.dragX / SWIPE_THRESHOLD, 1));
  const swipeProgress = Math.max(swipeRightProgress, swipeLeftProgress);
  // Цвет действия совпадает с цветом кнопки: вправо = Взять = зелёный,
  // влево = Знаю = синий. Рамка окрашивается и разгорается по мере натяжения,
  // вокруг карточки — лёгкое свечение того же цвета. В покое — нейтрально.
  const TAKE_RGB = "53, 200, 139"; // зелёный
  const KNOW_RGB = "108, 140, 255"; // синий
  const swipeRgb = swipe.dragX > 0 ? TAKE_RGB : KNOW_RGB;
  const cardStyle = {
    ...swipe.style,
    borderColor: swipeProgress
      ? `rgba(${swipeRgb}, ${0.35 + 0.65 * swipeProgress})`
      : undefined,
    boxShadow: swipeProgress
      ? `0 0 ${10 + 26 * swipeProgress}px rgba(${swipeRgb}, ${0.5 * swipeProgress})`
      : undefined,
    // На отпускании плавно гасим цвет рамки и свечение (перемещение — своя анимация).
    transition: swipe.dragging
      ? "none"
      : "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
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
        Мои слова
        <span className="cards__badge">{takenWords.length}</span>
      </button>
      <div className="cards__topbar-actions">
        <button
          type="button"
          className="cards__icon-btn"
          onClick={onOpenStats}
          aria-label="Статистика"
        >
          <span className="cards__icon-btn-glyph" aria-hidden="true">
            📊
          </span>
        </button>
        <button
          type="button"
          className="cards__icon-btn"
          onClick={onOpenSettings}
          aria-label="Настройки"
        >
          <span className="cards__icon-btn-glyph" aria-hidden="true">
            ⚙️
          </span>
        </button>
      </div>
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
          Повторить сейчас
        </button>
      </div>
    ) : (
      <div className="cards__daily cards__daily--clear">
        <p className="cards__daily-title">На сегодня всё повторено</p>
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
              Сгенерировать новые карточки
            </button>
            {!empty && (
              <button
                type="button"
                className="cards__ghost"
                onClick={onOpenMyWords}
              >
                Мои слова
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

      {/* Чистая карточка: никаких наложений на текст. Подсказка жеста — это
          сама карточка (перелив рамки при свайпе + покачивание при входе).
          БЕЗ key: узел стабилен между свайпами внутри пачки, поэтому анимация
          покачивания НЕ повторяется на каждом слове. Она проигрывается только
          когда article реально (пере)монтируется — а это ровно «входные»
          моменты: заход/возврат на экран (монтаж CardScreen) и генерация новой
          пачки (article временно исчезает под экраном загрузки и монтируется
          заново). Листание свайпами перемонтажа не вызывает — второе и далее
          слова не качаются. */}
      <article
        className="cards__card cards__card--wiggle"
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
            Сначала повтори или выучи слова из активных — в изучении уже{" "}
            {MAX_ACTIVE_WORDS} слов.
          </p>
        )}
        {/* Три кнопки дублируют свайп. Цвета совпадают со стороной жеста:
            влево = Знаю (синий), вправо = Взять (зелёный), Пропустить —
            нейтральная. Порядок слева-направо повторяет направления свайпа. */}
        <div className="cards__swipe-buttons">
          <button
            type="button"
            className="cards__swipe-btn cards__swipe-btn--know"
            onClick={() => markKnown(card.word)}
          >
            Знаю
          </button>
          <button
            type="button"
            className="cards__swipe-btn cards__swipe-btn--skip"
            onClick={() => skip(card.word)}
          >
            Пропустить
          </button>
          <button
            type="button"
            className="cards__swipe-btn cards__swipe-btn--take"
            onClick={() => handleTake(card.word)}
          >
            Взять
          </button>
        </div>
        <GenerateCountPicker
          value={generateCount}
          onChange={onChangeGenerateCount}
        />
        <button
          type="button"
          className="cards__generate"
          onClick={onGenerate}
        >
          Сгенерировать новые карточки
        </button>
      </div>
    </section>
  );
}
