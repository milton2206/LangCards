import { useEffect, useState } from "react";
import { pickCurrentCard, MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { useSwipeCard, SWIPE_THRESHOLD } from "../hooks/useSwipeCard.js";
import { GENERATE_COUNT_OPTIONS } from "../lib/generateCount.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./CardScreen.css";

// Переключатель «сколько карточек генерировать за раз» (5/10/20) — рядом с
// кнопкой генерации в обоих местах, где она встречается на этом экране.
function GenerateCountPicker({ value, onChange, label }) {
  return (
    <div className="cards__count-picker">
      <span className="cards__count-label">{label}</span>
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

// Переключатель типа контента: обычные слова или «Контекст носителей»
// (идиомы и живые фразы). Рядом с кнопкой генерации, как и выбор количества.
function GenerateModePicker({ value, onChange }) {
  const { t } = useI18n();
  const modes = [
    { id: "words", label: t("cards.modeWords") },
    { id: "idioms", label: t("cards.modeIdioms") },
  ];
  return (
    <div className="cards__mode-picker">
      <span className="cards__count-label">{t("cards.modeLabel")}</span>
      <div className="cards__mode-options" role="group">
        {modes.map((m) => (
          <button
            key={m.id}
            type="button"
            className={"cards__mode-chip" + (value === m.id ? " is-active" : "")}
            aria-pressed={value === m.id}
            onClick={() => onChange(m.id)}
          >
            {m.label}
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
  generateMode,
  onChangeGenerateMode,
  onGenerate,
  onGenerateRandom,
  onClearError,
  onOpenSettings,
  onOpenMyWords,
  onOpenReview,
  onOpenStats,
  onOpenTutorial,
}) {
  const { t, tp } = useI18n();
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
        <h1 className="cards__status-title">{t("cards.loadingTitle")}</h1>
        <p className="cards__status-hint">{t("cards.loadingHint")}</p>
      </section>
    );
  }

  if (error) {
    // error: { code, params?, raw? } — raw уже локализован сервером.
    const errorText = error.raw
      ? error.raw
      : t(`errors.${error.code}`, error.params);
    return (
      <section className="cards cards--status">
        <div className="cards__status-emoji" aria-hidden="true">
          ⚠️
        </div>
        <h1 className="cards__status-title">{t("errors.title")}</h1>
        <p className="cards__status-hint">{errorText}</p>
        <div className="cards__status-actions">
          <button type="button" className="cards__retry" onClick={onGenerate}>
            {t("common.retry")}
          </button>
          <button type="button" className="cards__ghost" onClick={onClearError}>
            {t("common.back")}
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
        {t("cards.myWords")}
        <span className="cards__badge">{takenWords.length}</span>
      </button>
      <div className="cards__topbar-actions">
        <button
          type="button"
          className="cards__icon-btn"
          onClick={onOpenStats}
          aria-label={t("cards.statsAria")}
        >
          <span className="cards__icon-btn-glyph" aria-hidden="true">
            📊
          </span>
        </button>
        {/* Ненавязчивый доступ к туториалу — простой знак вопроса (не эмодзи),
            рядом с настройками. Автопоказ туториала — только при первом
            запуске; отсюда его можно пересмотреть в любой момент. */}
        <button
          type="button"
          className="cards__icon-btn"
          onClick={onOpenTutorial}
          aria-label={t("cards.tutorialAria")}
        >
          <span
            className="cards__icon-btn-glyph cards__icon-btn-glyph--help"
            aria-hidden="true"
          >
            ?
          </span>
        </button>
        <button
          type="button"
          className="cards__icon-btn"
          onClick={onOpenSettings}
          aria-label={t("cards.settingsAria")}
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
            {t("cards.dueTitle", {
              n: dueCount,
              word: tp("plural.words", dueCount),
            })}
          </p>
          <p className="cards__daily-hint">{t("cards.dueHint")}</p>
        </div>
        <button
          type="button"
          className="cards__daily-cta"
          onClick={onOpenReview}
        >
          {t("cards.reviewNow")}
        </button>
      </div>
    ) : (
      <div className="cards__daily cards__daily--clear">
        <p className="cards__daily-title">{t("cards.allReviewed")}</p>
        <p className="cards__daily-hint">{t("cards.allReviewedHint")}</p>
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
              <h1 className="cards__status-title">{t("cards.emptyTitle")}</h1>
              <p className="cards__status-hint">{t("cards.emptyHint")}</p>
            </>
          ) : (
            <>
              <div className="cards__status-emoji" aria-hidden="true">
                🎉
              </div>
              <h1 className="cards__status-title">{t("cards.doneTitle")}</h1>
              <p className="cards__status-hint">
                {t("cards.doneHint", {
                  taken: takenWords.length,
                  known: knownWords.length,
                })}
              </p>
            </>
          )}
          <div className="cards__status-actions">
            <GenerateModePicker
              value={generateMode}
              onChange={onChangeGenerateMode}
            />
            <GenerateCountPicker
              value={generateCount}
              onChange={onChangeGenerateCount}
              label={t("cards.countLabel")}
            />
            <button type="button" className="cards__retry" onClick={onGenerate}>
              {t("cards.generate")}
            </button>
            <button
              type="button"
              className="cards__surprise"
              onClick={onGenerateRandom}
            >
              🎲 {t("cards.surprise")}
            </button>
            {!empty && (
              <button
                type="button"
                className="cards__ghost"
                onClick={onOpenMyWords}
              >
                {t("cards.myWords")}
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
      <p className="cards__remaining">
        {t("cards.remaining", { n: remaining })}
      </p>

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
          {/* «Контекст носителей»: короткий ярлык стиля/регистра над выражением
              (сленг / вежливо / устарело …). У обычных слов поле пустое. */}
          {card.register && (
            <span className="cards__register">{card.register}</span>
          )}
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
          <span className="cards__example-label">{t("cards.example")}</span>
          <p className="cards__example-text" lang={learnLang}>
            {card.example}
          </p>
          <p className="cards__example-translation">
            {card.exampleTranslation}
          </p>
        </div>

        {/* «Контекст носителей»: пометка об уместности/регистре выражения.
            У обычных слов поле пустое — блок не показывается. */}
        {card.note && (
          <div className="cards__note">
            <span className="cards__note-label">{t("cards.usageNote")}</span>
            <p className="cards__note-text">{card.note}</p>
          </div>
        )}
      </article>

      <div className="cards__actions">
        {limitNotice && (
          <p className="cards__limit-notice" role="status">
            {t("common.activeLimit", { max: MAX_ACTIVE_WORDS })}
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
            {t("action.know")}
          </button>
          <button
            type="button"
            className="cards__swipe-btn cards__swipe-btn--skip"
            onClick={() => skip(card.word)}
          >
            {t("action.skip")}
          </button>
          <button
            type="button"
            className="cards__swipe-btn cards__swipe-btn--take"
            onClick={() => handleTake(card.word)}
          >
            {t("action.take")}
          </button>
        </div>
        <GenerateModePicker
          value={generateMode}
          onChange={onChangeGenerateMode}
        />
        <GenerateCountPicker
          value={generateCount}
          onChange={onChangeGenerateCount}
          label={t("cards.countLabel")}
        />
        <button
          type="button"
          className="cards__generate"
          onClick={onGenerate}
        >
          {t("cards.generate")}
        </button>
        <button
          type="button"
          className="cards__surprise"
          onClick={onGenerateRandom}
        >
          🎲 {t("cards.surprise")}
        </button>
      </div>
    </section>
  );
}
