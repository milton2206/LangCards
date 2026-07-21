import { useEffect, useRef, useState } from "react";
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

  // Тестеры принимали статичные подсказки-«таблетки» над карточкой за кнопки
  // и пытались их нажать. Вместо этого один раз показываем физическое
  // покачивание САМОЙ карточки — так сразу понятно, что её можно двигать
  // пальцем. Срабатывает один раз за всё время (флаг в localStorage).
  //
  // «Годен ли показ» читаем ОДИН раз в ref ДО эффекта (не внутри него) —
  // иначе в React StrictMode (dev) эффект вызывается дважды подряд при
  // монтировании: первый вызов сам же выставляет флаг, второй вызов читает
  // уже выставленный им флаг и решает, что показывать не надо, а его же
  // таймер скрытия к этому моменту уже отменён cleanup'ом первого вызова —
  // подсказка застревает включённой навсегда. Ref со значением, вычисленным
  // до этой гонки, одинаков в обоих вызовах — гонки нет.
  const wiggleEligibleRef = useRef(null);
  if (wiggleEligibleRef.current === null) {
    try {
      wiggleEligibleRef.current = !localStorage.getItem("swipeWiggleSeen");
    } catch {
      wiggleEligibleRef.current = false;
    }
  }
  const [showWiggle, setShowWiggle] = useState(false);
  useEffect(() => {
    if (!card || !wiggleEligibleRef.current) return;
    setShowWiggle(true);
    const timer = setTimeout(() => setShowWiggle(false), 900);
    try {
      localStorage.setItem("swipeWiggleSeen", "1");
    } catch {
      // ignore
    }
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

      {/* Стрелки-«края» ПРЯМО НА карточке (не отдельные плашки-«кнопки» над
          ней) — читаются как «потяни край», а не «нажми». Всегда чуть видны,
          разгораются по мере того как тянешь в свою сторону. */}
      <article
        className={"cards__card" + (showWiggle ? " cards__card--wiggle" : "")}
        ref={swipe.cardRef}
        style={cardStyle}
      >
        <span
          className="cards__edge-arrow cards__edge-arrow--know"
          aria-hidden="true"
          style={{ opacity: 0.3 + 0.55 * swipeLeftProgress }}
        >
          ←
        </span>
        <span
          className="cards__edge-arrow cards__edge-arrow--take"
          aria-hidden="true"
          style={{ opacity: 0.3 + 0.55 * swipeRightProgress }}
        >
          →
        </span>

        {/* Штамп действия — виден ТОЛЬКО во время активного жеста (в покое
            его нет вообще), поэтому его невозможно принять за кнопку. */}
        {swipeGlowStrength > 0 && (
          <span
            className={
              "cards__drag-stamp " +
              (swipe.dragX > 0
                ? "cards__drag-stamp--take"
                : "cards__drag-stamp--know")
            }
            aria-hidden="true"
            style={{ opacity: swipeGlowStrength }}
          >
            {swipe.dragX > 0 ? "Взять" : "Знаю"}
          </span>
        )}

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

      {/* Инструкция текстом — не кнопка, просто подпись под карточкой. */}
      <p className="cards__swipe-caption">
        Смахни карточку: <strong>вправо</strong> — Взять,{" "}
        <strong>влево</strong> — Знаю
      </p>

      <div className="cards__actions">
        {limitNotice && (
          <p className="cards__limit-notice" role="status">
            Сначала повтори или выучи слова из активных — в изучении уже{" "}
            {MAX_ACTIVE_WORDS} слов.
          </p>
        )}
        <button
          type="button"
          className="cards__action cards__action--skip"
          onClick={() => skip(card.word)}
        >
          <span className="cards__action-main">Пропустить</span>
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
          Сгенерировать новые карточки
        </button>
      </div>
    </section>
  );
}
