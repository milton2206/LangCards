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
    // Первый вход: базовой даты нет — показываем приветствие, а не свалку всех
    // изменений. (Существующие пользователи с ещё не заполненным last_seen тоже
    // сюда попадают один раз — это осознанно: сравнивать не с чем.)
    if (!lastSeen) return { mode: "greeting" };

    // Дата прошлого захода (день, UTC) — с ней сравниваем даты записей.
    const lastDate = new Date(lastSeen).toISOString().slice(0, 10);
    // Сортировка по дате, новые сверху; при равной дате СТАБИЛЬНА (возвращаем 0) —
    // сохраняется курируемый порядок массива CHANGELOG (Array.sort стабилен).
    const entries = CHANGELOG.filter((e) => e.date > lastDate).sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
    if (entries.length === 0) return null; // нечего показать — ничего не показываем
    return { mode: "list", entries };
  } catch {
    return null;
  }
}
