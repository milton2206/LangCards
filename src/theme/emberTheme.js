// ============================================================================
// Механика переключения темы Ember (светлая/тёмная) — фундамент (шаг 1/N).
// ----------------------------------------------------------------------------
// Тема выражена одним атрибутом data-theme на <html>, а токены Ember в
// theme/ember.css переопределяются под каждый вариант. Этот модуль — тонкая
// обёртка над атрибутом: выставить/прочитать/подписаться на системную тему.
//
// ВАЖНО: на этом шаге НИЧЕГО не вызывается автоматически — модуль экспортирован
// «про запас». Переключатель и его хранение подключим на следующих шагах, тогда
// же выставим data-theme. Пока атрибут не задан, приложение выглядит как сейчас
// (экраны используют старые токены и не читают токены Ember).
// ============================================================================

export const EMBER_THEMES = ["light", "dark"];

/** Выставить тему Ember: пишет data-theme на <html> ('light' | 'dark'). */
export function applyEmberTheme(theme) {
  if (!EMBER_THEMES.includes(theme)) return;
  document.documentElement.setAttribute("data-theme", theme);
}

/** Текущая тема из атрибута (null — атрибут не выставлен, т.е. база = тёмная). */
export function getEmberTheme() {
  const value = document.documentElement.getAttribute("data-theme");
  return EMBER_THEMES.includes(value) ? value : null;
}

/** Снять явную тему (вернуться к базовой = тёмной без атрибута). */
export function clearEmberTheme() {
  document.documentElement.removeAttribute("data-theme");
}

/** Системное предпочтение пользователя ('light' | 'dark'). */
export function systemPrefersTheme() {
  if (typeof window === "undefined" || !window.matchMedia) return "dark";
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}
