// Сколько карточек генерировать за раз — выбирает пользователь (5/10/20).
export const GENERATE_COUNT_OPTIONS = [5, 10, 20];
export const DEFAULT_GENERATE_COUNT = 10;

export function loadGenerateCount() {
  try {
    const raw = Number(localStorage.getItem("generateCount"));
    return GENERATE_COUNT_OPTIONS.includes(raw) ? raw : DEFAULT_GENERATE_COUNT;
  } catch {
    return DEFAULT_GENERATE_COUNT;
  }
}
