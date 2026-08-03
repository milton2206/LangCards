// ============================================================================
// Тема Ember: светлая / тёмная.
// ----------------------------------------------------------------------------
// Тема выражена одним атрибутом data-theme на <html>, а токены Ember в
// theme/ember.css переопределяются под каждый вариант. Экраны читают только
// семантические `--ember-*`, поэтому атрибут перекрашивает всё приложение разом
// (фон, карточки, текст, акценты, статусы) + фон body/html/#root (index.css
// красит их через var(--ember-bg)) — в светлой теме при оттягивании не вылезает
// тёмная полоса.
//
// Экраны, ещё не переведённые на Ember, красятся СТАРЫМИ токенами (--bg,
// --surface, …). В светлой теме index.css переопределяет их на значения Ember,
// иначе они остались бы тёмными пятнами на глине.
//
// Выбор пользователя хранится в localStorage и переживает перезаход.
// По умолчанию — ТЁМНАЯ.
// ============================================================================

export const EMBER_THEMES = ["light", "dark"];
export const DEFAULT_THEME = "dark";

const PREF_KEY = "themePref";

/** Выставить тему Ember: пишет data-theme на <html> ('light' | 'dark'). */
export function applyEmberTheme(theme) {
  const value = EMBER_THEMES.includes(theme) ? theme : DEFAULT_THEME;
  document.documentElement.setAttribute("data-theme", value);
}

/** Сохранённая тема; по умолчанию тёмная. */
export function loadTheme() {
  try {
    const value = localStorage.getItem(PREF_KEY);
    return EMBER_THEMES.includes(value) ? value : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

/** Сохранить выбор темы (переживает перезаход). */
export function saveTheme(theme) {
  if (!EMBER_THEMES.includes(theme)) return;
  try {
    localStorage.setItem(PREF_KEY, theme);
  } catch {
    // хранилище недоступно — тема применится хотя бы на эту сессию
  }
}
