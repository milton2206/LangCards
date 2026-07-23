// Недельное расписание языков (фаза 4.5): раскладка активных пар по дням
// недели. Один день — один язык; приоритетный встречается чаще.
//
// Алгоритм из трёх шагов:
//
// ШАГ 1 — сколько дней каждому языку (n языков, D учебных дней):
//   • n == 1 → все D дней ему;
//   • n >= D → по одному дню первым D языкам (приоритетный первым),
//     остальным 0 (дней меньше, чем языков, — «чаще» невозможно);
//   • иначе приоритетный получает СТРОГО больше остальных:
//       q = floor(D/n) + 1; пока q <= ceil((D−q)/(n−1)) и q < D−(n−1): q++
//       (минимальное q, при котором q больше максимума остальных,
//        но всем остальным достаётся минимум по одному дню);
//     остальные делят остаток R = D − q как можно ровнее:
//       base = floor(R/(n−1)), первые (R mod (n−1)) языков получают base+1.
//
// ШАГ 2 — какие дни недели учебные: равномерно по неделе, а не подряд:
//   день_i = round(i × 7 / D) + 1, i = 0..D−1 (коллизии добираются ближайшими).
//
// ШАГ 3 — какой язык в какой день: жадная укладка без соседних повторов —
//   в каждый учебный день ставим язык с НАИБОЛЬШИМ остатком дней, пропуская
//   вчерашний, если есть альтернатива (при равенстве — приоритетный раньше).
//
// Примеры:
//   3 языка (DE приоритет, EN, EL) на 5 дней: q=3 → DE 3, EN 1, EL 1;
//     дни [пн,вт,чт,пт,вс] → пн DE, вт EN, чт DE, пт EL, вс DE.
//   2 языка (DE приоритет, EN) на 3 дня: q=2 → DE 2, EN 1;
//     дни [пн,ср,сб] → пн DE, ср EN, сб DE.
//   4 языка (DE приоритет, EN, EL, ES) на 7 дней: q=3 → DE 3, EN 2, EL 1, ES 1;
//     дни [пн..вс] → DE, EN, DE, EL, DE, EN, ES.
//
// Раскладка пересчитывается при добавлении/удалении языка, смене приоритета и
// числа учебных дней (эффект в App). Повторения (SRS) расписанию НЕ подчиняются.

const keyOf = (l) => `${l.learnLang}-${l.nativeLang}`;

// День недели по локальной дате: 1=пн … 7=вс (getDay: 0=вс … 6=сб).
export function isoWeekday(date = new Date()) {
  return ((date.getDay() + 6) % 7) + 1;
}

// ШАГ 1: [{ pairKey, days }] — приоритетный первым.
export function computeDayCounts(languages, studyDays) {
  const n = (languages || []).length;
  const D = Math.max(1, Math.min(7, studyDays || 7));
  if (n === 0) return [];

  const priority = languages.find((l) => l.isPriority) || languages[0];
  const others = languages.filter((l) => l !== priority);
  const ordered = [priority, ...others];

  if (n === 1) return [{ pairKey: keyOf(priority), days: D }];

  if (n >= D) {
    // Дней меньше (или столько же), чем языков: по одному первым D языкам.
    return ordered.map((l, i) => ({ pairKey: keyOf(l), days: i < D ? 1 : 0 }));
  }

  // Минимальное q, при котором приоритет СТРОГО чаще остальных.
  let q = Math.floor(D / n) + 1;
  const maxOther = (qq) => Math.ceil((D - qq) / (n - 1));
  while (q < D - (n - 1) && q <= maxOther(q)) q += 1;
  q = Math.min(q, D - (n - 1));

  const rest = D - q;
  const base = Math.floor(rest / (n - 1));
  const extra = rest % (n - 1);

  return [
    { pairKey: keyOf(priority), days: q },
    ...others.map((l, i) => ({
      pairKey: keyOf(l),
      days: base + (i < extra ? 1 : 0),
    })),
  ];
}

// ШАГ 2: учебные дни недели (1..7), равномерно распределённые.
export function pickStudyDays(studyDays) {
  const D = Math.max(1, Math.min(7, studyDays || 7));
  const days = new Set();
  for (let i = 0; i < D; i += 1) {
    days.add(Math.round((i * 7) / D) + 1);
  }
  // Коллизии округления добираем ближайшими свободными днями.
  let d = 1;
  while (days.size < D && d <= 7) {
    days.add(d);
    d += 1;
  }
  return [...days].sort((a, b) => a - b);
}

// ШАГ 3: полная раскладка недели { "1": "de-ru" | null, … "7": … }.
export function buildWeeklySchedule(languages, studyDays) {
  const schedule = {};
  for (let d = 1; d <= 7; d += 1) schedule[String(d)] = null;

  const counts = computeDayCounts(languages, studyDays);
  if (counts.length === 0) return schedule;

  const remaining = new Map(counts.map((c) => [c.pairKey, c.days]));
  // Порядок предпочтения при равных остатках: приоритетный раньше.
  const order = counts.map((c) => c.pairKey);
  const slots = pickStudyDays(studyDays);

  let prev = null;
  for (const day of slots) {
    // Кандидаты с остатком дней; вчерашний язык пропускаем, если есть выбор.
    const withDays = order.filter((k) => (remaining.get(k) || 0) > 0);
    if (withDays.length === 0) break;
    const preferred = withDays.filter((k) => k !== prev);
    const pool = preferred.length > 0 ? preferred : withDays;
    // Наибольший остаток; при равенстве — более ранний в order (приоритетный).
    let pick = pool[0];
    for (const k of pool) {
      if ((remaining.get(k) || 0) > (remaining.get(pick) || 0)) pick = k;
    }
    schedule[String(day)] = pick;
    remaining.set(pick, (remaining.get(pick) || 0) - 1);
    prev = pick;
  }

  return schedule;
}

// Пара, назначенная на сегодня (или null — выходной/расписания нет).
export function todayScheduledPair(schedule, date = new Date()) {
  if (!schedule) return null;
  return schedule[String(isoWeekday(date))] || null;
}
