import { MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./StatsScreen.css";

// Донат-диаграмма прогресса через приём stroke-dasharray (без библиотек).
const RADIUS = 70;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Экран статистики по текущей языковой паре: сколько слов в изучении,
 * сколько выучено, наглядный прогресс (донат + прогресс-бар лимита).
 */
export default function StatsScreen({
  takenCount,
  knownCount,
  learnLang,
  nativeLang,
  onBack,
}) {
  const { t } = useI18n();
  const total = takenCount + knownCount;
  const knownFraction = total > 0 ? knownCount / total : 0;
  const knownPercent = Math.round(knownFraction * 100);
  const knownDash = knownFraction * CIRCUMFERENCE;

  const activeFraction = Math.min(takenCount / MAX_ACTIVE_WORDS, 1);

  const pairLabel = [
    learnLang && t(`lang.${learnLang}`),
    nativeLang && t(`lang.${nativeLang}`),
  ]
    .filter(Boolean)
    .join(" → ");

  return (
    <section className="stats">
      <header className="stats__header">
        <button
          type="button"
          className="stats__back"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <div className="stats__header-text">
          <h1 className="stats__title">{t("stats.title")}</h1>
          {pairLabel && <p className="stats__subtitle">{pairLabel}</p>}
        </div>
      </header>

      {total === 0 ? (
        <div className="stats__empty">
          <div className="stats__empty-emoji" aria-hidden="true">
            📊
          </div>
          <p className="stats__empty-text">{t("stats.empty")}</p>
        </div>
      ) : (
        <>
          <div className="stats__donut-wrap">
            <svg
              className="stats__donut"
              viewBox="0 0 200 200"
              role="img"
              aria-label={t("stats.donutAria", { percent: knownPercent })}
            >
              <circle
                className="stats__donut-track"
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                strokeWidth="20"
              />
              <circle
                className="stats__donut-fill"
                cx="100"
                cy="100"
                r={RADIUS}
                fill="none"
                strokeWidth="20"
                strokeDasharray={`${knownDash} ${CIRCUMFERENCE}`}
                strokeLinecap="round"
                transform="rotate(-90 100 100)"
              />
            </svg>
            <div className="stats__donut-center">
              <span className="stats__donut-percent">{knownPercent}%</span>
              <span className="stats__donut-label">{t("stats.learnedLabel")}</span>
            </div>
          </div>

          <div className="stats__tiles">
            <div className="stats__tile">
              <span className="stats__tile-value">{takenCount}</span>
              <span className="stats__tile-label">{t("stats.learning")}</span>
            </div>
            <div className="stats__tile">
              <span className="stats__tile-value">{knownCount}</span>
              <span className="stats__tile-label">{t("stats.learned")}</span>
            </div>
            <div className="stats__tile">
              <span className="stats__tile-value">{total}</span>
              <span className="stats__tile-label">{t("stats.totalWords")}</span>
            </div>
          </div>

          <div className="stats__limit">
            <div className="stats__limit-row">
              <span>{t("stats.activeWords")}</span>
              <span>
                {takenCount} / {MAX_ACTIVE_WORDS}
              </span>
            </div>
            <div className="stats__limit-bar" aria-hidden="true">
              <span
                className="stats__limit-fill"
                style={{ width: `${activeFraction * 100}%` }}
              />
            </div>
          </div>
        </>
      )}
    </section>
  );
}
