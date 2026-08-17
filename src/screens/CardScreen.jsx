import { useEffect, useState } from "react";
import { pickCurrentCard, MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { useSwipeCard, SWIPE_THRESHOLD } from "../hooks/useSwipeCard.js";
import { GENERATE_COUNT_OPTIONS } from "../lib/generateCount.js";
import { useWordLookup } from "../hooks/useWordLookup.js";
import { apiErrorText } from "../lib/apiClient.js";
import {
  prewarmTts,
  isTtsQuotaExhausted,
  subscribeTtsQuota,
  PREWARM_CARDS,
} from "../lib/ttsClient.js";
import WordLookupSheet from "../components/WordLookupSheet.jsx";
import WordCard from "../components/WordCard.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import LanguageSwitcher from "../components/LanguageSwitcher.jsx";
import DailyBalance from "../components/DailyBalance.jsx";
import WeekSchedule from "../components/WeekSchedule.jsx";
import Icon from "../components/icons/Icon.jsx";
import { LANG_EMOJI } from "../data/onboarding.js";
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

// Вторичные действия (что генерировать и куда ещё сходить) — ОДИН список на два
// места, чтобы они не разъезжались. Под карточкой он спрятан в «Ещё»: для
// решения «знаю / беру» он не нужен и только уводит глаза. На пустом экране и
// после разбора порции показывается сразу — там это и есть главное действие,
// поэтому там же кнопка генерации акцентная (primaryGenerate).
function SecondaryActions({
  generateMode,
  onChangeGenerateMode,
  generateCount,
  onChangeGenerateCount,
  onGenerate,
  onGenerateRandom,
  onOpenAddWord,
  onOpenReading,
  onOpenListening,
  onOpenQuiz,
  // Порог теста виден: пока своих слов меньше нужного, кнопка не прячется, а
  // честно говорит, сколько осталось (см. quiz.lockedShort).
  quizPoolSize = 0,
  quizMinWords = 0,
  primaryGenerate = false,
  // Сколько мест свободно и хватает ли их на целую порцию. Генерация запускается
  // ТОЛЬКО когда порция поместится целиком: иначе часть карточек пропала бы, а
  // деньги за них уже потрачены. Добрать из готовой колоды можно и при одном
  // свободном месте — это ничего не стоит.
  freeSlots = Infinity,
  roomForBatch = true,
}) {
  const { t, tp } = useI18n();
  // Слов хватает на тест? Порог общий с самим режимом (см. lib/quizEngine.js) —
  // здесь только показ.
  const quizReady = quizPoolSize >= quizMinWords;
  return (
    <>
      <GenerateModePicker value={generateMode} onChange={onChangeGenerateMode} />
      <GenerateCountPicker
        value={generateCount}
        onChange={onChangeGenerateCount}
        label={t("cards.countLabel")}
      />
      <button
        type="button"
        className={primaryGenerate ? "cards__retry" : "cards__generate"}
        onClick={onGenerate}
        disabled={!roomForBatch}
      >
        {t("cards.generate")}
      </button>
      <button
        type="button"
        className="cards__surprise"
        onClick={onGenerateRandom}
        disabled={!roomForBatch}
      >
        🎲 {t("cards.surprise")}
      </button>
      {/* Почему генерация недоступна — прямо под кнопками, с обоими числами. */}
      {!roomForBatch && (
        <p className="cards__slots cards__slots--why" role="status">
          {t("cards.needRoomForBatch", { need: generateCount, free: freeSlots })}
        </p>
      )}
      <button type="button" className="cards__generate" onClick={onOpenAddWord}>
        ➕ {t("addWord.entry")}
      </button>
      <button type="button" className="cards__generate" onClick={onOpenReading}>
        📖 {t("reading.entry")}
      </button>
      {/* Ещё один способ позаниматься сегодняшним языком (фаза 6.2) */}
      <button type="button" className="cards__generate" onClick={onOpenListening}>
        🎧 {t("listening.entry")}
      </button>
      {/* Тест с вариантами ответа — отдельный режим, вне занятия и вне
          расписания. Живёт здесь, среди прочих «чем ещё заняться»: он ничего не
          записывает и в план дня не входит. */}
      <button
        type="button"
        className="cards__generate"
        onClick={onOpenQuiz}
        disabled={!quizReady}
      >
        🎯 {t("quiz.entry")}
      </button>
      {!quizReady && (
        <p className="cards__slots cards__slots--why" role="status">
          {t("quiz.lockedShort", {
            n: quizMinWords - quizPoolSize,
            word: tp("plural.words", quizMinWords - quizPoolSize),
          })}
        </p>
      )}
    </>
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
  // Пачка пришла меньше запрошенной: { got, asked } — спокойная пометка, а не
  // ошибка. Раньше карточки просто молча не доходили, и это выглядело поломкой.
  shortfall = null,
  learnLang,
  nativeLang,
  // Уровень пользователя — только для просмотра слова/оборота из примера
  // (перевод под уровень). На саму генерацию карточек здесь не влияет.
  level,
  languages,
  multiLangMode,
  activeLanguage,
  onSwitchLanguage,
  dailyBalance,
  // Мягкая дневная норма новых слов: { taken, quota, reached }. Только отметка
  // рядом со счётчиком — поток карточек она НЕ останавливает и ничего не
  // спрашивает. Жёсткий лимит активных слов — отдельно (vocab.atActiveLimit).
  dailyNorm = null,
  weekSchedule,
  restDay,
  dueCount,
  generateCount,
  onChangeGenerateCount,
  generateMode,
  onChangeGenerateMode,
  onGenerate,
  onGenerateRandom,
  onRetryGenerate,
  onClearError,
  onOpenSettings,
  onOpenMyWords,
  onOpenAddWord,
  onOpenReading,
  onOpenListening,
  onAddWordFromExample,
  // Тест с вариантами ответа (отдельный режим) + его видимый порог открытия.
  onOpenQuiz,
  quizPoolSize = 0,
  quizMinWords = 0,
  onOpenReview,
  onOpenStats,
  onOpenTutorial,
  // Движок заданий (необязательно): возврат к плану занятия и баннер блока
  // «новые слова». Без них экран работает как обычный ручной хаб.
  onExitSession,
  sessionNewBlock = false,
  sessionNewTarget = 0,
  // Акцент дня «новые слова» → случайные слова / «Удиви меня»: меняем подсказку.
  sessionRandom = false,
}) {
  const { t, tp } = useI18n();
  const { takenWords, knownWords, take, skip, markKnown, rememberCards } = vocab;

  // Место под активные слова считает слой данных (см. useWordLists), экран
  // только показывает. Два разных состояния:
  //   мест нет вовсе      — «Взять» недоступно, карточка под замком;
  //   мест меньше порции  — брать из колоды можно, генерировать новую нельзя.
  const freeSlots = vocab.freeSlots;
  const noRoom = vocab.atActiveLimit;
  const roomForBatch = freeSlots >= generateCount;

  // Суточная квота озвучки кончилась (общее состояние приложения, ставит его
  // первый же ответ 429). Кнопки play гаснут сами, а экран говорит об этом
  // словами — раньше озвучка просто молча переставала работать.
  const [ttsQuotaOut, setTtsQuotaOut] = useState(isTtsQuotaExhausted);
  useEffect(() => subscribeTtsQuota(setTtsQuotaOut), []);

  // Объяснение, почему «Взять» не сработало. Показывается плашкой ПОД карточкой
  // (не тостом): текст длинный, и в нём есть выход, а не только запрет.
  const [limitNotice, setLimitNotice] = useState(false);
  useEffect(() => {
    if (!limitNotice) return;
    const timer = setTimeout(() => setLimitNotice(false), 8000);
    return () => clearTimeout(timer);
  }, [limitNotice]);
  // Сменилась карточка или освободилось место — объяснение больше не к месту.
  useEffect(() => {
    setLimitNotice(false);
  }, [freeSlots]);

  // «Ещё» под карточкой — по умолчанию закрыто: на экране одно решение, всё
  // остальное открывается по запросу.
  const [moreOpen, setMoreOpen] = useState(false);

  function handleTake(word) {
    const ok = take(word);
    if (!ok) setLimitNotice(true);
  }

  // Просмотр слова из примера (идея Димы): тап по слову → ИИ даёт перевод и
  // полную карточку → можно сразу добавить слово в изучение. Логика и шторка
  // общие с режимом чтения (фаза 6.1) — см. useWordLookup/WordLookupSheet.
  const lookup = useWordLookup({
    learnLang,
    nativeLang,
    level,
    onAdd: onAddWordFromExample,
    // Для проверки «такой оборот уже взят» при взятии выделенной фразы.
    takenWords: vocab.takenWords,
    // Свои карточки: тап по знакомому слову открывается без запроса к модели.
    wordInfo: vocab.wordInfo,
  });

  // Запоминаем данные показанных карточек для экранов «Мои слова»/«Известные».
  useEffect(() => {
    if (cards.length) rememberCards(cards);
  }, [cards, rememberCards]);

  // pickCurrentCard/swipe вызываются ДО ранних return (loading/error) —
  // хуки должны отрабатывать в одном порядке на каждый рендер.
  const { card, done } = pickCurrentCard(cards, vocab);
  const empty = cards.length === 0;

  // Ленивый прогрев озвучки: греем окно вокруг ТЕКУЩЕЙ карточки, а не всю
  // порцию. Порцию редко разбирают за один заход, и прогрев дальних карточек
  // уходил в никуда, тратя общую суточную квоту. Повторный прогрев уже
  // подогретого бесплатен — URL лежит в памяти клиента.
  useEffect(() => {
    if (!card?.word || !learnLang) return;
    const from = cards.findIndex((c) => c.word === card.word);
    if (from < 0) return;
    prewarmTts(cards.slice(from, from + PREWARM_CARDS), learnLang);
  }, [card?.word, cards, learnLang]);

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
  // Цвет действия совпадает с цветом кнопки (Ember): вправо = Взять = оливковый,
  // влево = Знаю = терракота. Рамка окрашивается и разгорается по мере натяжения,
  // вокруг карточки — лёгкое свечение того же цвета. В покое — нейтрально.
  // Триплеты берём из токенов темы (var(--ember-*-rgb)) — свечение следует за
  // активной темой (тёмная/светлая) без правок здесь.
  const swipeRgb =
    swipe.dragX > 0 ? "var(--ember-take-rgb)" : "var(--ember-know-rgb)";
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

  // Сменилась карточка (взял/знаю/пропустил) — возвращаем прокрутку в начало.
  // После разгрузки экрана карточка помещается целиком, так что это страховка:
  // если человек раскрывал «Ещё» и уехал вниз, следующее слово он всё равно
  // встретит сверху, а не серединой экрана. Без анимации — переход мгновенный.
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [card?.word]);

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
    // error: { code, params?, raw? }. Показываем ТОЛЬКО локализованный текст:
    // серверная строка (raw) написана по-русски и в другом интерфейсе выглядела
    // бы чужой — она остаётся в объекте для отладки.
    //
    // «Новых слов не нашлось» — НЕ сбой: модель отработала, но всё, что она
    // предложила, человек уже знает. Заголовок «Не удалось сгенерировать» тут
    // врал бы и толкал жать «Повторить» до бесконечности, поэтому случай
    // разведён отдельно (сбой сервера/сети остаётся с прежним текстом).
    const noNewWords = error.code === "noNewWords";
    const errorText = apiErrorText(error, t, "errors.generateFailed");
    return (
      <section className="cards cards--status cards--error">
        <div className="cards__status-badge" aria-hidden="true">
          <Icon name="alert" size={30} />
        </div>
        <h1 className="cards__status-title">
          {t(noNewWords ? "errors.noNewWordsTitle" : "errors.title")}
        </h1>
        <p className="cards__status-hint">{errorText}</p>
        <div className="cards__status-actions">
          {/* Повторяем именно упавшую генерацию (обычную или «Удиви меня») —
              App помнит тип последней попытки. */}
          <button
            type="button"
            className="cards__retry"
            onClick={onRetryGenerate}
          >
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
        {/* Возврат к плану занятия — компактная иконка (чтобы верхний ряд
            помещался по ширине экрана и без движка тоже). */}
        {onExitSession && (
          <button
            type="button"
            className="cards__icon-btn cards__session-back"
            onClick={onExitSession}
            aria-label={t("session.backToSession")}
          >
            <span className="cards__icon-btn-glyph" aria-hidden="true">
              ←
            </span>
          </button>
        )}
        <button
          type="button"
          className="cards__mywords"
          onClick={onOpenMyWords}
        >
          <span className="cards__mywords-label">{t("cards.myWords")}</span>
          <span className="cards__badge">{takenWords.length}</span>
        </button>
      <div className="cards__topbar-actions">
        {/* Переключатель языковой пары — ТОЛЬКО при multiLangMode=true.
            В одноязычном режиме его нет вообще — интерфейс как раньше. */}
        {multiLangMode && languages?.length > 0 && (
          <LanguageSwitcher
            languages={languages}
            activeLanguage={activeLanguage}
            onSwitch={onSwitchLanguage}
            appearance="ember"
          />
        )}
        <button
          type="button"
          className="cards__icon-btn"
          onClick={onOpenStats}
          aria-label={t("cards.statsAria")}
        >
          <Icon name="stats" size={20} />
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
          <Icon name="settings" size={20} />
        </button>
      </div>
      </header>
  );

  // Баннер блока «новые слова» из движка заданий: подсказка объёма + выход к
  // плану. Пока в руках карточка, его НЕ показываем — там решается «знаю/беру»,
  // а к плану всегда можно вернуться стрелкой в верхней панели.
  const sessionBanner = sessionNewBlock ? (
        <div className="cards__session-banner">
          <div className="cards__session-banner-text">
            <p className="cards__session-banner-title">
              {t(sessionRandom ? "session.newBlockRandomTitle" : "session.newBlockTitle")}
            </p>
            <p className="cards__session-banner-hint">
              {t(sessionRandom ? "session.newBlockRandomHint" : "session.newBlockHint", {
                n: sessionNewTarget,
              })}
            </p>
          </div>
          <button
            type="button"
            className="cards__session-done"
            onClick={onExitSession}
          >
            {t("session.blockDone")}
          </button>
        </div>
  ) : null;

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

  // Разбивка дневной нормы по языкам — только мультирежим + scheduleMode='mixed'
  // (App передаёт null в остальных случаях: один язык — делить нечего, а при
  // 'by_day' вместо неё показывается обзор недели).
  const balanceStrip = dailyBalance ? (
    <DailyBalance
      items={dailyBalance}
      activePairKey={
        activeLanguage
          ? `${activeLanguage.learnLang}-${activeLanguage.nativeLang}`
          : ""
      }
      onSwitch={onSwitchLanguage}
    />
  ) : null;

  // Обзор недельного расписания (фаза 4.5) — только мультирежим + 'by_day'.
  const weekStrip = weekSchedule ? (
    <WeekSchedule schedule={weekSchedule} appearance="ember" />
  ) : null;

  // Дневная норма новых слов выбрана — спокойная ОТМЕТКА рядом со счётчиком,
  // а не остановка: карточки идут дальше, брать можно без подтверждений и без
  // кнопки-обхода. Норма — ориентир, а не запрет (запрет — только лимит
  // активных слов, у него и текст другой).
  // Недобор: карточек пришло меньше, чем просили. Раньше они просто молча не
  // доходили — человек видел пачку из двух-трёх и решал, что приложение сломано.
  const shortNote = shortfall ? (
    <p className="cards__short-note" role="status">
      {t("cards.shortBatch", {
        got: shortfall.got,
        asked: shortfall.asked,
      })}
    </p>
  ) : null;

  const quotaNote = dailyNorm?.reached ? (
    <p className="cards__quota-note" role="status">
      <span className="cards__quota-check" aria-hidden="true">
        ✓
      </span>{" "}
      {t("balance.normMet", {
        taken: dailyNorm.taken,
        quota: dailyNorm.quota,
      })}
    </p>
  ) : null;

  // Неучебный день по расписанию: не блокируем — показываем отдых, повторения
  // (они идут всегда — кнопка в сводке и здесь) и «Позаниматься всё равно»
  // с выбором языка (выбор ставит дневной override в App).
  if (restDay) {
    return (
      <section className="cards">
        {topbar}
        {sessionBanner}
        {dailySummary}
        {weekStrip}
        <div className="cards__center">
          <div className="cards__status-emoji" aria-hidden="true">
            😴
          </div>
          <h1 className="cards__status-title">{t("schedule.restTitle")}</h1>
          <p className="cards__status-hint">{t("schedule.restHint")}</p>
          <div className="cards__status-actions">
            {dueCount > 0 && (
              <button
                type="button"
                className="cards__retry"
                onClick={onOpenReview}
              >
                {t("cards.reviewNow")}
              </button>
            )}
            <p className="cards__rest-label">{t("schedule.studyAnyway")}</p>
            <div className="cards__rest-langs">
              {(languages || []).map((l) => (
                <button
                  key={`${l.learnLang}-${l.nativeLang}`}
                  type="button"
                  className="cards__rest-lang"
                  onClick={() =>
                    onSwitchLanguage({
                      learnLang: l.learnLang,
                      nativeLang: l.nativeLang,
                    })
                  }
                >
                  <span aria-hidden="true">
                    {LANG_EMOJI[l.learnLang] || "🌐"}
                  </span>{" "}
                  {t(`lang.${l.learnLang}`)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // Нет текущей карточки: либо порция ещё не сгенерирована, либо разобрана.
  if (empty || done) {
    return (
      <section className="cards">
        {topbar}
        {sessionBanner}
        {dailySummary}
        {balanceStrip}
        {weekStrip}
        {shortNote}
        {quotaNote}
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
          {/* Здесь вторичные действия — не «ещё», а единственное, что можно
              сделать: показываем раскрытыми и с акцентной кнопкой генерации. */}
          <div className="cards__status-actions">
            <SecondaryActions
              generateMode={generateMode}
              onChangeGenerateMode={onChangeGenerateMode}
              generateCount={generateCount}
              onChangeGenerateCount={onChangeGenerateCount}
              onGenerate={onGenerate}
              onGenerateRandom={onGenerateRandom}
              onOpenAddWord={onOpenAddWord}
              onOpenReading={onOpenReading}
              onOpenListening={onOpenListening}
              freeSlots={freeSlots}
              roomForBatch={roomForBatch}
              onOpenQuiz={onOpenQuiz}
              quizPoolSize={quizPoolSize}
              quizMinWords={quizMinWords}
              primaryGenerate
            />
          </div>
        </div>
      </section>
    );
  }

  return (
    // Пока в руках карточка — на экране одно решение. Баннеры занятия и
    // ежедневная сводка (в т.ч. «Повторить сейчас»), разбивка нормы по языкам и
    // обзор недели сюда не идут: для «знаю/беру» они не нужны, а места занимают
    // столько, что карточка переставала помещаться в экран телефона. Их место —
    // на экране занятия и в состоянии «порция разобрана».
    <section className="cards" aria-labelledby="card-word">
      {topbar}

      <div className="cards__progressbar" aria-hidden="true">
        <span
          className="cards__progressbar-fill"
          style={{ width: `${(learnedInBatch / total) * 100}%` }}
        />
      </div>
      <p className="cards__remaining">
        {t("cards.remaining", { n: remaining })}
      </p>
      {shortNote}
      {quotaNote}

      {/* Чистая карточка: никаких наложений на текст. Подсказка жеста — это
          сама карточка (перелив рамки при свайпе + покачивание при входе).
          БЕЗ key: узел стабилен между свайпами внутри пачки, поэтому анимация
          покачивания НЕ повторяется на каждом слове. Она проигрывается только
          когда article реально (пере)монтируется — а это ровно «входные»
          моменты: заход/возврат на экран (монтаж CardScreen) и генерация новой
          пачки (article временно исчезает под экраном загрузки и монтируется
          заново). Листание свайпами перемонтажа не вызывает — второе и далее
          слова не качаются. */}
      {/* Мест нет — карточка приглушена и с замком: видно, что разбирать её
          сейчас можно только в «Знаю»/«Пропустить». */}
      <div className={"cards__card-wrap" + (noRoom ? " is-locked" : "")}>
        <WordCard
          card={card}
          learnLang={learnLang}
          nativeLang={nativeLang}
          onWordTap={lookup.open}
          lookupSpan={lookup.lookup?.span || null}
          innerRef={swipe.cardRef}
          style={cardStyle}
          className="cards__card--wiggle"
        />
        {noRoom && (
          <span className="cards__lock" aria-hidden="true">
            <Icon name="lock" size={18} />
          </span>
        )}
      </div>

      {/* Объяснение к заблокированному «Взять» — плашкой под карточкой, а не
          тостом: текст длинный и заканчивается выходом, а не запретом. */}
      {limitNotice && (
        <p className="cards__limit-notice" role="status">
          {t("common.activeLimit", { max: MAX_ACTIVE_WORDS })}
        </p>
      )}

      {/* Озвучка на сегодня кончилась — спокойная подпись под карточкой, ровно
          там, где стоят погасшие кнопки play. Не окно и не преграда: карточки,
          свайпы и всё занятие работают как обычно. */}
      {ttsQuotaOut && (
        <p className="cards__tts-quota" role="status">
          {t("tts.quotaOutHint")}
        </p>
      )}

      {/* Состояние мест под колодой. Ноль — «мест нет»; меньше порции —
          объясняем, что добрать из колоды можно, а новую порцию пока нет. */}
      {noRoom ? (
        <p className="cards__slots cards__slots--full">
          {t("cards.slotsFull", { max: MAX_ACTIVE_WORDS })}
        </p>
      ) : !roomForBatch ? (
        <p className="cards__slots">
          {t("cards.slotsFew", { free: freeSlots })}
        </p>
      ) : null}

      {/* Всё, что не нужно для решения «знаю / беру», — под одной свёрнутой
          строкой «Ещё». Прокручивается вместе с контентом (у подписей нет фона,
          над контентом они бы не читались); нижний отступ = высота плавающей
          панели кнопок + запас, чтобы последняя строка не пряталась под ней. */}
      <div className="cards__actions">
        <button
          type="button"
          className={"cards__more-btn" + (moreOpen ? " is-open" : "")}
          onClick={() => setMoreOpen((v) => !v)}
          aria-expanded={moreOpen}
        >
          {t("cards.more")}
          <Icon name="chevron" size={16} className="cards__more-chevron" />
        </button>
        {moreOpen && (
          <div className="cards__more-body">
            <SecondaryActions
              generateMode={generateMode}
              onChangeGenerateMode={onChangeGenerateMode}
              generateCount={generateCount}
              onChangeGenerateCount={onChangeGenerateCount}
              onGenerate={onGenerate}
              onGenerateRandom={onGenerateRandom}
              onOpenAddWord={onOpenAddWord}
              onOpenReading={onOpenReading}
              onOpenListening={onOpenListening}
              freeSlots={freeSlots}
              roomForBatch={roomForBatch}
              onOpenQuiz={onOpenQuiz}
              quizPoolSize={quizPoolSize}
              quizMinWords={quizMinWords}
            />
          </div>
        )}
      </div>

      {/* Плавающая панель основных действий: закреплена внизу. Фон панели
          ПРОЗРАЧНЫЙ — залиты только сами кнопки (каждая со своим непрозрачным
          фоном и тенью для читаемости над проезжающим контентом). Прозрачные
          зоны пропускают тач/скролл к контенту под ними. */}
      <div className="cards__actionbar">
        {/* Две кнопки дублируют свайп — ровно то самое решение. Цвета совпадают
            со стороной жеста: влево = Знаю (терракота), вправо = Взять
            (оливковый), порядок слева-направо повторяет направления свайпа.
            «Знаю» работает и при полном лимите: она слот не занимает. */}
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
            className="cards__swipe-btn cards__swipe-btn--take"
            onClick={() => handleTake(card.word)}
            disabled={noRoom}
          >
            {t("action.take")}
          </button>
        </div>
        {/* «Пропустить» — это «не сейчас», а не решение о слове: нужно, когда
            упёрся в лимит активных слов. Оставляем мелкой ссылкой под кнопками,
            чтобы не выглядело третьим равноправным выбором. */}
        <button
          type="button"
          className="cards__skip-link"
          onClick={() => skip(card.word)}
        >
          {t("action.skip")}
        </button>
      </div>

      {/* Шторка просмотра слова — общая с режимом чтения (фаза 6.1), вместе со
          стрелками расширения до оборота: границей служит предложение примера. */}
      <WordLookupSheet
        lookup={lookup.lookup}
        learnLang={learnLang}
        nativeLang={nativeLang}
        onAdd={lookup.add}
        onConfirmAdd={lookup.confirmAdd}
        onCancelAdd={lookup.cancelAdd}
        onExtend={lookup.extend}
        onReset={lookup.reset}
        onClose={lookup.close}
      />
    </section>
  );
}
