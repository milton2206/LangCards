import { pluralRu } from "../lib/humanizeInterval.js";
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
  return (
    <>
      <div className="selectbar">
        <button
          type="button"
          className="selectbar__cancel"
          onClick={onCancel}
        >
          Отмена
        </button>
        <button
          type="button"
          className="selectbar__delete"
          disabled={count === 0}
          onClick={onRequestDelete}
        >
          Удалить ({count})
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
              Удалить {count} {pluralRu(count, "слово", "слова", "слов")}?
            </p>
            <p className="selectbar__dialog-text">
              Слова удалятся совсем — из списков и из хранилища. Отменить
              нельзя.
            </p>
            <div className="selectbar__dialog-actions">
              <button
                type="button"
                className="selectbar__dialog-cancel"
                onClick={onCloseConfirm}
              >
                Отмена
              </button>
              <button
                type="button"
                className="selectbar__dialog-ok"
                onClick={onConfirmDelete}
              >
                Удалить
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
