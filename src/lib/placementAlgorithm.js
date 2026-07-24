// Адаптивный алгоритм теста на уровень (фаза 6.3). Здесь только чистые функции:
// экран (PlacementScreen) хранит историю ответов и спрашивает у них, что делать
// дальше и чем всё закончилось.
//
// ---------------------------------------------------------------------------
// ПРАВИЛО ЛЕСТНИЦЫ (1 вверх / 1 вниз)
// ---------------------------------------------------------------------------
// Стартуем с A2: верный ответ — сразу B1, ошибка — A1. То есть первые же два
// задания попадают в диапазон A2/B1, откуда лестница быстро уходит к правде.
// Дальше просто: верно → на уровень сложнее, ошибка → на уровень легче (края
// шкалы зажаты, ниже A1 и выше C1 идти некуда).
//
// Такая лестница по построению «болтается» вокруг уровня, на котором человек
// отвечает примерно 50/50, — это и есть граница его возможностей.
//
// ---------------------------------------------------------------------------
// ПРАВИЛО ОСТАНОВКИ: 15 заданий всегда, до 18 — если лестница ещё не устоялась
// ---------------------------------------------------------------------------
// Первые задания уходят на спуск/подъём от произвольного старта, поэтому
// меньше 15 мерить нечего. После 15-го смотрим на последние 6 заданий: если все
// они уложились в два соседних уровня (max − min ≤ 1), лестница устоялась —
// колебание вокруг одной границы, и следующие задания ничего не уточнят.
// Если разброс больше (человека ещё мотает по шкале), даём до 18 заданий.
// Верхнюю границу держим жёстко: тест не должен превращаться в экзамен.
//
// ---------------------------------------------------------------------------
// ПОДСЧЁТ: самый высокий уровень, где человек берёт больше половины заданий
// ---------------------------------------------------------------------------
// Считаем по уровням: сколько заданий каждого уровня задали и сколько взято.
// Итог — САМЫЙ ВЫСОКИЙ уровень, где задано хотя бы 2 задания и верных больше
// половины (порог PASS_RATE). Уровни с одним заданием не считаем: одна удача
// или одна оплошность не должны решать исход.
//
// Почему не «уровень, вокруг которого болтается лестница»: вариантов ответа
// четыре, то есть около четверти верных ответов даёт чистое угадывание.
// Из-за этого лестница 1/1 устаканивается ЗАМЕТНО ВЫШЕ реального уровня, и
// оценка по точкам разворота систематически завышала результат на слабых
// уровнях и занижала у самого потолка (проверено симуляцией: A1 угадывался
// в 8% случаев, C1 — в 22%). Правило «больше половины на самом высоком уровне»
// на тех же прохождениях даёт 51–72% точных попаданий и 89–99% попаданий
// в пределах соседнего уровня, без систематического сдвига вверх или вниз.
//
// Порог именно «больше половины», а не «почти всё»: при четырёх вариантах
// 55% верных — это уже заметно выше угадывания (25%), а требовать 80% значило
// бы отправлять на A1 людей, которые уровень в целом держат.
//
// И финальный предохранитель: оценка не может быть выше самого сложного уровня,
// на котором человек хоть раз ответил верно. Без него серия «повезло-не повезло»
// могла бы поднять результат до уровня, который человек ни разу не взял.
//
// Крайние случаи выходят сами собой: всё верно → C1, всё неверно → A1,
// «тыкал наугад» → A1 в 89% прохождений.

export const PLACEMENT_LEVELS = ["a1", "a2", "b1", "b2", "c1"];

// Старт: A2 (индекс 1) — см. правило лестницы выше.
export const START_LEVEL_INDEX = 1;

// Границы длины теста.
export const MIN_ITEMS = 15;
export const MAX_ITEMS = 18;

// Окно, по которому проверяем «лестница устоялась».
const SETTLE_WINDOW = 6;

// Порог «уровень взят»: больше половины верных при четырёх вариантах ответа.
const PASS_RATE = 0.55;
// Сколько заданий уровня нужно, чтобы вообще судить о нём.
const MIN_ITEMS_PER_LEVEL = 2;

export const clampLevelIndex = (i) =>
  Math.max(0, Math.min(PLACEMENT_LEVELS.length - 1, i));

export const levelIdOf = (index) => PLACEMENT_LEVELS[clampLevelIndex(index)];
export const levelIndexOf = (id) => {
  const i = PLACEMENT_LEVELS.indexOf(id);
  return i === -1 ? START_LEVEL_INDEX : i;
};

