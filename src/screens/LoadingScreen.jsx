import { ONBOARDING_STEPS, findOptionLabel } from "../data/onboarding.js";
import "./LoadingScreen.css";

/**
 * Экран-заглушка после онбординга. Сами карточки появятся в следующей фазе —
 * пока показываем индикатор загрузки и сводку выбранных настроек.
 */
export default function LoadingScreen({ settings, onOpenSettings }) {
  return (
    <section className="loading">
      <header className="loading__top">
        <button
          type="button"
          className="loading__settings"
          onClick={onOpenSettings}
        >
          ⚙️ Настройки
        </button>
      </header>

      <div className="loading__body">
        <div className="loading__spinner" aria-hidden="true" />
        <h1 className="loading__title">Загрузка карточек…</h1>
        <p className="loading__hint">Готовим подборку под ваши настройки.</p>

        <div className="loading__summary">
          {ONBOARDING_STEPS.map((step) => (
            <span key={step.key} className="loading__chip">
              {findOptionLabel(step.key, settings[step.key])}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
