import { useState } from "react";
import {
  ONBOARDING_STEPS,
  optionLabelKey,
  stepTitleKey,
} from "../data/onboarding.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import InstallGuide from "../components/InstallGuide.jsx";
import TopicPicker from "../components/TopicPicker.jsx";
import FeedbackModal from "../components/FeedbackModal.jsx";
import DeleteAccountDialog from "../components/DeleteAccountDialog.jsx";
import ChangePasswordModal from "../components/ChangePasswordModal.jsx";
import "./SettingsScreen.css";

/**
 * Экран настроек. Можно в любой момент сменить уровень слов, а также язык и
 * тему. Изменения сохраняются сразу; новые карточки появятся только после
 * нажатия «Сгенерировать новые карточки» на главном экране.
 */
export default function SettingsScreen({
  settings,
  onChange,
  onOpenLanguages,
  onBack,
  onOpenTutorial,
  placementLevel,
  onStartPlacement,
  customTopics,
  canManageTopics,
  onAddCustomTopic,
  onRemoveCustomTopic,
  auth,
  onOpenAuth,
  syncStatus,
  syncReason,
  onRetrySync,
  onSendFeedback,
  onDeleteAccount,
  onChangePassword,
}) {
  const { t } = useI18n();
  const [showInstall, setShowInstall] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);

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

      {/* Языки управляются на отдельном экране «Мои языки» (фаза 4.4):
          смена пары, мультирежим, приоритет, дневные лимиты — всё там. */}
      <div className="settings__group">
        <h2 className="settings__group-title">{t("languages.title")}</h2>
        <button
          type="button"
          className="settings__chip settings__chip--wide"
          onClick={onOpenLanguages}
        >
          🌐 {t("languages.entry")}
        </button>
      </div>

      {/* Тема и уровень — по-прежнему в settings (localStorage). Выбранная
          тема может быть пресетом ИЛИ своей темой пары; и то, и другое — просто
          settings.topic. */}
      {ONBOARDING_STEPS.filter(
        (step) => step.key === "topic" || step.key === "level",
      ).map((step) => (
        <div className="settings__group" key={step.key}>
          <h2 className="settings__group-title">{t(stepTitleKey(step.key))}</h2>

          {step.key === "topic" ? (
            <TopicPicker
              value={settings.topic}
              customTopics={customTopics}
              canManage={canManageTopics}
              onSelect={(id) => onChange("topic", id)}
              onAddCustom={onAddCustomTopic}
              onRemoveCustom={onRemoveCustomTopic}
            />
          ) : (
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
                    <span aria-hidden="true">{opt.emoji}</span>{" "}
                    {t(optionLabelKey(step.key, opt.id))}
                  </button>
                );
              })}
            </div>
          )}

          {/* Уровень можно не выбирать на глаз, а измерить — и переизмерить
              когда угодно (фаза 6.3). Тест идёт по АКТИВНОЙ языковой паре. */}
          {step.key === "level" && onStartPlacement && (
            <>
              <button
                type="button"
                className="settings__chip settings__chip--wide"
                onClick={onStartPlacement}
              >
                🎯 {t("placement.retest")}
              </button>
              <p className="settings__account-hint">
                {placementLevel
                  ? t("placement.currentResult", {
                      level: placementLevel.toUpperCase(),
                    })
                  : t("placement.neverTested")}
              </p>
            </>
          )}
        </div>
      ))}

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
            {/* Смена пароля — через Supabase Auth (updateUser), в отдельном окне. */}
            {onChangePassword && (
              <button
                type="button"
                className="settings__chip settings__chip--wide"
                onClick={() => setShowChangePw(true)}
              >
                🔑 {t("settings.changePassword")}
              </button>
            )}
            {/* Опасная зона: удаление аккаунта. Необратимо — подтверждение в
                отдельном окне говорит об этом прямо. */}
            {onDeleteAccount && (
              <button
                type="button"
                className="settings__danger"
                onClick={() => setShowDelete(true)}
              >
                {t("settings.deleteAccount")}
              </button>
            )}
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

      {/* Сообщить о проблеме → запись в таблицу feedback (версия и браузер
          добавляются автоматически). Доступно вошедшему пользователю. */}
      {onSendFeedback && auth?.user && (
        <button
          type="button"
          className="settings__secondary"
          onClick={() => setShowFeedback(true)}
        >
          {t("settings.feedback")}
        </button>
      )}

      {showInstall && <InstallGuide onClose={() => setShowInstall(false)} />}

      {showFeedback && (
        <FeedbackModal
          onClose={() => setShowFeedback(false)}
          onSend={onSendFeedback}
        />
      )}

      {showDelete && (
        <DeleteAccountDialog
          email={auth?.user?.email}
          onClose={() => setShowDelete(false)}
          onConfirm={onDeleteAccount}
        />
      )}

      {showChangePw && (
        <ChangePasswordModal
          onClose={() => setShowChangePw(false)}
          onChange={onChangePassword}
        />
      )}
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
