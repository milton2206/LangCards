import { useEffect, useState, useMemo } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { useSwipeCard, SWIPE_THRESHOLD } from "../hooks/useSwipeCard.js";
import WordCard from "./WordCard.jsx";
import WordLookupSheet from "./WordLookupSheet.jsx";
import PlayButton from "./PlayButton.jsx";
import Icon from "./icons/Icon.jsx";
import { splitWords } from "../lib/highlightWord.js";
import "./Tutorial.css";

// ============================================================================
// Туториал (онбординг) — оформление Ember, РЕАЛЬНЫЕ компоненты в демо-режиме.
// ----------------------------------------------------------------------------
// Два уровня: "short" — короткое знакомство при первом входе (4 экрана по
// макетам), "detailed" — подробный разбор по группам (из настроек и с 4-го
// экрана). Демо-карточка/пример/свайп/всплывашка — это НАСТОЯЩИЕ компоненты
// приложения (WordCard, WordLookupSheet, useSwipeCard), только в «песочнице»:
// действия НЕ пишутся в прогресс/SRS. Контент демо — фиксированный греческий
// пример (как на макетах), перевод — на языке интерфейса (nativeLang).
// ============================================================================

// Демо-язык примеров — греческий (как на макетах), независимо от реальной пары
// пользователя: туториал показывает механику, а не его конкретный контент.
const DEMO_LEARN = "el";
const DEMO_EXAMPLE = "Ανοίγω το παράθυρο κάθε πρωί.";

// Короткая версия — 4 экрана (по макетам).
const SHORT_STEPS = [
  { id: "welcome", kind: "welcome", icon: "reading" },
  { id: "examples", kind: "lookup", tryIt: true },
  { id: "swipe", kind: "swipe", tryIt: true },
  { id: "sessionReady", kind: "session" },
];

// Подробная версия — по группам. Где функция самодостаточна (карточка, свайп,
// всплывашка, оценки, занятие) — реальный компонент; где это целый экран
// (чтение/аудирование/языки/уровень/установка) — разбор с реальными линейными
// иконками и пунктами.
const DETAILED_STEPS = [
  { id: "d_swipe", kind: "swipe", group: "cards", tryIt: true },
  { id: "d_lookup", kind: "lookup", group: "cards", tryIt: true },
  { id: "d_cardExtras", kind: "info", group: "cards", icon: "grammar", points: 3 },
  { id: "d_review", kind: "grades", group: "review" },
  { id: "d_session", kind: "session", group: "session" },
  { id: "d_reading", kind: "info", group: "reading", icon: "reading", points: 3 },
  { id: "d_listening", kind: "info", group: "listening", icon: "listening", points: 3 },
  { id: "d_languages", kind: "info", group: "languages", icon: "languages", points: 2 },
  { id: "d_level", kind: "info", group: "level", icon: "target", points: 2 },
  { id: "d_install", kind: "info", group: "install", icon: "download", points: 3 },
];

// Оценки повторения — те же смысловые цвета Ember, что на экране повторения.
const GRADES = ["again", "hard", "good", "easy"];

/**
 * @param {"short"|"detailed"} mode
 * @param {() => void} onClose         — закрыть туториал (флаг «просмотрено»).
 * @param {() => void} onOpenDetailed  — переключиться на подробный (с 4-го экрана).
 * @param {() => void} onStartSession  — «Начать занятие» (закрыть → к занятию).
 * @param {string} nativeLang          — язык интерфейса (для перевода демо).
 */
