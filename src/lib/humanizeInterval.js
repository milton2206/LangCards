// Склонение русского существительного по числу: 1 день, 2 дня, 5 дней.
export function pluralRu(n, one, few, many) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

/**
 * Превращает интервал в днях в человекопонятную подпись: "завтра",
 * "через 3 дня", "через 2 недели", "через 4 месяца" и т.д. Для дней
 * использует точное число; недели/месяцы/годы — округление до целого,
 * т.к. это ориентир, а не точная дата.
 */
export function humanizeInterval(days) {
  if (days <= 0) return "сегодня";
  if (days === 1) return "завтра";
  if (days < 7) {
    return `через ${days} ${pluralRu(days, "день", "дня", "дней")}`;
  }
  if (days < 30) {
    const weeks = Math.max(1, Math.round(days / 7));
    return `через ${weeks} ${pluralRu(weeks, "неделю", "недели", "недель")}`;
  }
  if (days < 365) {
    const months = Math.max(1, Math.round(days / 30));
    return `через ${months} ${pluralRu(months, "месяц", "месяца", "месяцев")}`;
  }
  const years = Math.max(1, Math.round(days / 365));
  return `через ${years} ${pluralRu(years, "год", "года", "лет")}`;
}
