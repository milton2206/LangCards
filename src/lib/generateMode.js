// Тип генерируемого контента — выбирает пользователь рядом с кнопкой генерации.
// "words"  — обычные слова с примером (по умолчанию).
// "idioms" — «Контекст носителей»: идиомы, устойчивые обороты и живые фразы.
export const GENERATE_MODES = ["words", "idioms"];
export const DEFAULT_GENERATE_MODE = "words";

export function loadGenerateMode() {
  try {
    const raw = localStorage.getItem("generateMode");
    return GENERATE_MODES.includes(raw) ? raw : DEFAULT_GENERATE_MODE;
  } catch {
    return DEFAULT_GENERATE_MODE;
  }
}