export default function Tutorial({
  mode = "short",
  onClose,
  onOpenDetailed,
  onStartSession,
  nativeLang = "ru",
}) {
  const { t } = useI18n();
  const steps = mode === "detailed" ? DETAILED_STEPS : SHORT_STEPS;

  const [index, setIndex] = useState(0);
  const step = steps[index];
  const isLast = index === steps.length - 1;

  // Демо-карточка: перевод/пример — на языке интерфейса (nativeLang), слово и
  // пример на изучаемом (греческий) фиксированы.
  const demoCard = useMemo(
    () => ({
      word: "το παράθυρο",
      translit: t("tutorial.demo.translit"),
      translation: t("tutorial.demo.translation"),
      example: DEMO_EXAMPLE,
      exampleTranslation: t("tutorial.demo.exampleTranslation"),
    }),
    [t],
  );

  // Всплывашка перевода — РЕАЛЬНЫЙ WordLookupSheet, но кормим готовыми демо-
  // данными (мгновенно, офлайн, без записи в SRS). Перевод слова — из демо-
  // глоссария на языке интерфейса.
  const [demoLookup, setDemoLookup] = useState(null);
  function openDemoLookup(word) {
    const key = String(word).replace(/[.,!?·;:()»«"']/g, "").trim();
    const gloss = t("tutorial.demo.gloss");
    const translation =
      (gloss && typeof gloss === "object" && gloss[key]) ||
      t("tutorial.demo.glossFallback");
    setDemoLookup({ word: key, status: "ready", card: { word: key, translation } });
  }

  // Свайп демо-карточки — РЕАЛЬНЫЙ useSwipeCard. Влево = Знаю, вправо = Взять.
  // Результат только визуальный (песочница), в SRS не пишется.
  const [swipeResult, setSwipeResult] = useState(null);
  const swipeEnabled = step.kind === "swipe";
  const swipe = useSwipeCard({
    enabled: swipeEnabled,
    onSwipeLeft: () => setSwipeResult("know"),
    onSwipeRight: () => setSwipeResult("take"),
  });
  const rightProg = Math.max(0, Math.min(swipe.dragX / SWIPE_THRESHOLD, 1));
  const leftProg = Math.max(0, Math.min(-swipe.dragX / SWIPE_THRESHOLD, 1));
  const prog = Math.max(rightProg, leftProg);
  const swipeRgb =
    swipe.dragX > 0 ? "var(--ember-take-rgb)" : "var(--ember-know-rgb)";
  const cardStyle = {
    ...swipe.style,
    borderColor: prog
      ? `rgba(${swipeRgb}, ${0.35 + 0.65 * prog})`
      : undefined,
    boxShadow: prog
      ? `0 0 ${10 + 26 * prog}px rgba(${swipeRgb}, ${0.5 * prog})`
      : undefined,
    transition: swipe.dragging
      ? "none"
      : "transform 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease",
  };

  // Escape закрывает; фон под окном не скроллится.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  // Новый шаг — сбрасываем демо-состояние (свайп/всплывашку), скроллим вверх.
  useEffect(() => {
    setSwipeResult(null);
    setDemoLookup(null);
  }, [index]);

  function next() {
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  }
  function back() {
    setIndex((i) => Math.max(0, i - 1));
  }

  // Подробная версия — метка группы (разбивка по группам); короткая — «Попробуйте
  // сами» на интерактивных шагах.
  const stepLabel = step.group
    ? t(`tutorial.groups.${step.group}`)
    : step.tryIt
      ? t("tutorial.tryIt")
      : null;

  return (
    <div
      className="tut"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tut-title"
    >
      <div className="tut__panel">
        <header className="tut__top">
          <span className="tut__dots" aria-hidden="true">
            {steps.map((_, i) => (
              <span
                key={i}
                className={"tut__dot" + (i === index ? " is-active" : "")}
              />
            ))}
          </span>
          <button type="button" className="tut__skip" onClick={onClose}>
            {t("tutorial.skip")}
          </button>
        </header>

        <div className="tut__body">
          {/* Тёплое вступление: крупная линейная иконка над приветствием. */}
          {step.kind === "welcome" && (
            <div className="tut__welcome-badge" aria-hidden="true">
              <Icon name={step.icon} size={40} />
            </div>
          )}
          {stepLabel && <span className="tut__label">{stepLabel}</span>}
          <h2 id="tut-title" className="tut__title">
            {t(`tutorial.steps.${step.id}.title`)}
          </h2>
          <p className="tut__text">{t(`tutorial.steps.${step.id}.text`)}</p>

          {step.kind === "welcome" && (
            <div className="tut__welcome-lead">
              {t("tutorial.steps.welcome.lead")}
            </div>
          )}

          {/* ----- Тап по слову: пример + реальная всплывашка перевода ----- */}
          {step.kind === "lookup" && (
            <div className="tut__demo">
              <div className="cards__card tut__example-card">
                <div className="cards__example">
                  <div className="cards__example-label-row">
                    <span className="cards__example-label">
                      {t("cards.example")}
                    </span>
                    <PlayButton
                      text={DEMO_EXAMPLE}
                      learnLang={DEMO_LEARN}
                      kind="example"
                      appearance="ember"
                    />
                  </div>
                  <p className="cards__example-text" lang={DEMO_LEARN}>
                    {splitWords(DEMO_EXAMPLE).map((seg, i) =>
                      seg.isWord ? (
                        <button
                          key={i}
                          type="button"
                          className="cards__example-word"
                          onClick={() => openDemoLookup(seg.text)}
                        >
                          {seg.text}
                        </button>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </p>
                  <p className="cards__example-translation">
                    {t("tutorial.demo.exampleTranslation")}
                  </p>
                </div>
              </div>
              <p className="tut__hint">
                <Icon name="spark" size={15} className="tut__hint-icon" />
                {t("tutorial.demo.tapHint")}
              </p>
            </div>
          )}

          {/* ----- Свайп: реальная карточка + реальный жест (песочница) ----- */}
          {step.kind === "swipe" && (
            <div className="tut__demo">
              <div className="tut__pills">
                <span className="tut__pill tut__pill--know">
                  <Icon name="close" size={14} />
                  {t("action.know")}
                </span>
                <span className="tut__pill tut__pill--take">
                  {t("action.take")}
                  <Icon name="check" size={14} />
                </span>
              </div>
              <WordCard
                card={demoCard}
                learnLang={DEMO_LEARN}
                nativeLang={nativeLang}
                innerRef={swipe.cardRef}
                style={cardStyle}
                className="tut__swipe-card"
              />
              {swipeResult ? (
                <p
                  className={
                    "tut__swipe-result tut__swipe-result--" + swipeResult
                  }
                  role="status"
                >
                  <Icon name="check" size={15} />
                  {swipeResult === "know"
                    ? t("tutorial.demo.knowConfirm")
                    : t("tutorial.demo.takeConfirm")}
                </p>
              ) : (
                <p className="tut__hint">{t("tutorial.demo.swipeHint")}</p>
              )}
              {/* Дубли жеста кнопками — для десктопа/без тача, как в приложении. */}
              <div className="tut__swipe-btns">
                <button
                  type="button"
                  className="tut__swipe-btn tut__swipe-btn--know"
                  onClick={() => setSwipeResult("know")}
                >
                  {t("action.know")}
                </button>
                <button
                  type="button"
                  className="tut__swipe-btn tut__swipe-btn--take"
                  onClick={() => setSwipeResult("take")}
                >
                  {t("action.take")}
                </button>
              </div>
            </div>
          )}

          {/* ----- Занятие дня: превью с реальными иконками ----- */}
          {step.kind === "session" && (
            <div className="tut__demo">
              <div className="tut__session">
                <div className="tut__session-head">
                  <span className="tut__session-title">
                    {t("tutorial.session.label", { lang: t("lang.el") })}
                  </span>
                  <span className="tut__session-mins">
                    {t("tutorial.session.minutes", { n: 9 })}
                  </span>
                </div>
                <div className="tut__session-tiles">
                  <div className="tut__tile">
                    <Icon name="review" size={22} />
                    <span>{t("tutorial.session.cards", { n: 12 })}</span>
                  </div>
                  <div className="tut__tile">
                    <Icon name="reading" size={22} />
                    <span>{t("tutorial.session.text")}</span>
                  </div>
                  <div className="tut__tile">
                    <Icon name="listening" size={22} />
                    <span>{t("tutorial.session.dialogue")}</span>
                  </div>
                </div>
              </div>
              <div className="tut__core">
                <div className="tut__core-head">
                  <Icon name="bulb" size={18} className="tut__core-icon" />
                  <span className="tut__core-title">
                    {t("tutorial.session.coreTitle")}
                  </span>
                </div>
                <p className="tut__core-text">
                  {t("tutorial.session.coreText")}
                </p>
              </div>
            </div>
          )}

          {/* ----- Повторение: оценки в смысловых цветах Ember ----- */}
          {step.kind === "grades" && (
            <div className="tut__demo">
              <div className="tut__grades">
                {GRADES.map((g) => (
                  <span key={g} className={"tut__grade tut__grade--" + g}>
                    {t("grade." + g)}
                  </span>
                ))}
              </div>
              <p className="tut__hint">{t("tutorial.demo.gradeHint")}</p>
            </div>
          )}

          {/* ----- Разбор экрана-функции: линейная иконка + пункты ----- */}
          {step.kind === "info" && (
            <div className="tut__demo">
              <div className="tut__info-badge" aria-hidden="true">
                <Icon name={step.icon} size={30} />
              </div>
              <ul className="tut__points">
                {Array.from({ length: step.points }).map((_, i) => (
                  <li key={i} className="tut__point">
                    <Icon name="check" size={16} className="tut__point-icon" />
                    <span>{t(`tutorial.steps.${step.id}.points.${i}`)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="tut__foot">
          {/* Экран 1 короткой версии — тёплое вступление: «Начнём» + «сам». */}
          {mode === "short" && step.kind === "welcome" ? (
            <>
              <button type="button" className="tut__primary" onClick={next}>
                {t("tutorial.begin")} <span aria-hidden="true">→</span>
              </button>
              <button type="button" className="tut__ghost-link" onClick={onClose}>
                {t("tutorial.alreadyKnow")}
              </button>
            </>
          ) : mode === "short" && step.kind === "session" ? (
            <>
              <button
                type="button"
                className="tut__primary"
                onClick={() => (onStartSession ? onStartSession() : onClose())}
              >
                {t("tutorial.startSession")} <span aria-hidden="true">→</span>
              </button>
              <button
                type="button"
                className="tut__secondary"
                onClick={onOpenDetailed}
              >
                <Icon name="reading" size={16} />
                {t("tutorial.openDetailed")}
              </button>
            </>
          ) : (
            <>
              <button type="button" className="tut__primary" onClick={next}>
                {isLast ? t("tutorial.gotIt") : t("tutorial.next")}{" "}
                {!isLast && <span aria-hidden="true">→</span>}
              </button>
              <div className="tut__foot-links">
                {index > 0 && (
                  <button type="button" className="tut__ghost-link" onClick={back}>
                    {t("common.back")}
                  </button>
                )}
                {!isLast && (
                  <button type="button" className="tut__ghost-link" onClick={next}>
                    {t("tutorial.skipStep")}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Реальная всплывашка перевода — общий компонент (демо-данные, без SRS). */}
      <WordLookupSheet
        lookup={demoLookup}
        learnLang={DEMO_LEARN}
        nativeLang={nativeLang}
        onAdd={() => true}
        onClose={() => setDemoLookup(null)}
      />
    </div>
  );
}
