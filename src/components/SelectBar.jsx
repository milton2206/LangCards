import { useI18n } from "../i18n/I18nContext.jsx";
import "./SelectBar.css";

/**
 * Нижняя панель режима выбора (Отмена / Удалить N) + окно подтверждения.
 * Общая для экранов «Мои слова» и «Известные слова».
 */
export default function SelectBar({
  count,
  confirmOpen,
  onCancel,
  onRequestDelete,
  onConfirmDelete,
  onCloseConfirm,
}) {
  const { t, tp } = useI18n();
  return (
    <>
      <div className="selectbar">
        <button
          type="button"
          className="selectbar__cancel"
          onClick={onCancel}
        >
          {t("selectbar.cancel")}
        </button>
        <button
          type="button"
          className="selectbar__delete"
          disabled={count === 0}
          onClick={onRequestDelete}
        >
          {t("selectbar.delete", { n: count })}
        </button>
      </div>

      {confirmOpen && (
        <div
          className="selectbar__overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="selectbar-confirm-title"
        >
          <div className="selectbar__dialog">
            <p
              className="selectbar__dialog-title"
              id="selectbar-confirm-title"
            >
              {t("selectbar.confirmTitle", {
                n: count,
                word: tp("plural.words", count),
              })}
            </p>
            <p className="selectbar__dialog-text">
              {t("selectbar.confirmText")}
            </p>
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
                className="selectbar__dialog-ok"
                onClick={onConfirmDelete}
              >
                {t("selectbar.confirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
