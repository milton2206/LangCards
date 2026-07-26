import { useEffect } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./Modal.css";
import "./WhatsNew.css";

/**
 * Окно «Что нового» при заходе. Два режима (см. resolveWhatsNew):
 *   greeting — короткое приветствие новичку (без списка изменений);
 *   list     — записи новее прошлого захода (новые сверху).
 * Показывается один раз за заход, закрывается, переходам по экранам не мешает.
 *
 * entries — массив { id, date }; заголовок/описание берём из i18n по
 * whatsnew.entries.<id>.title / .desc. Дата форматируется на языке интерфейса.
 */
export default function WhatsNew({ mode, entries = [], onClose }) {
  const { t, lang } = useI18n();

  // Закрытие по Escape + блокировка прокрутки фона (как в остальных окнах).
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

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(lang, {
        day: "numeric",
        month: "long",
      });
    } catch {
      return iso;
    }
  }

  const isGreeting = mode === "greeting";

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
      onClick={onClose}
    >
      <div className="modal__box" onClick={(e) => e.stopPropagation()}>
        <header className="modal__header">
          <h2 id="whatsnew-title" className="modal__title">
            {isGreeting ? t("whatsnew.greetingTitle") : t("whatsnew.title")}
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

        {isGreeting ? (
          <p className="modal__text">{t("whatsnew.greeting")}</p>
        ) : (
          <ul className="whatsnew__list">
            {entries.map((e) => (
              <li className="whatsnew__item" key={e.id}>
                <div className="whatsnew__row">
                  <span className="whatsnew__item-title">
                    {t(`whatsnew.entries.${e.id}.title`)}
                  </span>
                  <span className="whatsnew__date">{formatDate(e.date)}</span>
                </div>
                <p className="whatsnew__desc">
                  {t(`whatsnew.entries.${e.id}.desc`)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <div className="modal__actions">
          <button
            type="button"
            className="modal__btn modal__btn--primary"
            onClick={onClose}
          >
            {isGreeting ? t("whatsnew.start") : t("common.gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
}
