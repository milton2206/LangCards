// ============================================================================
// Движок заданий: приложение само собирает занятие на сегодня из доступных
// форматов. Чистая функция — вся логика тестируется без UI и без сети.
// ----------------------------------------------------------------------------
// На входе: активный язык (по расписанию), приоритетный ли сегодня, число
// созревших повторений, дневной лимит новых слов и остаток, доступные форматы,
// нагрузка (session_load). На выходе — упорядоченный список блоков занятия.
//
// ПРИНЦИПЫ:
//   • Повторения ВСЕГДА первыми и в ПОЛНОМ объёме — их не режет никакой load.
//   • Порядок полной программы: повторение → чтение → новые слова → аудирование.
//   • Форматы, которых нет (нет сети/нет слов), просто не попадают в план.
//   • Приоритет управляет ТОЛЬКО глубиной в мультирежиме:
//       день приоритетного/один язык → полная программа;
//       день второстепенного        → поддержание (повторение + немного новых).
//   • Движок не обходит суточные лимиты: объём новых зажат остатком дневной нормы.
// ============================================================================

// Регулируемая нагрузка. 'auto' считается из лимита и числа повторений, дальше
// человек правит ползунком. Порядок в массиве = порядок «легче → тяжелее».
export const SESSION_LOADS = ["light", "normal", "heavy"];

// Объёмы по уровням нагрузки:
//   newFactor — множитель дневной нормы новых слов;
//   sentences — длина текста для чтения (предложений);
//   questions — число вопросов на понимание в диалоге аудирования.
const VOLUME = {
  light: { newFactor: 0.5, sentences: 4, questions: 2 },
  normal: { newFactor: 1.0, sentences: 6, questions: 3 },
  heavy: { newFactor: 1.5, sentences: 8, questions: 4 },
};

// Поддержание (день второстепенного языка): новых слов — половина от обычного.
const MAINTENANCE_NEW_FACTOR = 0.5;

/**
 * Автоматический стартовый уровень из дневной нормы и числа созревших повторений:
 * много повторений → занятие и так насыщенное, новых поменьше; большая норма и
 * мало повторений → можно плотнее.
 */
export function autoLevel(dailyNewLimit, reviewCount) {
  const limit = Math.max(1, Number(dailyNewLimit) || 0);
  const due = Math.max(0, Number(reviewCount) || 0);
  if (due >= 2 * limit) return "light";
  if (due >= limit) return "normal";
  return limit >= 15 ? "heavy" : "normal";
}

/** Эффективный уровень: явный выбор пользователя, либо авто-расчёт при 'auto'. */
export function effectiveLevel(sessionLoad, dailyNewLimit, reviewCount) {
  if (SESSION_LOADS.includes(sessionLoad)) return sessionLoad;
  return autoLevel(dailyNewLimit, reviewCount); // 'auto' и любое неизвестное
}

/**
 * Собирает занятие на сегодня — СТРУКТУРУ и ОБЪЁМ блоков (задачи), а не их статус.
 * Возвращает { level, restDay?, secondary?, blocks: [{ type, count?/sentences?/questions? }] }.
 * Типы блоков: 'review' | 'reading' | 'newWords' | 'listening'.
 *
 * ВАЖНО: reviewCount — это СНИМОК числа созревших на сегодня (стабилен в течение
 * дня), а не живое число оставшихся; и count новых слов — это ЦЕЛЬ дня (норма ×
 * нагрузка), а не остаток. Отметка «выполнено» считается снаружи (движок сверяет
 * цель с реальным прогрессом), поэтому блок не исчезает, когда упражнение пройдено.
 */
export function buildSession({
  reviewCount = 0,
  dailyNewLimit = 10,
  sessionLoad = "auto",
  isSecondaryDay = false, // мультирежим by_day: сегодня НЕ приоритетный язык
  restDay = false,
  readingAvailable = false,
  listeningAvailable = false,
}) {
  const level = effectiveLevel(sessionLoad, dailyNewLimit, reviewCount);
  const vol = VOLUME[level] || VOLUME.normal;
  const review = Math.max(0, Number(reviewCount) || 0);
  const blocks = [];

  // 1) Повторения — всегда первыми и в полном объёме (снимок дня).
  if (review > 0) blocks.push({ type: "review", count: review });

  // Выходной по расписанию: только повторения (плюс предложение позаниматься в UI).
  if (restDay) {
    return { level, restDay: true, blocks };
  }

  // Цель по новым словам на сегодня: норма × множитель нагрузки (в день
  // второстепенного — ещё вдвое меньше). Это ЦЕЛЬ, а не остаток: если слова уже
  // взяты вне движка, блок просто окажется выполненным (проверка снаружи). Сама
  // генерация карточек по-прежнему зажата суточным лимитом (см. buildParams).
  const limit = Math.max(0, Number(dailyNewLimit) || 0);
  const factor = vol.newFactor * (isSecondaryDay ? MAINTENANCE_NEW_FACTOR : 1);
  const newCount = Math.max(0, Math.round(limit * factor));

  // День второстепенного языка — поддержание: повторение + немного новых слов.
  if (isSecondaryDay) {
    if (newCount > 0) blocks.push({ type: "newWords", count: newCount });
    return { level, secondary: true, blocks };
  }

  // Полная программа (один язык или день приоритетного):
  //   повторение → чтение → новые слова → аудирование (диалог).
  if (readingAvailable) blocks.push({ type: "reading", sentences: vol.sentences });
  if (newCount > 0) blocks.push({ type: "newWords", count: newCount });
  if (listeningAvailable) {
    blocks.push({ type: "listening", questions: vol.questions });
  }

  return { level, blocks };
}