/** Следующий уровень сложности: верно → сложнее, ошибка → легче. */
export function nextLevelIndex(currentIndex, correct) {
  return clampLevelIndex(currentIndex + (correct ? 1 : -1));
}

/**
 * Устоялась ли лестница: последние SETTLE_WINDOW заданий уложились в два
 * соседних уровня. history: [{ levelIndex, correct }].
 */
export function isSettled(history) {
  if (history.length < SETTLE_WINDOW) return false;
  const window = history.slice(-SETTLE_WINDOW).map((h) => h.levelIndex);
  return Math.max(...window) - Math.min(...window) <= 1;
}

/** Пора ли заканчивать (см. правило остановки). */
export function shouldStop(history) {
  if (history.length >= MAX_ITEMS) return true;
  return history.length >= MIN_ITEMS && isSettled(history);
}

/**
 * Итоговый уровень по истории ответов: { levelIndex, levelId, correctCount }.
 * Подробности правила — в шапке файла.
 */
export function estimateLevel(history) {
  const total = history.length;
  const correctCount = history.filter((h) => h.correct).length;
  if (total === 0) {
    return { levelIndex: START_LEVEL_INDEX, levelId: levelIdOf(START_LEVEL_INDEX), correctCount: 0 };
  }

  // Статистика по уровням: сколько задано и сколько взято.
  const stats = PLACEMENT_LEVELS.map(() => ({ asked: 0, correct: 0 }));
  for (const answer of history) {
    const s = stats[clampLevelIndex(answer.levelIndex)];
    s.asked += 1;
    if (answer.correct) s.correct += 1;
  }
  const taken = (i) =>
    stats[i].asked > 0 && stats[i].correct / stats[i].asked >= PASS_RATE;

  // Самый высокий уровень, где заданий достаточно и взято больше половины.
  let estimate = null;
  for (let i = PLACEMENT_LEVELS.length - 1; i >= 0; i -= 1) {
    if (stats[i].asked >= MIN_ITEMS_PER_LEVEL && taken(i)) {
      estimate = i;
      break;
    }
  }

  if (estimate === null) {
    // Ни один уровень не взят уверенно. Последний шанс — самый простой из
    // опробованных (там могло быть всего одно задание); иначе честно A1.
    const tried = stats
      .map((s, i) => (s.asked > 0 ? i : -1))
      .filter((i) => i >= 0);
    const lowest = tried.length > 0 ? Math.min(...tried) : 0;
    estimate = taken(lowest) ? lowest : 0;
  }

  // Предохранитель: не выше самого сложного взятого уровня.
  const maxCorrect = history.reduce(
    (max, h) => (h.correct && h.levelIndex > max ? h.levelIndex : max),
    0,
  );
  estimate = clampLevelIndex(Math.min(estimate, maxCorrect));

  return { levelIndex: estimate, levelId: levelIdOf(estimate), correctCount };
}

/**
 * Выбор следующего задания: непоказанное задание нужного уровня, а если на этом
 * уровне запас кончился — ближайшего по сложности (тест не должен обрываться
 * из-за того, что банк на одном уровне тоньше). Возвращает задание или null,
 * если непоказанных не осталось вовсе.
 *
 * itemsByLevel: { a1: [...], a2: [...], … }; usedIds: Set.
 */
export function pickItem(itemsByLevel, targetIndex, usedIds) {
  const order = [];
  for (let d = 0; d < PLACEMENT_LEVELS.length; d += 1) {
    // Ближайшие уровни, начиная с целевого: 0, −1, +1, −2, +2 …
    // (вниз раньше вверх — лучше задать чуть проще, чем перепрыгнуть вверх).
    if (d === 0) order.push(targetIndex);
    else order.push(targetIndex - d, targetIndex + d);
  }

  for (const index of order) {
    if (index < 0 || index >= PLACEMENT_LEVELS.length) continue;
    const pool = (itemsByLevel[PLACEMENT_LEVELS[index]] || []).filter(
      (item) => !usedIds.has(item.id),
    );
    if (pool.length > 0) {
      const item = pool[Math.floor(Math.random() * pool.length)];
      // levelIndex — уровень ЗАДАНИЯ (может отличаться от целевого, если банк
      // на целевом уровне закончился): считать надо по фактической сложности.
      return { ...item, levelIndex: index };
    }
  }
  return null;
}
