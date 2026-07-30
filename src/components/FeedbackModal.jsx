import { useEffect, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import Icon from "./icons/Icon.jsx";
import "./Modal.css";

/**
 * Модальное окно «Сообщить о проблеме» (фаза 7.1). Текст отзыва вводит
 * пользователь; версия приложения и браузер добавляются автоматически на уровне
 * feedbackClient. onSend(text) → Promise<{ ok, reason? }>.
 */
export default function FeedbackModal({ onClose, onSend }) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [errorText, setErrorText] = useState("");

  // Закрытие по Escape + блокировка прокрутки фона.
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

  async function handleSend() {
    const clean = text.trim();
    if (!clean || status === "sending") return;
    setStatus("sending");
    setErrorText("");
    const res = await onSend(clean);
    if (res?.ok) {
      setStatus("sent");
    } else {
      setStatus("error");
      setErrorText(
        res?.reason === "not-configured"
          ? t("feedback.notConfigured")
          : t("feedback.failed"),
      );
    }
  }

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="feedback-title"
      onClick={onClose}
    >
      <div
        className="modal__box modal__box--ember"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <span className="modal__title-group">
            <span className="modal__title-icon" aria-hidden="true">
              <Icon name="daily" size={20} />
            </span>
            <h2 id="feedback-title" className="modal__title">
              {t("feedback.title")}
            </h2>
          </span>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        {status === "sent" ? (
          <>
            <p className="modal__success" role="status">
              {t("feedback.thanks")}
            </p>
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
            <p className="modal__text">{t("feedback.lead")}</p>
            <textarea
              className="modal__textarea"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t("feedback.placeholder")}
              maxLength={4000}
              autoFocus
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
                onClick={handleSend}
                disabled={!text.trim() || status === "sending"}
              >
                {status === "sending" ? t("feedback.sending") : t("feedback.send")}
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
