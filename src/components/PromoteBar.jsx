import { useI18n } from "../i18n/I18nContext.jsx";
import "./SelectBar.css";

/**
 * Нижняя панель разбора созревших слов (Отмена / Перенести N) + подтверждение.
 * Раскладка та же, что у режима выбора (SelectBar) — стили общие, поэтому обе
 * панели выглядят одинаково и правятся в одном месте. Отличается смысл действия:
 * это не удаление, а перенос в известные, поэтому цвет оливковый («выучено»),
 * а тексты свои.
 */
export default function PromoteBar({
  count,
  confirmOpen,
  onCancel,
  onRequestPromote,
  onConfirmPromote,
  onCloseConfirm,
}) {
  const { t, tp } = useI18n();
  return (
    <>
      <div className="selectbar">
        <button type="button" className="selectbar__cancel" onClick={onCancel}>
          {t("selectbar.cancel")}
        </button>
        <button
          type="button"
          className="selectbar__promote"
          disabled={count === 0}
          onClick={onRequestPromote}
        >
          {t("promote.action", { n: count })}
        </button>
      </div>

      {confirmOpen && (
        <div
          className="selectbar__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="promote-confirm-title"
        >
          <div className="selectbar__dialog">
            <p className="selectbar__dialog-title" id="promote-confirm-title">
              {t("promote.confirmTitle", {
                n: count,
                word: tp("plural.words", count),
              })}
            </p>
            <p className="selectbar__dialog-text">{t("promote.confirmText")}</p>
            <div className="selectbar__dialog-actions">
              <button
                type="button"
                className="selectbar__dialog-cancel"
                onClick={onCloseConfirm}
              >
                {t("selectbar.cancel")}
              </button>
              <button
                type="button"
                className="selectbar__dialog-promote"
                onClick={onConfirmPromote}
              >
                {t("promote.confirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
