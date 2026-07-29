// ============================================================================
// Круглые флаги языков (набор Ember: «флаги — круглые плашки»).
// ----------------------------------------------------------------------------
// Настоящая графика флага в круге, а НЕ эмодзи: эмодзи-флаги на Windows/части
// платформ показываются как буквенные пары (🇬🇷 → «GR»), а не флаг. SVG рисует
// одинаково везде. Квадратный флаг обрезается до круга (border-radius:50% +
// overflow:hidden на обёртке, preserveAspectRatio="slice" на svg).
//
// Покрыты языки приложения (см. data/languages.js): de, en(🇬🇧), el, es, ru, uk.
// Неизвестный код — нейтральный тёплый кружок (фолбэк).
// ============================================================================

import "./Flag.css";

const FLAGS = {
  // Германия — чёрный / красный / золотой.
  de: (
    <>
      <rect width="24" height="24" fill="#DD0000" />
      <rect width="24" height="8" fill="#000000" />
      <rect width="24" height="8" y="16" fill="#FFCE00" />
    </>
  ),
  // Россия — белый / синий / красный.
  ru: (
    <>
      <rect width="24" height="24" fill="#FFFFFF" />
      <rect width="24" height="8" y="8" fill="#0039A6" />
      <rect width="24" height="8" y="16" fill="#D52B1E" />
    </>
  ),
  // Украина — синий / жёлтый.
  uk: (
    <>
      <rect width="24" height="12" fill="#0057B7" />
      <rect width="24" height="12" y="12" fill="#FFD700" />
    </>
  ),
  // Испания — красный / жёлтый (двойной) / красный (без герба, упрощённо).
  es: (
    <>
      <rect width="24" height="24" fill="#AA151B" />
      <rect width="24" height="12" y="6" fill="#F1BF00" />
    </>
  ),
  // Греция — 9 сине-белых полос + кантон с белым крестом.
  el: (
    <>
      <rect width="24" height="24" fill="#0D5EAF" />
      <rect y="2.667" width="24" height="2.667" fill="#FFFFFF" />
      <rect y="8" width="24" height="2.667" fill="#FFFFFF" />
      <rect y="13.333" width="24" height="2.667" fill="#FFFFFF" />
      <rect y="18.667" width="24" height="2.667" fill="#FFFFFF" />
      <rect width="13.333" height="13.333" fill="#0D5EAF" />
      <rect x="5.333" width="2.667" height="13.333" fill="#FFFFFF" />
      <rect y="5.333" width="13.333" height="2.667" fill="#FFFFFF" />
    </>
  ),
  // Великобритания (en) — Union Jack (упрощённо, симметрично).
  en: (
    <>
      <rect width="24" height="24" fill="#012169" />
      <path d="M0 0 L24 24 M24 0 L0 24" stroke="#FFFFFF" strokeWidth="5" />
      <path d="M0 0 L24 24 M24 0 L0 24" stroke="#C8102E" strokeWidth="2" />
      <path d="M12 0 V24 M0 12 H24" stroke="#FFFFFF" strokeWidth="7" />
      <path d="M12 0 V24 M0 12 H24" stroke="#C8102E" strokeWidth="4" />
    </>
  ),
};

/**
 * Круглый флаг языка.
 * @param {string} lang — id языка (de/en/el/es/ru/uk).
 * @param {number} size — диаметр в px (по умолчанию 22).
 */
export default function Flag({ lang, size = 22, className, ...rest }) {
  const inner = FLAGS[lang];
  return (
    <span
      className={"flag" + (className ? " " + className : "")}
      style={{ width: size, height: size }}
      aria-hidden="true"
      {...rest}
    >
      <svg
        viewBox="0 0 24 24"
        width="100%"
        height="100%"
        preserveAspectRatio="xMidYMid slice"
      >
        {inner || <rect width="24" height="24" fill="#8a6f5c" />}
      </svg>
    </span>
  );
}
