// ============================================================================
// «Тема исчерпана»: когда по одной и той же теме подряд приходит недобор, слов
// по ней у модели больше нет. Это НЕ сбой и не повод чинить генерацию — пул
// выражений на тройке «язык × уровень × тема» конечен (по замеру ~20–30), и
// рано или поздно человек его вычерпывает. Здесь только УЧЁТ этого факта:
// сколько раз подряд был недобор и по какой теме.
// ----------------------------------------------------------------------------
// Логику генерации, запаса и дедупликации модуль не трогает вовсе — он лишь
// читает исход («полная пачка / недобор»), который считает useCards.
//
// Ключ учёта — язык + уровень + тема + ТИП КОНТЕНТА. Тип добавлен к названной
// тройке намеренно: «Контекст носителей» и обычные слова берут из разных пулов,
// и вычерпанные идиомы по «медицине» ещё не значат, что кончились обычные слова
// по ней же. Иначе тема менялась бы раньше, чем нужно.
// ============================================================================

const KEY = "topicExhaustion";

// Сколько недоборов подряд считаем доказательством, что тема кончилась. Один
// недобор — ещё не приговор: модель могла просто неудачно ответить, а запас
// (см. useCards) в следующий раз всё выправит. Два подряд — уже закономерность.
export const SHORTFALLS_TO_EXHAUST = 2;

// Сколько записей храним. Тройка «язык × уровень × тема» у одного человека
// исчисляется десятками; потолок нужен только чтобы хранилище не росло вечно.
const MAX_RECORDS = 60;

/** Ключ учёта. Тема — id пресета ИЛИ строка своей темы, годятся обе. */
export function topicKey({ pairKey, level, topic, mode }) {
  return [pairKey || "", level || "", topic || "", mode || "words"].join("|");
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    const data = raw ? JSON.parse(raw) : {};
    return data && typeof data === "object" ? data : {};
  } catch {
    return {};
  }
}

function save(data) {
  try {
    const entries = Object.entries(data);
    const trimmed =
      entries.length > MAX_RECORDS
        ? Object.fromEntries(entries.slice(entries.length - MAX_RECORDS))
        : data;
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    // переполнение хранилища — учёт не критичен, молча пропускаем
  }
}

/**
 * Записать исход генерации по ключу. full=true (пришла полная пачка) обнуляет
 * счётчик: значит, слова по теме ещё есть — например, человек удалил часть
 * своих слов или модель нашла новое.
 */
export function noteBatchResult(key, full) {
  if (!key) return 0;
  const data = load();
  const next = full ? 0 : (Number(data[key]) || 0) + 1;
  if (next === 0) delete data[key];
  else data[key] = next;
  save(data);
  return next;
}

/** Сколько недоборов подряд по этому ключу. */
export function shortfallStreak(key) {
  return Number(load()[key]) || 0;
}

/** Пора ли менять тему: недобор повторился достаточно раз. */
export function isExhausted(key) {
  return shortfallStreak(key) >= SHORTFALLS_TO_EXHAUST;
}

/**
 * Следующая тема вместо исчерпанной. Берём из тех же готовых тем и своих тем
 * пользователя — новых не выдумываем и список не трогаем. Своим отдаём
 * ПРЕДПОЧТЕНИЕ: человек их выбрал сам, значит они ему нужнее.
 *
 * Возвращает тему или null, если менять не на что (всё вычерпано) — тогда
 * интерфейс предложит задать свою, и это честнее подсунутой пустой темы.
 */
export function pickNextTopic({
  current,
  presetIds = [],
  customTopics = [],
  pairKey,
  level,
  mode,
}) {
  const candidates = [...customTopics, ...presetIds].filter(
    (topic) => topic && topic !== current,
  );
  return (
    candidates.find(
      (topic) => !isExhausted(topicKey({ pairKey, level, topic, mode })),
    ) || null
  );
}
