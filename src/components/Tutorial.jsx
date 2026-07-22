import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./Tutorial.css";

// Метаданные слайдов (эмодзи, структура свайпа/оценок). Тексты — из словаря
// по ключу tutorial.<key>.*, подписи действий/оценок — общие action.*/grade.*
// (см. render) — так туториал не может разойтись с реальными подписями кнопок.
const SLIDES = [
  { key: "slide1", emoji: "📖" },
  {
    key: "slide2",
    emoji: "🃏",
    swipe: {
      left: { arrow: "←", cls: "known", labelKey: "action.know", descKey: "tutorial.slide2.leftDesc" },
      right: { arrow: "→", cls: "take", labelKey: "action.take", descKey: "tutorial.slide2.rightDesc" },
      skip: { cls: "skip", labelKey: "action.skip", descKey: "tutorial.slide2.skipDesc" },
    },
  },
  {
    key: "slide3",
    emoji: "🔁",
    grades: {
      items: [
        { cls: "again", labelKey: "grade.again" },
        { cls: "hard", labelKey: "grade.hard" },
        { cls: "good", labelKey: "grade.good" },
        { cls: "easy", labelKey: "grade.easy" },
      ],
      hintKey: "tutorial.slide3.gradeHint",
      againHintKey: "tutorial.slide3.againHint",
    },
  },
  { key: "slide4", emoji: "✨" },
  { key: "slide5", emoji: "📚" },
];

/**
 * Короткий онбординг-туториал по механике приложения.
 * Слайды можно листать (кнопки или свайп). Закрытие — «Пропустить»/«Понятно».
 */
export default function Tutorial({ onClose }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const touchX = useRef(null);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  function next() {
    if (isLast) onClose();
    else setIndex((i) => i + 1);
  }
  function back() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function onTouchStart(e) {
    touchX.current = e.changedTouches[0].clientX;
  }
  function onTouchEnd(e) {
    if (touchX.current == null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (dx < -40 && !isLast) setIndex((i) => i + 1);
    else if (dx > 40 && index > 0) setIndex((i) => i - 1);
  }

  return (
    <div
      className="tutorial"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
    >
      <div className="tutorial__box">
        <header className="tutorial__top">
          <span className="tutorial__step">
            {index + 1} / {SLIDES.length}
          </span>
          <button
            type="button"
            className="tutorial__skip"
            onClick={onClose}
          >
            {t("tutorial.skip")}
          </button>
        </header>

        <div
          className="tutorial__slide"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="tutorial__emoji" aria-hidden="true">
            {slide.emoji}
          </div>
          <h2 id="tutorial-title" className="tutorial__title">
            {t(`tutorial.${slide.key}.title`)}
          </h2>

          <p className="tutorial__text">{t(`tutorial.${slide.key}.text`)}</p>

          {slide.swipe && (
            <div className="tutorial__swipe">
              <div className="tutorial__swipe-row">
                <div className="tutorial__swipe-side tutorial__swipe-side--left">
                  <span className="tutorial__swipe-arrow">
                    {slide.swipe.left.arrow}
                  </span>
                  <span
                    className={`tutorial__act-label tutorial__act-label--${slide.swipe.left.cls}`}
                  >
                    {t(slide.swipe.left.labelKey)}
                  </span>
                  <span className="tutorial__swipe-desc">
                    {t(slide.swipe.left.descKey)}
                  </span>
                </div>

                <div className="tutorial__swipe-card" aria-hidden="true">
                  🃏
                </div>

                <div className="tutorial__swipe-side tutorial__swipe-side--right">
                  <span className="tutorial__swipe-arrow">
                    {slide.swipe.right.arrow}
                  </span>
                  <span
                    className={`tutorial__act-label tutorial__act-label--${slide.swipe.right.cls}`}
                  >
                    {t(slide.swipe.right.labelKey)}
                  </span>
                  <span className="tutorial__swipe-desc">
                    {t(slide.swipe.right.descKey)}
                  </span>
                </div>
              </div>

              <div className="tutorial__swipe-skip">
                <span
                  className={`tutorial__act-label tutorial__act-label--${slide.swipe.skip.cls}`}
                >
                  {t(slide.swipe.skip.labelKey)}
                </span>
                <span className="tutorial__act-desc">
                  {t(slide.swipe.skip.descKey)}
                </span>
              </div>
            </div>
          )}

          {slide.grades && (
            <div className="tutorial__grades">
              <div className="tutorial__grades-row">
                {slide.grades.items.map((g) => (
                  <span
                    key={g.cls}
                    className={`tutorial__grade-pill tutorial__grade-pill--${g.cls}`}
                  >
                    {t(g.labelKey)}
                  </span>
                ))}
              </div>
              <p className="tutorial__grades-hint">
                {t(slide.grades.hintKey)}
              </p>
              <p className="tutorial__grades-hint">
                {t(slide.grades.againHintKey)}
              </p>
            </div>
          )}
        </div>

        <div className="tutorial__dots" aria-hidden="true">
          {SLIDES.map((_, i) => (
            <span
              key={i}
              className={"tutorial__dot" + (i === index ? " is-active" : "")}
            />
          ))}
        </div>

        <div className="tutorial__nav">
          {index > 0 && (
            <button type="button" className="tutorial__back" onClick={back}>
              {t("common.back")}
            </button>
          )}
          <button type="button" className="tutorial__next" onClick={next}>
            {isLast ? t("tutorial.gotIt") : t("tutorial.next")}
          </button>
        </div>
      </div>
    </div>
  );
}
