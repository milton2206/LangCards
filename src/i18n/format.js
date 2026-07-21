import { pluralForm } from "./plural.js";

// Человекопонятный интервал повторения через словарь переводов.
// t — функция перевода из useI18n; lang — активный язык (для формы числа).
// Дни показываем точно; недели/месяцы/годы — округляем (это ориентир, не дата).
export function formatInterval(t, lang, days) {
  if (days <= 0) return t("interval.today");
  if (days === 1) return t("interval.tomorrow");

  let unit;
  let n;
  if (days < 7) {
    unit = "days";
    n = days;
  } else if (days < 30) {
    unit = "weeks";
    n = Math.max(1, Math.round(days / 7));
  } else if (days < 365) {
    unit = "months";
    n = Math.max(1, Math.round(days / 30));
  } else {
    unit = "years";
    n = Math.max(1, Math.round(days / 365));
  }
  return t(`interval.${unit}.${pluralForm(lang, n)}`, { n });
}
