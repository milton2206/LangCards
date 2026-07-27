// ============================================================================
// Прогресс занятия на СЕГОДНЯ (движок заданий): что отмечено выполненным.
// ----------------------------------------------------------------------------
// Статус живёт на день и на языковую пару и СБРАСЫВАЕТСЯ на новый день сам —
// ключ включает дату, и при несовпадении отдаётся пустой прогресс. Хранится в
// localStorage (офлайн-first), одной записью на активную пару+дату.
//
// В прогрессе ДВЕ вещи:
//   marks  — РУЧНЫЕ отметки пользователя: { [type]: true|false }. Есть только у
//            блоков, которые пользователь трогал сам (поставил/снял галочку).
//            Ручная отметка ПЕРЕКРЫВАЕТ автоматическую (тот же чекбокс).
//   events — события реального завершения ЭФЕМЕРНЫХ упражнений (чтение/аудио:
//            ответил на вопросы). Повторение и новые слова в events НЕ пишем —
//            их выполненность видно из самих данных (нет созревших / взято N).
//   reviewTarget — снимок числа созревших повторений на начало дня (для стабильной
//            подписи «Повторение · N»: живое число уменьшается по мере повторения).
// ============================================================================

const KEY = "sessionProgress";

function dayPairKey(pairKey, dateKey) {
  return `${pairKey}|${dateKey}`;
}

const EMPTY = { reviewTarget: null, marks: {}, events: {} };

/**
 * Прогресс занятия на сегодня для пары. Если сохранённый относится к другому дню
 * или другой паре — отдаём пустой (это и есть сброс на новый день).
 */
export function loadSessionProgress(pairKey, dateKey) {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY };
    const data = JSON.parse(raw);
    if (data && data.key === dayPairKey(pairKey, dateKey)) {
      return {
        reviewTarget:
          typeof data.reviewTarget === "number" ? data.reviewTarget : null,
        marks: data.marks && typeof data.marks === "object" ? data.marks : {},
        events:
          data.events && typeof data.events === "object" ? data.events : {},
      };
    }
    return { ...EMPTY };
  } catch {
    return { ...EMPTY };
  }
}

export function saveSessionProgress(pairKey, dateKey, progress) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        key: dayPairKey(pairKey, dateKey),
        reviewTarget: progress.reviewTarget ?? null,
        marks: progress.marks || {},
        events: progress.events || {},
      }),
    );
  } catch {
    // хранилище недоступно — статус просто не переживёт перезаход, не критично
  }
}
