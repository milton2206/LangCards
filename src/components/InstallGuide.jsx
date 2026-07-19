import { useEffect } from "react";
import "./InstallGuide.css";

// Определение устройства по user-agent. Экспортируется для проверки логики.
export function detectPlatform(ua) {
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

const IOS_STEPS = [
  "Нажми кнопку «Поделиться» внизу экрана (квадрат со стрелкой вверх).",
  "Пролистай и выбери «На экран „Домой“».",
  "Нажми «Добавить».",
];

const ANDROID_STEPS = [
  "Нажми меню (три точки вверху справа).",
  "Выбери «Добавить на главный экран» или «Установить приложение».",
  "Подтверди.",
];

/**
 * Модальное окно с короткой инструкцией «Как установить на телефон».
 * Показывает шаги под устройство пользователя (iOS / Android), а если
 * определить не удалось — обе инструкции.
 */
export default function InstallGuide({ onClose }) {
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
            📲 Установить на телефон
          </h2>
          <button
            type="button"
            className="install__close"
            onClick={onClose}
            aria-label="Закрыть"
          >
            ×
          </button>
        </header>

        <p className="install__lead">
          Добавьте приложение на главный экран, чтобы открывать его как обычное
          приложение — на весь экран.
        </p>

        {showIOS && (
          <section className="install__section">
            <h3 className="install__section-title">iPhone (Safari)</h3>
            <ol className="install__steps">
              {IOS_STEPS.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
            <p className="install__note">
              ⚠️ Работает только в Safari. Если открыто в Chrome, Instagram или
              Telegram — сначала открой ссылку в Safari.
            </p>
          </section>
        )}

        {showAndroid && (
          <section className="install__section">
            <h3 className="install__section-title">Android (Chrome)</h3>
            <ol className="install__steps">
              {ANDROID_STEPS.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </section>
        )}

        <button type="button" className="install__done" onClick={onClose}>
          Понятно
        </button>
      </div>
    </div>
  );
}
