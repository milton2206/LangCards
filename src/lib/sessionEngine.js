// ============================================================================
// Движок заданий: приложение само собирает занятие на сегодня. Чистая функция —
// вся логика тестируется без UI и без сети.
// ----------------------------------------------------------------------------
// ПРИНЦИП: «полная база всегда, но с ротацией + добавки сверху».
//   • Повторения ВСЕГДА первыми, каждый день, в ПОЛНОМ объёме — вне ротации.
//   • База каждый день ПОЛНАЯ (все доступные форматы: чтение, новые слова,
//     аудирование), но не одинаковая: АКЦЕНТ дня ротируется по календарю —
//     сегодня аудирование, завтра чтение, послезавтра случайные новые слова —
//     и так по кругу. Акцентный формат идёт первым и заметно объёмнее.
//   • ДОБАВКИ сверху базы — «хотите ещё?»: приоритетному дню их больше
//     (приоритет через ДОБАВКИ, а не через урезание базы остальных).
//   • День ВТОРОСТЕПЕННОГО языка = база чуть ПЛОТНЕЕ (навёрстывать), а НЕ меньше.
//   • Форматы, которых нет (нет сети → нет текста/диалога), пропускаются молча.
//   • ДНЕВНАЯ НОРМА новых слов — ПОТОЛОК, а не отправная точка: акцент дня и
//     плотность второстепенного дня меняют, ЧЕМ наполнено занятие, но НИКОГДА
//     не просят новых слов больше, чем человек выбрал в настройках. Потолок
//     общий на день: и на базовый блок, и на добавки «хотите ещё?».
//
// Уровней нагрузки НЕТ: база адекватна сама по себе, хочешь больше — жмёшь
// «ещё» (добавки) или «хочу другое». Ползунок «легче/нормально/тяжелее» и
// profiles.session_load из логики убраны.
// ============================================================================

// Учебные форматы, по которым РОТИРУЕТСЯ акцент базы. Повторение сюда НЕ входит —
// оно вне ротации (всегда первое и полное). Порядок = порядок ротации по дням.
export const ROTATION_FORMATS = ["listening", "reading", "newWords"];

// Базовые объёмы (без уровней нагрузки — единственная адекватная база):
//   newFactor — множитель дневной нормы новых слов;
//   sentences — длина текста для чтения (предложений);
//   questions — число вопросов на понимание в диалоге аудирования.
const BASE = { newFactor: 1, sentences: 6, questions: 3 };

// День второстепенного языка — база ЧУТЬ ПЛОТНЕЕ (навёрстывать), а НЕ урезаннее.
const CATCHUP = 1.25;
// Акцентный формат дня заметно объёмнее (эмфаза) и идёт первым среди учебных.
const ACCENT_BOOST = 1.5;

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const mod = (n, m) => ((Math.round(n) % m) + m) % m;

/** Акцент дня (какой формат ведущий) по календарному счётчику дня. */
export function accentForDay(rotationDay) {
  return ROTATION_FORMATS[mod(rotationDay, ROTATION_FORMATS.length)];
}

/**
 * Собирает занятие на сегодня — СТРУКТУРУ и ОБЪЁМ (задачи), а не статус.
 * Возвращает { accent, secondary, restDay?, blocks: [...], extras: [...] }.
 * Типы блоков: 'review' | 'reading' | 'newWords' | 'listening'. Блоки базы несут
 * accent (акцентный ли), у newWords в его акцентный день — random (случайные слова).
 *
 * reviewCount — СНИМОК числа созревших на сегодня (стабилен в течение дня); count
 * новых — ЦЕЛЬ дня (не остаток). Отметка «выполнено» считается снаружи.
 */
