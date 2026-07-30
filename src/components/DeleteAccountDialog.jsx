import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { apiErrorText } from "../lib/apiClient.js";
import Icon from "./icons/Icon.jsx";
import "./Modal.css";

/**
 * Подтверждение удаления аккаунта (фаза 7.1). Удаление НЕОБРАТИМО — окно говорит
 * об этом прямо. onConfirm() → Promise (бросает Error при сбое). После успеха
 * родитель сам выйдет и перезагрузит приложение.
 */
export default function DeleteAccountDialog({ email, onClose, onConfirm }) {
  const { t } = useI18n();
  const [status, setStatus] = useState("idle"); // idle | deleting | error
  const [errorText, setErrorText] = useState("");

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape" && status !== "deleting") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, status]);

  async function handleConfirm() {
    if (status === "deleting") return;
    setStatus("deleting");
    setErrorText("");
    try {
      await onConfirm();
      // При успехе родитель перезагружает приложение — этот компонент исчезнет.
    } catch (err) {
      setStatus("error");
      setErrorText(apiErrorText(err, t, "account.deleteFailed"));
    }
  }

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-title"
      onClick={status === "deleting" ? undefined : onClose}
    >
      <div
        className="modal__box modal__box--ember"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <span className="modal__title-group">
            <span
              className="modal__title-icon modal__title-icon--danger"
              aria-hidden="true"
            >
              <Icon name="alert" size={20} />
            </span>
            <h2 id="delete-title" className="modal__title">
              {t("account.deleteTitle")}
            </h2>
          </span>
        </header>

        {/* Прямо говорим о необратимости и что именно исчезнет. */}
        <p className="modal__warn">{t("account.deleteWarning")}</p>
        <p className="modal__text">
          {t("account.deleteWhat", { email: email || "" })}
        </p>

        {status === "error" && (
          <p className="modal__error" role="status">
            {errorText}
          </p>
        )}

        <div className="modal__actions">
          <button
            type="button"
            className="modal__btn modal__btn--danger"
            onClick={handleConfirm}
            disabled={status === "deleting"}
          >
            {status === "deleting"
              ? t("account.deleting")
              : t("account.deleteConfirm")}
          </button>
          <button
            type="button"
            className="modal__btn modal__btn--ghost"
            onClick={onClose}
            disabled={status === "deleting"}
          >
            {t("common.cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
