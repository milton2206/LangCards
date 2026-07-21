// Выбор формы множественного числа по языку. Возвращает "one" | "few" | "many"
// — ключи, по которым в словаре лежат нужные формы слова.
//
// ru и uk используют славянское правило (1 дом / 2 дома / 5 домов).
// en — простое one/other (1 word / 2 words); "few" там не используется, но при
// n≠1 возвращаем "many", чтобы попасть в общую форму словаря.
export function pluralForm(lang, n) {
  const abs = Math.abs(Number(n) || 0);
  if (lang === "en") return abs === 1 ? "one" : "many";
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return "one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "few";
  return "many";
}
