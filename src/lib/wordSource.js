// Источник слов для чтения (6.1) и аудирования (6.2) — ОДНА общая настройка на
// оба режима. Определяет, из чего строится контент:
//   mine  — только слова, которые пользователь уже взял (закрепление знакомого);
//   mixed — знакомые вперемешку с новыми (по умолчанию, оптимально для обучения);
//   new   — намеренно незнакомые слова под уровень (расширение словаря).
//
// Значение уходит в тот же промпт генерации (см. lib/reading.js) — новой логики
// генерации не заводим. Хранится глобально в localStorage, как listeningLevel и
// generateMode: применяется к активной паре, экраны чтения и аудирования читают
// и меняют одно и то же значение.

export const WORD_SOURCES = ["mine", "mixed", "new"];
export const DEFAULT_WORD_SOURCE = "mixed"; // текущее поведение по умолчанию

const STORAGE_KEY = "wordSource";

export function loadWordSource() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return WORD_SOURCES.includes(raw) ? raw : DEFAULT_WORD_SOURCE;
  } catch {
    return DEFAULT_WORD_SOURCE;
  }
}

export function saveWordSource(id) {
  try {
    localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // ignore
  }
}

// Заметка о «Мои слова» при нуле взятых слов: строить не из чего, поэтому
// генерация молча трактует это как «Смешанно» (буквально уровень-онли) —
// см. buildReadingPrompt в lib/reading.js. В UI это сопровождается явной
// подсказкой (WordSourcePicker показывает предупреждение при малом числе слов).
