import { ONBOARDING_STEPS } from "../data/onboarding.js";
import "./SettingsScreen.css";

/**
 * Экран настроек. Можно в любой момент сменить уровень слов, а также язык и
 * тему. Изменения сохраняются сразу; новые карточки появятся только после
 * нажатия «Сгенерировать новые карточки» на главном экране.
 */
export default function SettingsScreen({ settings, onChange, onBack }) {
  return (
    <section className="settings">
      <header className="settings__header">
        <button
          type="button"
          className="settings__back"
          onClick={onBack}
          aria-label="Назад"
        >
          ←
        </button>
        <h1 className="settings__title">Настройки</h1>
      </header>

      <p className="settings__note">
        Новые карточки появятся после нажатия «Сгенерировать новые карточки» на
        главном экране. Взятые и известные слова при этом не теряются.
      </p>

      {ONBOARDING_STEPS.map((step) => (
        <div className="settings__group" key={step.key}>
          <h2 className="settings__group-title">{step.title}</h2>
          <div className="settings__options">
            {step.options.map((opt) => {
              const active = settings[step.key] === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={
                    "settings__chip" + (active ? " is-active" : "")
                  }
                  aria-pressed={active}
                  onClick={() => onChange(step.key, opt.id)}
                >
                  <span aria-hidden="true">{opt.emoji}</span> {opt.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <button type="button" className="settings__done" onClick={onBack}>
        Готово
      </button>
    </section>
  );
}
