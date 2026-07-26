// Единый источник данных для онбординга (структура шагов и опций). Тексты
// (заголовки, подписи опций) живут в словарях i18n — здесь только ключи, id и
// эмодзи. Подписи резолвятся через t() по ключам optionLabelKey/stepTitleKey.

import {
  LEARN_LANGUAGES,
  NATIVE_LANGUAGES,
  enabledLearnLanguages,
} from "./languages.js";

// Флаги языков — общие для онбординга, настроек и переключателя пар. Собираются
// из единого каталога языков (src/data/languages.js), чтобы флаг был в одном месте.
export const LANG_EMOJI = Object.fromEntries(
  [...LEARN_LANGUAGES, ...NATIVE_LANGUAGES].map((l) => [l.id, l.emoji]),
);

export const ONBOARDING_STEPS = [
  {
    key: "learnLang",
    // Только включённые для изучения языки (enabled). Выключенный язык (напр.
    // испанский) исчезает из выбора здесь и во всех PairPicker разом.
    options: enabledLearnLanguages().map((l) => ({ id: l.id, emoji: l.emoji })),
  },
  {
    key: "nativeLang",
    options: NATIVE_LANGUAGES.map((l) => ({ id: l.id, emoji: l.emoji })),
  },
  {
    key: "topic",
    options: [
      { id: "work", emoji: "💼" },
      { id: "housing", emoji: "🏠" },
      { id: "doctor", emoji: "🩺" },
      { id: "travel", emoji: "✈️" },
      { id: "daily", emoji: "💬" },
      { id: "restaurant", emoji: "☕" },
    ],
  },
  {
    key: "level",
    options: [
      { id: "a1", emoji: "🟢" },
      { id: "a2", emoji: "🟢" },
      { id: "b1", emoji: "🟡" },
      { id: "b2", emoji: "🟠" },
      { id: "c1", emoji: "🔴" },
    ],
  },
];

// Ключи выбора, которые сохраняем в state.
export const SETTINGS_KEYS = ONBOARDING_STEPS.map((step) => step.key);

// Пустой набор настроек (все шаги ещё не выбраны).
export const EMPTY_SETTINGS = Object.fromEntries(
  SETTINGS_KEYS.map((key) => [key, null]),
);

// Ключ перевода подписи опции. Языки (учу/родной) делят общий namespace lang.*,
// тема и уровень — свои (topic.*, level.*).
export function optionLabelKey(stepKey, optionId) {
  if (stepKey === "learnLang" || stepKey === "nativeLang") {
    return `lang.${optionId}`;
  }
  return `${stepKey}.${optionId}`;
}

export const stepTitleKey = (stepKey) => `onb.${stepKey}.title`;
export const stepHintKey = (stepKey) => `onb.${stepKey}.hint`;
