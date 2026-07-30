// ============================================================================
// Механика переключения темы Ember (светлая/тёмная).
// ----------------------------------------------------------------------------
// Тема выражена одним атрибутом data-theme на <html> ('light' | 'dark'), а
// токены Ember в theme/ember.css переопределяются под каждый вариант. Экраны
// читают только семантические `--ember-*`, поэтому смена атрибута перекрашивает
// ВСЁ приложение разом (фон, карточки, текст, акценты, статусы) + фон
// body/html/#root (index.css красит их через var(--ember-bg)).
//
// Предпочтение пользователя: 'system' | 'light' | 'dark' — хранится в
// localStorage и переезжает между заходами на этом устройстве. 'system' следует
// за настройкой ОС (и переключается на лету, см. watchSystemTheme).
// ============================================================================

export const EMBER_THEMES = ["light", "dark"];

// Что пользователь выбрал в настройках (в т.ч. «как в системе»).
export const THEME_PREFS = ["system", "light", "dark"];
const PREF_KEY = "themePref";

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

/** Сохранённое предпочтение ('system' | 'light' | 'dark'); дефолт — 'system'. */
export function loadThemePref() {
  try {
    const value = localStorage.getItem(PREF_KEY);
    return THEME_PREFS.includes(value) ? value : "system";
  } catch {
    return "system";
  }
}

/** Сохранить предпочтение. */
export function saveThemePref(pref) {
  if (!THEME_PREFS.includes(pref)) return;
  try {
    localStorage.setItem(PREF_KEY, pref);
  } catch {
    // localStorage недоступен — не критично, применится хотя бы на эту сессию
  }
}

/** Предпочтение → конкретная тема ('light' | 'dark'), 'system' раскрывается. */
export function resolveTheme(pref) {
  return pref === "light" || pref === "dark" ? pref : systemPrefersTheme();
}

/** Применить предпочтение к <html> (выставляет data-theme). */
export function applyThemePref(pref) {
  applyEmberTheme(resolveTheme(pref));
}

/**
 * Пока выбрано «как в системе», следим за сменой темы ОС и перекрашиваем на лету.
 * Возвращает функцию отписки. При pref ≠ 'system' слушатель не навешивается.
 */
export function watchSystemTheme(pref, onChange) {
  if (pref !== "system" || typeof window === "undefined" || !window.matchMedia) {
    return () => {};
  }
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const handler = () => onChange(systemPrefersTheme());
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}
