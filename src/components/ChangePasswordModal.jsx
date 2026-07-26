import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { authErrorKey } from "../lib/authErrors.js";
import { passwordError } from "../lib/passwordValidation.js";
import "./Modal.css";

/**
 * Смена пароля для залогиненного пользователя (из настроек). Новый пароль +
 * подтверждение → onChange(password) (это supabase.auth.updateUser). Проверяем,
 * что пароли непустые и совпадают; финально длину проверяет Supabase.
 *
 * onChange(password) — бросает Error при ошибке.
 */
export default function ChangePasswordModal({ onClose, onChange }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  async function handleSave() {
    if (status === "saving") return;
    setErrorText("");

    const key = passwordError(password, confirm);
    if (key) {
      setStatus("error");
      setErrorText(t(key));
      return;
    }

    setStatus("saving");
    try {
      await onChange(password);
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setErrorText(t(authErrorKey(err?.message)));
    }
  }

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pw-title"
      onClick={onClose}
    >
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h2 id="pw-title" className="modal__title">
            {t("password.title")}
          </h2>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        {status === "saved" ? (
          <>
            <p className="modal__text">{t("password.saved")}</p>
            <div className="modal__actions">
              <button
                type="button"
                className="modal__btn modal__btn--primary"
                onClick={onClose}
              >
                {t("common.close")}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="modal__text">{t("password.lead")}</p>
            <input
              type="password"
              className="modal__input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              placeholder={t("password.new")}
              aria-label={t("password.new")}
            />
            <input
              type="password"
              className="modal__input"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              placeholder={t("password.confirm")}
              aria-label={t("password.confirm")}
            />
            {status === "error" && (
              <p className="modal__error" role="status">
                {errorText}
              </p>
            )}
            <div className="modal__actions">
              <button
                type="button"
                className="modal__btn modal__btn--primary"
                onClick={handleSave}
                disabled={status === "saving"}
              >
                {status === "saving" ? t("password.saving") : t("password.save")}
              </button>
              <button
                type="button"
                className="modal__btn modal__btn--ghost"
                onClick={onClose}
              >
                {t("common.cancel")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
