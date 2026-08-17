import {
  stripStressMarks,
  stripStressMarksFor,
} from "../../lib/stressMarks.js";

// ============================================================================
// ТЕКСТ КАРТОЧКИ ДЛЯ ПОКАЗА. Та же зачистка знаков ударения, что и на приёме
// ответа модели, но применённая НА ЭКРАНЕ.
// ----------------------------------------------------------------------------
// ЗАЧЕМ ещё раз, если чистим при генерации: карточки, взятые ДО появления
// зачистки, лежат в wordInfo как есть — со знаками («спасибо́», «интерéсно»,
// «встреча́»). Мигрировать их мы намеренно не будем: там прогресс повторения, и
// переписывать личные данные ради косметики — плохой размен. А показать без
// лишних знаков можно бесплатно.
//
// ЖЕЛЕЗНОЕ ПРАВИЛО: чистится ТОЛЬКО то, что выводится на экран. КЛЮЧИ СЛОВ НЕ
// МЕНЯЮТСЯ НИКОГДА — на них завязаны записи SRS (srsByWord), членство в списках
// (takenWords/knownWords) и сам wordInfo. Поэтому зачистка живёт НА ГРАНИЦЕ
// показа: экран продолжает работать с исходным словом, а компонент получает
// уже чистый текст. Ни один вызов vocab.* сюда не заглядывает.
//
// Греческий не трогаем (см. STRESS_KEEPING_LANGS), транскрипцию (translit) —
// тоже: там ударение уместно по замыслу и стоит верно.
// ============================================================================

/** Текст на ИЗУЧАЕМОМ языке (слово, пример, мн. число). */
export function learnText(text, learnLang) {
  return stripStressMarksFor(learnLang, text);
}

/**
 * Текст на РОДНОМ языке (перевод, перевод примера, заметка, ярлык стиля).
 * Родным бывает только ru/uk/en, поэтому язык здесь не спрашиваем.
 */
export function nativeText(text) {
  return stripStressMarks(text);
}

/**
 * Копия записи карточки/слова, пригодная для ПОКАЗА: поля-тексты почищены,
 * остальное (pos, translit и любые служебные поля) перенесено как есть.
 *
 * Принимает и карточку из колоды, и запись wordInfo вместе со словом —
 * структура полей у них одна. Возвращает НОВЫЙ объект: исходный не меняется,
 * поэтому вызывающий спокойно продолжает брать из него ключ слова.
 */
export function cardForDisplay(card, learnLang) {
  if (!card) return card;
  const out = { ...card };
  if (out.word) out.word = learnText(out.word, learnLang);
  if (out.plural) out.plural = learnText(out.plural, learnLang);
  if (out.example) out.example = learnText(out.example, learnLang);
  if (out.translation) out.translation = nativeText(out.translation);
  if (out.exampleTranslation) {
    out.exampleTranslation = nativeText(out.exampleTranslation);
  }
  if (out.note) out.note = nativeText(out.note);
  if (out.register) out.register = nativeText(out.register);
  return out;
}
