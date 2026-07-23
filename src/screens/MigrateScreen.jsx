import { useI18n } from "../i18n/I18nContext.jsx";
import "./MigrateScreen.css";

/**
 * Предложение перенести локальный (анонимный) прогресс в аккаунт.
 * Показывается один раз: пользователь входит впервые на устройстве, где уже
 * есть непустой wordsByPair в localStorage. До решения синхронизация слов
 * придержана (holdSync в useWordLists) — локальные данные не сливаются в облако
 * без согласия.
 *
 * «Перенести» — локальные слова объединятся с облаком существующей логикой
 * слияния (mergeWordData): ничего не теряется и не дублируется.
 * «Начать с чистого листа» — локальный прогресс удаляется с устройства.
 */
export default function MigrateScreen({ onTransfer, onDiscard }) {
  const { t } = useI18n();

  return (
    <section className="migrate">
      <div className="migrate__emoji" aria-hidden="true">
        📦
      </div>
      <h1 className="migrate__title">{t("migrate.title")}</h1>
      <p className="migrate__text">{t("migrate.text")}</p>

      <div className="migrate__actions">
        <button type="button" className="migrate__primary" onClick={onTransfer}>
          {t("migrate.transfer")}
        </button>
        <button type="button" className="migrate__ghost" onClick={onDiscard}>
          {t("migrate.fresh")}
        </button>
      </div>
      <p className="migrate__hint">{t("migrate.hint")}</p>
    </section>
  );
}
