import { useState } from "react";
import { LANG_EMOJI } from "../data/onboarding.js";
import { isoWeekday } from "../lib/weeklySchedule.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./WeekSchedule.css";

// Пара "de-ru" → код изучаемого языка "DE" (для точек недели).
function learnCode(pairKey) {
  return String(pairKey).split("-")[0].toUpperCase();
}

/**
 * Недельное расписание (фаза 4.5). Два режима одного компонента:
 *   • обзор (по умолчанию) — «Сегодня: немецкий» и семь точек-дней (read-only,
 *     используется в полосе на главном экране);
 *   • редактируемый (editable) — по каждому дню можно ТАПНУТЬ и выбрать другой
 *     активный язык или «выходной». Раскладка изначально заполнена автоматически
 *     (buildWeeklySchedule), редактирование лишь меняет отдельные дни; формат
 *     хранения (weekly_schedule) тот же. Используется на экране «Мои языки».
 *
 * Рендерится только при multiLangMode=true и scheduleMode='by_day'.
 * editable    — включает выбор языка по тапу на день;
 * languages   — активные пары [{ learnLang, nativeLang }] для меню выбора;
 * onChangeDay — (day 1..7, pairKey|null) → сохранить новый язык дня (или выходной).
 */
export default function WeekSchedule({
  schedule,
  editable = false,
  languages = [],
  onChangeDay,
}) {
  const { t } = useI18n();
  const [editingDay, setEditingDay] = useState(null);
  if (!schedule) return null;

  const todayIso = isoWeekday(new Date());
  const todayPair = schedule[String(todayIso)] || null;
  const dayNames = t("schedule.days"); // массив ["Пн", …, "Вс"]

  const todayLabel = todayPair
    ? t("schedule.today", { lang: t(`lang.${todayPair.split("-")[0]}`) })
    : t("schedule.restToday");

  function choose(day, pairKey) {
    setEditingDay(null);
    if (onChangeDay) onChangeDay(day, pairKey);
  }

  return (
    <div className="week" role="group" aria-label={t("schedule.aria")}>
      <p className="week__today">
        {todayPair && (
          <span aria-hidden="true">
            {LANG_EMOJI[todayPair.split("-")[0]] || "🌐"}{" "}
          </span>
        )}
        {todayLabel}
      </p>

      <div className="week__dots">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => {
          const pair = schedule[String(d)] || null;
          const cls =
            "week__dot" +
            (d === todayIso ? " is-today" : "") +
            (pair ? "" : " is-off") +
            (editable ? " week__dot--edit" : "") +
            (editingDay === d ? " is-editing" : "");
          const content = (
            <>
              <span className="week__dot-day">{dayNames[d - 1]}</span>
              <span className="week__dot-lang">
                {pair ? learnCode(pair) : "—"}
              </span>
            </>
          );
          return editable ? (
            <button
              key={d}
              type="button"
              className={cls}
              aria-label={t("schedule.editDay", { day: dayNames[d - 1] })}
              aria-expanded={editingDay === d}
              onClick={() => setEditingDay(editingDay === d ? null : d)}
            >
              {content}
            </button>
          ) : (
            <span key={d} className={cls}>
              {content}
            </span>
          );
        })}
      </div>

      {/* Меню выбора языка для выбранного дня (только в редактируемом режиме) */}
      {editable && editingDay !== null && (
        <div className="week__picker" role="group">
          <p className="week__picker-title">
            {t("schedule.pickForDay", { day: dayNames[editingDay - 1] })}
          </p>
          <div className="week__picker-options">
            {languages.map((l) => {
              const key = `${l.learnLang}-${l.nativeLang}`;
              const active = (schedule[String(editingDay)] || null) === key;
              return (
                <button
                  key={key}
                  type="button"
                  className={"week__opt" + (active ? " is-active" : "")}
                  aria-pressed={active}
                  onClick={() => choose(editingDay, key)}
                >
                  <span aria-hidden="true">{LANG_EMOJI[l.learnLang] || "🌐"} </span>
                  {t(`lang.${l.learnLang}`)}
                </button>
              );
            })}
            {/* Выходной — день без языка (null) */}
            <button
              type="button"
              className={
                "week__opt week__opt--off" +
                ((schedule[String(editingDay)] || null) === null
                  ? " is-active"
                  : "")
              }
              aria-pressed={(schedule[String(editingDay)] || null) === null}
              onClick={() => choose(editingDay, null)}
            >
              🌙 {t("schedule.restOption")}
            </button>
          </div>
        </div>
      )}

      {editable && (
        <p className="week__hint">{t("schedule.editHint")}</p>
      )}
    </div>
  );
}
