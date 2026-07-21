import { useState } from "react";
import { ONBOARDING_STEPS } from "../data/onboarding.js";
import InstallGuide from "../components/InstallGuide.jsx";
import "./SettingsScreen.css";

/**
 * Экран настроек. Можно в любой момент сменить уровень слов, а также язык и
 * тему. Изменения сохраняются сразу; новые карточки появятся только после
 * нажатия «Сгенерировать новые карточки» на главном экране.
 */
export default function SettingsScreen({
  settings,
  onChange,
  onBack,
  onOpenTutorial,
  auth,
  onOpenAuth,
  syncStatus,
  syncError,
  onRetrySync,
}) {
  const [showInstall, setShowInstall] = useState(false);

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

      <div className="settings__group">
        <h2 className="settings__group-title">Аккаунт</h2>
        {!auth?.configured ? (
          <p className="settings__account-hint">
            Вход появится, когда будет подключён Supabase (переменные окружения
            VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY). Слова хранятся на этом
            устройстве.
          </p>
        ) : auth.user ? (
          <>
            <div className="settings__account">
              <div className="settings__account-info">
                <span className="settings__account-label">Вы вошли как</span>
                <span className="settings__account-email">
                  {auth.user.email}
                </span>
              </div>
              <button
                type="button"
                className="settings__signout"
                onClick={auth.signOut}
              >
                Выйти
              </button>
            </div>
            <SyncStatus
              status={syncStatus}
              error={syncError}
              onRetry={onRetrySync}
            />
          </>
        ) : (
          <>
            <p className="settings__account-hint">
              Войдите или зарегистрируйтесь, чтобы подготовить синхронизацию слов
              между устройствами. Пока слова хранятся на этом устройстве.
            </p>
            <button
              type="button"
              className="settings__signin"
              onClick={onOpenAuth}
            >
              Войти / Зарегистрироваться
            </button>
          </>
        )}
      </div>

      <button type="button" className="settings__done" onClick={onBack}>
        Готово
      </button>

      <button
        type="button"
        className="settings__secondary"
        onClick={onOpenTutorial}
      >
        ❓ Как пользоваться
      </button>

      <button
        type="button"
        className="settings__secondary"
        onClick={() => setShowInstall(true)}
      >
        📲 Установить на телефон
      </button>

      {showInstall && <InstallGuide onClose={() => setShowInstall(false)} />}
    </section>
  );
}

// Строка состояния синхронизации прогресса с облаком.
function SyncStatus({ status, error, onRetry }) {
  const map = {
    syncing: { cls: "is-syncing", text: "Синхронизация…" },
    synced: { cls: "is-synced", text: "Прогресс синхронизирован ✓" },
    offline: { cls: "is-offline", text: error || "Оффлайн — синхронизируем позже." },
    error: { cls: "is-error", text: error || "Ошибка синхронизации." },
  };
  const view = map[status] || map.syncing;
  const canRetry = status === "offline" || status === "error";

  return (
    <div className={"settings__sync " + view.cls}>
      <span className="settings__sync-text">{view.text}</span>
      {canRetry && (
        <button
          type="button"
          className="settings__sync-retry"
          onClick={onRetry}
        >
          Повторить
        </button>
      )}
    </div>
  );
}
