import { useState } from "react";
import {
  ONBOARDING_STEPS,
  optionLabelKey,
  stepTitleKey,
} from "../data/onboarding.js";
import { useI18n } from "../i18n/I18nContext.jsx";
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
  activeLanguage,
  onChangeLanguage,
  multiLangMode,
  multiLangAvailable,
  onToggleMultiLang,
  onBack,
  onOpenTutorial,
  auth,
  onOpenAuth,
  syncStatus,
  syncReason,
  onRetrySync,
}) {
  const { t } = useI18n();
  const [showInstall, setShowInstall] = useState(false);

  // Языковая часть теперь живёт в user_languages (фаза 4.2): выбранное значение
  // берём из активной пары, изменение уходит в onChangeLanguage (создаёт/
  // активирует пару в облаке). Тема и уровень — по-прежнему в settings.
  const isLangStep = (key) => key === "learnLang" || key === "nativeLang";
  const selectedValue = (key) =>
    isLangStep(key) ? activeLanguage?.[key] ?? settings[key] : settings[key];

  return (
    <section className="settings">
      <header className="settings__header">
        <button
          type="button"
          className="settings__back"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <h1 className="settings__title">{t("settings.title")}</h1>
      </header>

      <p className="settings__note">{t("settings.note")}</p>

      {ONBOARDING_STEPS.map((step) => (
        <div className="settings__group" key={step.key}>
          <h2 className="settings__group-title">{t(stepTitleKey(step.key))}</h2>
          <div className="settings__options">
            {step.options.map((opt) => {
              const active = selectedValue(step.key) === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  className={
                    "settings__chip" + (active ? " is-active" : "")
                  }
                  aria-pressed={active}
                  onClick={() =>
                    isLangStep(step.key)
                      ? onChangeLanguage(step.key, opt.id)
                      : onChange(step.key, opt.id)
                  }
                >
                  <span aria-hidden="true">{opt.emoji}</span>{" "}
                  {t(optionLabelKey(step.key, opt.id))}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Мультиязычный режим — осознанный выбор (profiles.multi_lang_mode).
          Доступен только с аккаунтом; при false интерфейс ровно как раньше. */}
      {multiLangAvailable && (
        <div className="settings__group">
          <h2 className="settings__group-title">{t("settings.multiLang")}</h2>
          <p className="settings__account-hint">{t("settings.multiLangHint")}</p>
          <button
            type="button"
            className={
              "settings__chip settings__chip--wide" +
              (multiLangMode ? " is-active" : "")
            }
            aria-pressed={multiLangMode}
            onClick={() => onToggleMultiLang(!multiLangMode)}
          >
            {multiLangMode
              ? t("settings.multiLangOn")
              : t("settings.multiLangOff")}
          </button>
        </div>
      )}

      <div className="settings__group">
        <h2 className="settings__group-title">{t("settings.account")}</h2>
        {!auth?.configured ? (
          <p className="settings__account-hint">
            {t("settings.accountNotConfigured")}
          </p>
        ) : auth.user ? (
          <>
            <div className="settings__account">
              <div className="settings__account-info">
                <span className="settings__account-label">
                  {t("settings.loggedInAs")}
                </span>
                <span className="settings__account-email">
                  {auth.user.email}
                </span>
              </div>
              <button
                type="button"
                className="settings__signout"
                onClick={auth.signOut}
              >
                {t("settings.signOut")}
              </button>
            </div>
            <SyncStatus
              status={syncStatus}
              reason={syncReason}
              onRetry={onRetrySync}
              t={t}
            />
          </>
        ) : (
          <>
            <p className="settings__account-hint">
              {t("settings.accountPrompt")}
            </p>
            <button
              type="button"
              className="settings__signin"
              onClick={onOpenAuth}
            >
              {t("settings.signInUp")}
            </button>
          </>
        )}
      </div>

      <button type="button" className="settings__done" onClick={onBack}>
        {t("common.done")}
      </button>

      <button
        type="button"
        className="settings__secondary"
        onClick={onOpenTutorial}
      >
        {t("settings.howto")}
      </button>

      <button
        type="button"
        className="settings__secondary"
        onClick={() => setShowInstall(true)}
      >
        {t("settings.install")}
      </button>

      {showInstall && <InstallGuide onClose={() => setShowInstall(false)} />}
    </section>
  );
}

// Строка состояния синхронизации прогресса с облаком. reason уточняет причину
// внутри статуса error (например, отсутствие таблицы в облаке).
function SyncStatus({ status, reason, onRetry, t }) {
  const map = {
    syncing: { cls: "is-syncing", text: t("sync.syncing") },
    synced: { cls: "is-synced", text: t("sync.synced") },
    offline: { cls: "is-offline", text: t("sync.offline") },
    error: {
      cls: "is-error",
      text: reason === "missing-table" ? t("sync.errorNoTable") : t("sync.error"),
    },
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
          {t("sync.retry")}
        </button>
      )}
    </div>
  );
}
