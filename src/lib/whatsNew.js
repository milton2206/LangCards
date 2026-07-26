// Логика экрана «Что нового»: решает, что показать при заходе, по last_seen.
//
// ВАЖНО про last_seen: здесь его только ЧИТАЕМ, чтобы узнать дату прошлого
// захода. Обновлением last_seen занимается presence.touchLastSeen — его НЕ
// трогаем. Чтобы не поймать уже перезаписанное «сейчас», вызывающий код читает
// это ДО touchLastSeen (см. App.jsx).

import { supabase } from "./supabase.js";
import { CHANGELOG } from "../data/changelog.js";

/**
 * Что показать пользователю при заходе. Возвращает:
 *   { mode: "greeting" }             — первый вход (last_seen пуст): короткое
 *                                      приветствие вместо списка изменений;
 *   { mode: "list", entries: [...] } — вернувшийся: записи новее прошлого захода
 *                                      (новые сверху);
 *   null                             — вернувшийся без новых записей, офлайн или
 *                                      Supabase не настроен → не показываем ничего.
 *
 * entries — элементы CHANGELOG ({ id, date }); заголовок/описание резолвит UI
 * по i18n-ключам whatsnew.entries.<id>.*.
 */
export async function resolveWhatsNew(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("last_seen")
      .eq("id", userId)
      .maybeSingle();
    if (error) return null;

    const lastSeen = data?.last_seen ?? null;
    // Первый вход: базовой отметки нет — показываем приветствие, а не свалку всех
    // изменений. (Существующие пользователи с ещё не заполненным last_seen тоже
    // сюда попадают один раз — это осознанно: сравнивать не с чем.)
    if (!lastSeen) return { mode: "greeting" };

    // Сравнение по ТОЧНОЙ МЕТКЕ ВРЕМЕНИ, а не по дню: показываем записи, чья
    // дата-время строго новее last_seen пользователя. Так не теряется релиз
    // того же дня (что был раньше, при сравнении по дню) и нет зависимости от
    // часового пояса — момент времени абсолютен. Даты «только день» трактуются
    // как полночь UTC (new Date разбирает оба формата). Сортировка — новые сверху.
    const lastMs = new Date(lastSeen).getTime();
    const entries = CHANGELOG.filter(
      (e) => new Date(e.date).getTime() > lastMs,
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    if (entries.length === 0) return null; // нечего показать — ничего не показываем
    return { mode: "list", entries };
  } catch {
    return null;
  }
}
