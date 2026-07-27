// ============================================================================
// Движок заданий: приложение само собирает занятие на сегодня. Чистая функция —
// вся логика тестируется без UI и без сети.
// ----------------------------------------------------------------------------
// ПРИНЦИП: «полная база всегда, но с ротацией + добавки сверху».
//   • Повторения ВСЕГДА первыми, каждый день, в ПОЛНОМ объёме — вне ротации,
//     их не режет ни нагрузка, ни что-либо ещё.
//   • База каждый день ПОЛНАЯ (все доступные форматы: чтение, новые слова,
//     аудирование), но не одинаковая: АКЦЕНТ дня ротируется по календарю —
//     сегодня аудирование, завтра чтение, послезавтра случайные новые слова —
//     и так по кругу. Акцентный формат идёт первым и заметно объёмнее.
//   • ДОБАВКИ сверху базы — «хотите ещё?»: приоритетному дню их предлагается
//     больше (приоритет через ДОБАВКИ, а не через урезание базы остальных).
//   • День ВТОРОСТЕПЕННОГО языка = база чуть ПЛОТНЕЕ (навёрстывать: им
//     занимаются реже и он быстрее забывается), а НЕ урезаннее.
//   • Форматы, которых нет (нет сети → нет текста/диалога), пропускаются молча.
//   • Нагрузка (легче/нормально/тяжелее) меняет ОБЪЁМ внутри базы, но НЕ убирает
//     форматы — база всё равно полная.
// ============================================================================

// Регулируемая нагрузка. 'auto' считается из лимита и числа повторений, дальше
// человек правит ползунком. Порядок в массиве = порядок «легче → тяжелее».
export const SESSION_LOADS = ["light", "normal", "heavy"];

// Учебные форматы, по которым РОТИРУЕТСЯ акцент базы. Повторение сюда НЕ входит —
// оно вне ротации (всегда первое и полное). Порядок = порядок ротации по дням.
export const ROTATION_FORMATS = ["listening", "reading", "newWords"];

// Объёмы по уровням нагрузки:
//   newFactor — множитель дневной нормы новых слов;
//   sentences — длина текста для чтения (предложений);
//   questions — число вопросов на понимание в диалоге аудирования.
const VOLUME = {
  light: { newFactor: 0.5, sentences: 4, questions: 2 },
  normal: { newFactor: 1.0, sentences: 6, questions: 3 },
  heavy: { newFactor: 1.5, sentences: 8, questions: 4 },
};

// День второстепенного языка — база ЧУТЬ ПЛОТНЕЕ (навёрстывать), а НЕ урезаннее.
const CATCHUP = 1.25;
// Акцентный формат дня заметно объёмнее (эмфаза) и идёт первым среди учебных.
const ACCENT_BOOST = 1.5;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mod = (n, m) => ((Math.round(n) % m) + m) % m;

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

/** Акцент дня (какой формат ведущий) по календарному счётчику дня. */
export function accentForDay(rotationDay) {
  return ROTATION_FORMATS[mod(rotationDay, ROTATION_FORMATS.length)];
}

/**
 * Собирает занятие на сегодня — СТРУКТУРУ и ОБЪЁМ (задачи), а не статус.
 * Возвращает { level, accent, secondary, restDay?, blocks: [...], extras: [...] }.
 * Типы блоков: 'review' | 'reading' | 'newWords' | 'listening'. Блоки базы несут
 * accent (акцентный ли), у newWords в его акцентный день — random (случайные слова).
 *
 * reviewCount — СНИМОК числа созревших на сегодня (стабилен в течение дня); count
 * новых — ЦЕЛЬ дня (не остаток). Отметка «выполнено» считается снаружи.
 */
export function buildSession({
  reviewCount = 0,
  dailyNewLimit = 10,
  sessionLoad = "auto",
  isSecondaryDay = false, // мультирежим by_day: сегодня НЕ приоритетный язык
  restDay = false,
  readingAvailable = false,
  listeningAvailable = false,
  rotationDay = 0,
}) {
  const level = effectiveLevel(sessionLoad, dailyNewLimit, reviewCount);
  const vol = VOLUME[level] || VOLUME.normal;
  const review = Math.max(0, Number(reviewCount) || 0);
  // База второстепенному дню — плотнее (навёрстывать), приоритетному — обычная.
  const catchUp = isSecondaryDay ? CATCHUP : 1;
  const limit = Math.max(0, Number(dailyNewLimit) || 0);

  const blocks = [];
  // Повторения — всегда первыми, каждый день, в полном объёме, вне ротации.
  if (review > 0) blocks.push({ type: "review", count: review });

  // Выходной по расписанию: только повторения (+ предложение позаниматься в UI).
  if (restDay) {
    return { level, accent: null, secondary: isSecondaryDay, restDay: true, blocks, extras: [] };
  }

  // Порядок учебных форматов: акцент дня — первым, дальше по кругу ротации.
  const idx = mod(rotationDay, ROTATION_FORMATS.length);
  const order = ROTATION_FORMATS.map(
    (_, i) => ROTATION_FORMATS[mod(idx + i, ROTATION_FORMATS.length)],
  );
  const accent = order[0];

  // Объём формата: база (нагрузка) × плотнее второстепенному × эмфаза акцента.
  const volFor = (fmt, boostAccent) => {
    const boost = boostAccent && fmt === accent ? ACCENT_BOOST : 1;
    if (fmt === "newWords") {
      return { count: Math.max(1, Math.round(limit * vol.newFactor * catchUp * boost)) };
    }
    if (fmt === "reading") {
      return { sentences: clamp(Math.round(vol.sentences * catchUp * boost), 3, 8) };
    }
    return { questions: clamp(Math.round(vol.questions * catchUp * boost), 2, 4) };
  };

  // Новые слова — базовая активность, есть всегда; чтение/аудио — по доступности.
  const available = {
    listening: listeningAvailable,
    reading: readingAvailable,
    newWords: true,
  };

  // База: полный набор доступных форматов в порядке ротации (акцент первым).
  for (const fmt of order) {
    if (!available[fmt]) continue; // формата нет (офлайн/нет слов) — молча пропускаем
    const block = { type: fmt, ...volFor(fmt, true), accent: fmt === accent };
    // Акцент дня «новые слова» → случайные слова / «Удиви меня».
    if (fmt === "newWords" && accent === "newWords") block.random = true;
    blocks.push(block);
  }

  // ДОБАВКИ сверху: продолжить после базы. Приоритетному дню — больше (2),
  // второстепенному — одна (у него и так база плотнее). Объём добавок обычный
  // (без эмфазы акцента). Начинаем не с акцента — для разнообразия.
  const extraCount = isSecondaryDay ? 1 : 2;
  const extraPool = order.filter((f) => available[f]);
  const extras = [];
  for (let i = 0; extras.length < extraCount && extraPool.length > 0; i += 1) {
    const fmt = extraPool[mod(i + 1, extraPool.length)];
    extras.push({ type: fmt, extra: true, ...volFor(fmt, false) });
  }

  return { level, accent, secondary: isSecondaryDay, blocks, extras };
}
