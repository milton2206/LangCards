// Баланс дневной нагрузки (фаза 4.3): делим общий дневной бюджет НОВЫХ слов
// между активными языковыми парами.
//
// Алгоритм «приоритет + пропорциональный остаток»:
//   L_i    — daily_new_limit пары (из user_languages, настройка пользователя);
//   B      — общий бюджет дня: B = Σ L_i по всем активным парам
//            (перераспределяем НАСТРОЕННУЮ ёмкость, суммарная нагрузка не растёт);
//   приоритетная пара p: quota_p = round(B × PRIORITY_SHARE);
//   остальные делят остаток R = B − quota_p пропорционально СВОИМ лимитам:
//            quota_i = round(R × L_i / Σ L_j по остальным), минимум 1,
//            последняя пара получает точный остаток (сумма сходится к B).
//
// Пример (3 языка): DE(приоритет, L=10), EN(L=10), EL(L=6) → B = 26.
//   quota_DE = round(26 × 0.6) = 16;  R = 10;
//   quota_EN = round(10 × 10/16) = 6; quota_EL = 10 − 6 = 4.
//   Итого «Сегодня: DE 16 · EN 6 · EL 4» — приоритет получил бóльшую долю,
//   общая дневная нагрузка осталась 26 (как настроил пользователь).
//
// Особые случаи: одна активная пара (или multiLangMode=false) — баланса нет,
// квота = собственный лимит пары. Повторения (SRS) сюда НЕ входят и не режутся.

// Доля общего бюджета для приоритетной пары. Именованная константа-коэффициент;
// сами лимиты приходят из настроек (user_languages.daily_new_limit).
export const PRIORITY_SHARE = 0.6;

// Дефолт на случай отсутствия лимита в данных (совпадает с DEFAULT в БД).
const FALLBACK_LIMIT = 10;

const keyOf = (l) => `${l.learnLang}-${l.nativeLang}`;
const limitOf = (l) =>
  Math.max(1, Number(l.dailyNewLimit) > 0 ? Number(l.dailyNewLimit) : FALLBACK_LIMIT);

/**
 * Считает дневные квоты новых слов по активным парам.
 * languages — массив из useUserLanguages (уже только активные пары).
 * Возвращает { "de-ru": 16, "en-ru": 6, ... }.
 */
export function computeDailyQuotas(languages) {
  const active = languages || [];
  if (active.length === 0) return {};

  // Одна пара — делить нечего: её собственный лимит и есть квота.
  if (active.length === 1) {
    return { [keyOf(active[0])]: limitOf(active[0]) };
  }

  const priority = active.find((l) => l.isPriority) || active[0];
  const others = active.filter((l) => l !== priority);
  const budget = active.reduce((sum, l) => sum + limitOf(l), 0);

  const quotas = {};
  const priorityQuota = Math.max(1, Math.round(budget * PRIORITY_SHARE));
  quotas[keyOf(priority)] = priorityQuota;

  // Остаток делится пропорционально лимитам остальных; последняя пара получает
  // точный остаток, чтобы сумма всегда сходилась к бюджету.
  const rest = Math.max(others.length, budget - priorityQuota);
  const othersSum = others.reduce((sum, l) => sum + limitOf(l), 0);
  let distributed = 0;
  others.forEach((l, i) => {
    let q;
    if (i === others.length - 1) {
      q = Math.max(1, rest - distributed);
    } else {
      q = Math.max(1, Math.round((rest * limitOf(l)) / othersSum));
      distributed += q;
    }
    quotas[keyOf(l)] = q;
  });

  return quotas;
}
