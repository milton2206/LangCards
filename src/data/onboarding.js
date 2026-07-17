// Единый источник данных для онбординга.
// Используется и мастером выбора, и экраном-заглушкой (для подписи выбора).

export const ONBOARDING_STEPS = [
  {
    key: "learnLang",
    title: "Какой язык учу?",
    options: [
      { id: "de", label: "Немецкий", emoji: "🇩🇪" },
      { id: "en", label: "Английский", emoji: "🇬🇧" },
      { id: "el", label: "Греческий", emoji: "🇬🇷" },
      { id: "es", label: "Испанский", emoji: "🇪🇸" },
    ],
  },
  {
    key: "nativeLang",
    title: "Мой родной язык",
    hint: "На него будем переводить",
    options: [
      { id: "ru", label: "Русский", emoji: "🇷🇺" },
      { id: "uk", label: "Украинский", emoji: "🇺🇦" },
      { id: "en", label: "Английский", emoji: "🇬🇧" },
    ],
  },
  {
    key: "topic",
    title: "Тема",
    hint: "О чём будут карточки",
    options: [
      { id: "work", label: "Работа", emoji: "💼" },
      { id: "housing", label: "Аренда жилья", emoji: "🏠" },
      { id: "doctor", label: "У врача", emoji: "🩺" },
      { id: "travel", label: "Путешествия", emoji: "✈️" },
      { id: "daily", label: "Повседневное общение", emoji: "💬" },
      { id: "restaurant", label: "Ресторан / кафе", emoji: "☕" },
    ],
  },
  {
    key: "level",
    title: "Уровень",
    hint: "Уровень по шкале CEFR (A1 — начальный … C1 — продвинутый)",
    options: [
      { id: "a1", label: "A1 — начальный", emoji: "🟢" },
      { id: "a2", label: "A2 — элементарный", emoji: "🟢" },
      { id: "b1", label: "B1 — средний", emoji: "🟡" },
      { id: "b2", label: "B2 — выше среднего", emoji: "🟠" },
      { id: "c1", label: "C1 — продвинутый", emoji: "🔴" },
    ],
  },
];

// Ключи выбора, которые сохраняем в state.
export const SETTINGS_KEYS = ONBOARDING_STEPS.map((step) => step.key);

// Пустой набор настроек (все шаги ещё не выбраны).
export const EMPTY_SETTINGS = Object.fromEntries(
  SETTINGS_KEYS.map((key) => [key, null]),
);

// Находит подпись выбранной опции по ключу шага и id опции.
export function findOptionLabel(stepKey, optionId) {
  const step = ONBOARDING_STEPS.find((s) => s.key === stepKey);
  const option = step?.options.find((o) => o.id === optionId);
  return option ? option.label : "";
}
