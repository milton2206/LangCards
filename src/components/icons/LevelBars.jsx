// ============================================================================
// Значок уровня — «лесенка-сигнал»: три восходящие ступеньки, заполняются по
// уровню CEFR (как индикатор сигнала). Чем выше уровень — тем больше ступенек
// подсвечено акцентом, остальные приглушены.
//   A1/A2 → 1 · B1/B2 → 2 · C1/C2 → 3
// Цвета зависят от того, ВЫБРАН ли чип: на невыбранном — терракота/приглушённый,
// на выбранном (терракотовый фон) — контрастный on-accent/полупрозрачный, чтобы
// ступеньки читались на обоих фонах. Отражает уровень именно этой строки.
// ============================================================================

const FILLED = { a1: 1, a2: 1, b1: 2, b2: 2, c1: 3, c2: 3 };

// [x, yTop] трёх восходящих столбиков (низ у всех на y=20).
const BARS = [
  [5.5, 15],
  [12, 11],
  [18.5, 7],
];

export default function LevelBars({ level, active = false, size = 18, className }) {
  const filled = FILLED[String(level).toLowerCase()] ?? 1;
  const on = active ? "var(--ember-on-accent)" : "var(--ember-accent)";
  const off = active
    ? "color-mix(in srgb, var(--ember-on-accent) 38%, transparent)"
    : "var(--ember-text-muted)";

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      strokeWidth="2.2"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
    >
      {BARS.map(([x, yTop], i) => (
        <line
          key={i}
          x1={x}
          y1="20"
          x2={x}
          y2={yTop}
          stroke={i < filled ? on : off}
        />
      ))}
    </svg>
  );
}
