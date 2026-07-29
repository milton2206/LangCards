// ============================================================================
// Линейные иконки Ember — единый компонент набора на замену эмодзи (шаг 1/N).
// ----------------------------------------------------------------------------
// «Та же линия, но в плашках»: все иконки — 24×24, обводка currentColor, без
// заливки, единая толщина линии и скругления. Цвет наследуется от текста
// (currentColor), размер — через проп size (по умолчанию 24). Сами пути живут
// в paths.jsx (реестр), чтобы набор легко пополнялся.
//
// ВАЖНО: на этом шаге набор ТОЛЬКО ГОТОВИТСЯ. Эмодзи в экранах НЕ подменяются
// — это сделаем по частям на следующих шагах. Компонент импортируется как
//   <Icon name="settings" />          (декоративная, aria-hidden по умолчанию)
//   <Icon name="reading" label="Чтение" />  (с подписью для скринридера)
//
// Имена (см. paths.jsx) соответствуют смыслам приложения:
//   settings · reading · listening · stats · languages · speak · mute ·
//   check · spark  (озвучка, чтение, аудирование, статистика, языки и т.д.)
// ============================================================================

import { PATHS } from "./paths.jsx";

/**
 * Линейная иконка Ember.
 *
 * @param {string} name   — имя из реестра paths.jsx (ICON_NAMES).
 * @param {number} size   — размер в px (квадрат), по умолчанию 24.
 * @param {string} label  — подпись для скринридера. Если задана — иконка
 *                          смысловая (role="img" + aria-label); иначе —
 *                          декоративная (aria-hidden), подпись даёт текст рядом.
 * @param {number} strokeWidth — толщина линии (по умолчанию 1.8).
 */
export default function Icon({
  name,
  size = 24,
  label,
  strokeWidth = 1.8,
  className,
  ...rest
}) {
  const path = PATHS[name];
  if (!path) return null;

  const a11y = label
    ? { role: "img", "aria-label": label }
    : { "aria-hidden": "true", focusable: "false" };

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...a11y}
      {...rest}
    >
      {path}
    </svg>
  );
}