export function buildSession({
  reviewCount = 0,
  dailyNewLimit = 10,
  isSecondaryDay = false, // мультирежим by_day: сегодня НЕ приоритетный язык
  restDay = false,
  readingAvailable = false,
  listeningAvailable = false,
  rotationDay = 0,
  // Свободные места под активные слова. Ноль — блок новых слов в план НЕ
  // попадает вовсе: предлагать взять слова, которые некуда положить, значит
  // выдавать заведомо невыполнимое задание. Повторения от этого не зависят
  // НИКОГДА и идут в полном объёме.
  freeSlots = Infinity,
}) {
  const review = Math.max(0, Number(reviewCount) || 0);
  // База второстепенному дню — плотнее (навёрстывать), приоритетному — обычная.
  const catchUp = isSecondaryDay ? CATCHUP : 1;
  const limit = Math.max(0, Number(dailyNewLimit) || 0);

  const blocks = [];
  // Повторения — всегда первыми, каждый день, в полном объёме, вне ротации.
  if (review > 0) blocks.push({ type: "review", count: review });

  // Выходной по расписанию: только повторения (+ предложение позаниматься в UI).
  if (restDay) {
    return {
      accent: null,
      secondary: isSecondaryDay,
      restDay: true,
      blocks,
      extras: [],
      noRoomForNew: false, // в выходной новых слов нет и без лимита
    };
  }

  // Порядок учебных форматов: акцент дня — первым, дальше по кругу ротации.
  const idx = mod(rotationDay, ROTATION_FORMATS.length);
  const order = ROTATION_FORMATS.map(
    (_, i) => ROTATION_FORMATS[mod(idx + i, ROTATION_FORMATS.length)],
  );
  const accent = order[0];

  // Объём формата: база × плотнее второстепенному × эмфаза акцента.
  // newCap — сколько новых слов ещё можно попросить (остаток дневной нормы).
  const volFor = (fmt, boostAccent, newCap = limit) => {
    const boost = boostAccent && fmt === accent ? ACCENT_BOOST : 1;
    if (fmt === "newWords") {
      const wanted = Math.round(limit * BASE.newFactor * catchUp * boost);
      // Норма — ПОТОЛОК: надбавки за акцент и за второстепенный день меняют,
      // ЧЕМ наполнен день, но выше выбранного числа не поднимают. Больше, чем
      // поместится, тоже не просим: цель «Новые слова · 15» при трёх свободных
      // местах — невыполнимое задание, только тише.
      return { count: Math.max(1, Math.min(wanted, newCap, freeSlots)) };
    }
    if (fmt === "reading") {
      return { sentences: clamp(Math.round(BASE.sentences * catchUp * boost), 3, 8) };
    }
    return { questions: clamp(Math.round(BASE.questions * catchUp * boost), 2, 4) };
  };

  // Новые слова — базовая активность, но только пока есть куда их класть;
  // чтение/аудио — по доступности.
  const roomForNew = !Number.isFinite(freeSlots) || freeSlots > 0;
  const available = {
    listening: listeningAvailable,
    reading: readingAvailable,
    newWords: roomForNew,
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
  //
  // Потолок новых слов ОБЩИЙ на день: сколько уже просит база, столько добавке
  // не достаётся. Обычно база выбирает норму целиком — тогда «ещё новых слов»
  // не предлагаем вовсе (предложим другой формат), и день остаётся в норме.
  const baseNew = blocks.find((b) => b.type === "newWords")?.count || 0;
  const extraNewCap = Math.max(0, Math.min(limit, freeSlots) - baseNew);
  const extraCount = isSecondaryDay ? 1 : 2;
  const extraPool = order.filter(
    (f) => available[f] && (f !== "newWords" || extraNewCap > 0),
  );
  // Добавок не больше, чем доступных форматов: иначе, когда формат остался один
  // (нет сети, а новые слова уже выбраны нормой), «хотите ещё?» предложило бы
  // одно и то же дважды.
  const extras = [];
  const wantExtras = Math.min(extraCount, extraPool.length);
  for (let i = 0; extras.length < wantExtras; i += 1) {
    const fmt = extraPool[mod(i + 1, extraPool.length)];
    extras.push({ type: fmt, extra: true, ...volFor(fmt, false, extraNewCap) });
  }

  return {
    accent,
    secondary: isSecondaryDay,
    blocks,
    extras,
    // Блок новых слов выпал ИМЕННО из-за нехватки мест (а не потому, что
    // формата нет) — экран занятия объясняет это строкой вместо блока.
    noRoomForNew: !roomForNew,
  };
}
