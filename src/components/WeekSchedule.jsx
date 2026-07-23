import { LANG_EMOJI } from "../data/onboarding.js";
import { isoWeekday } from "../lib/weeklySchedule.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./WeekSchedule.css";

// Пара "de-ru" → код изучаемого языка "DE" (для точек недели).
function learnCode(pairKey) {
  return String(pairKey).split("-")[0].toUpperCase();
}

/**
 * Обзор недельного расписания (фаза 4.5): строка «Сегодня: немецкий» и семь
 * точек с кодами языков (выходные приглушены, сегодняшний день подсвечен).
 * Рендерится только при multiLangMode=true и scheduleMode='by_day' — в
 * остальных режимах App этот компонент не передаёт (см. CardScreen).
 */
export default function WeekSchedule({ schedule }) {
  const { t } = useI18n();
  if (!schedule) return null;

  const todayIso = isoWeekday(new Date());
  const todayPair = schedule[String(todayIso)] || null;
  const dayNames = t("schedule.days"); // массив ["Пн", …, "Вс"]

  const todayLabel = todayPair
    ? t("schedule.today", {
        lang: t(`lang.${todayPair.split("-")[0]}`),
      })
    : t("schedule.restToday");

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
          return (
            <span
              key={d}
              className={
                "week__dot" +
                (d === todayIso ? " is-today" : "") +
                (pair ? "" : " is-off")
              }
            >
              <span className="week__dot-day">{dayNames[d - 1]}</span>
              <span className="week__dot-lang">
                {pair ? learnCode(pair) : "—"}
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
