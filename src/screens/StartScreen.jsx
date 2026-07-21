import { useI18n } from "../i18n/I18nContext.jsx";
import "./StartScreen.css";

export default function StartScreen({ onStart }) {
  const { t } = useI18n();
  return (
    <section className="start" aria-labelledby="start-title">
      <div className="start__badge">🗂️ LangCards</div>

      <div className="start__body">
        <h1 id="start-title" className="start__title">
          {t("start.title")}
        </h1>
        <p className="start__subtitle">{t("start.subtitle")}</p>
      </div>

      <div className="start__footer">
        <span className="start__status" role="status">
          {t("start.status")}
        </span>
        <button type="button" className="start__cta" onClick={onStart}>
          {t("start.cta")}
        </button>
      </div>
    </section>
  );
}
