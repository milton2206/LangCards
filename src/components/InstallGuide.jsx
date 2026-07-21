import { useEffect } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./InstallGuide.css";

// Определение устройства по user-agent.
function detectPlatform(ua) {
  const agent = ua ?? (typeof navigator !== "undefined" ? navigator.userAgent : "");
  const isIOS =
    /iphone|ipad|ipod/i.test(agent) ||
    // iPadOS маскируется под Mac — ловим по тач-точкам
    (typeof navigator !== "undefined" &&
      navigator.platform === "MacIntel" &&
      navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/android/i.test(agent)) return "android";
  return "unknown";
}

/**
 * Модальное окно с короткой инструкцией «Как установить на телефон».
 * Показывает шаги под устройство пользователя (iOS / Android), а если
 * определить не удалось — обе инструкции.
 */
export default function InstallGuide({ onClose }) {
  const { t } = useI18n();
  const platform = detectPlatform();
  const showIOS = platform === "ios" || platform === "unknown";
  const showAndroid = platform === "android" || platform === "unknown";

  // Закрытие по Escape + блокировка прокрутки фона, пока окно открыто.
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div
      className="install"
      role="dialog"
      aria-modal="true"
      aria-labelledby="install-title"
      onClick={onClose}
    >
      <div className="install__box" onClick={(e) => e.stopPropagation()}>
        <header className="install__header">
          <h2 id="install-title" className="install__title">
            {t("install.title")}
          </h2>
          <button
            type="button"
            className="install__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        <p className="install__lead">{t("install.lead")}</p>

        {showIOS && (
          <section className="install__section">
            <h3 className="install__section-title">{t("install.iosTitle")}</h3>
            <ol className="install__steps">
              {t("install.iosSteps").map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p className="install__note">{t("install.note")}</p>
          </section>
        )}

        {showAndroid && (
          <section className="install__section">
            <h3 className="install__section-title">
              {t("install.androidTitle")}
            </h3>
            <ol className="install__steps">
              {t("install.androidSteps").map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
        )}

        <button type="button" className="install__done" onClick={onClose}>
          {t("common.gotIt")}
        </button>
      </div>
    </div>
  );
}
