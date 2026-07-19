import { useEffect, useRef, useState } from "react";
import "./Tutorial.css";

// Короткие слайды: механика, а не длинное обучение.
const SLIDES = [
  {
    emoji: "📖",
    title: "Учи слова в контексте",
    text: "Каждое слово — с примером в предложении. Так они запоминаются лучше, чем по отдельности.",
  },
  {
    emoji: "🎯",
    title: "Три кнопки на карточке",
    actions: [
      { label: "Взять", desc: "слово идёт в изучение — будешь повторять", cls: "take" },
      { label: "Пропустить", desc: "пока не хочешь — слово вернётся позже", cls: "skip" },
      { label: "Знаю", desc: "уже знаешь — слово больше не появится", cls: "known" },
    ],
  },
  {
    emoji: "✨",
    title: "Новые карточки — по кнопке",
    text: "Новые слова приходят только когда ты сам нажимаешь «Сгенерировать новые карточки».",
  },
  {
    emoji: "📚",
    title: "Мои слова и Известные",
    text: "Взятые слова — в разделе «Мои слова», выученные — в «Известные». Открой их с экрана карточек.",
  },
];

/**
 * Короткий онбординг-туториал по механике приложения.
 * Слайды можно листать (кнопки или свайп). Закрытие — «Пропустить»/«Понятно».
 */
export default function Tutorial({ onClose }) {
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
            Пропустить
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
            {slide.title}
          </h2>

          {slide.text && <p className="tutorial__text">{slide.text}</p>}

          {slide.actions && (
            <ul className="tutorial__actions">
              {slide.actions.map((a) => (
                <li key={a.label} className="tutorial__act">
                  <span
                    className={`tutorial__act-label tutorial__act-label--${a.cls}`}
                  >
                    {a.label}
                  </span>
                  <span className="tutorial__act-desc">{a.desc}</span>
                </li>
              ))}
            </ul>
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
              Назад
            </button>
          )}
          <button type="button" className="tutorial__next" onClick={next}>
            {isLast ? "Понятно" : "Далее"}
          </button>
        </div>
      </div>
    </div>
  );
}
