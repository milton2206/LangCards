import { LANG_EMOJI } from "../data/onboarding.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./DailyBalance.css";

/**
 * Разбивка дневной нормы новых слов по активным языкам (фаза 4.3):
 * «Сегодня: 🇩🇪 DE 4/16 · 🇬🇧 EN 0/6 · 🇬🇷 EL 4/4 ✓».
 * Рендерится ТОЛЬКО при multiLangMode=true (App передаёт items=null при false —
 * один язык, делить нечего). Чип выполненной нормы помечается галочкой; тап по
 * чипу переключает активную пару (тот же обработчик, что у переключателя).
 */
export default function DailyBalance({ items, activePairKey, onSwitch }) {
  const { t } = useI18n();
  if (!items || items.length === 0) return null;

  return (
    <div className="balance" role="group" aria-label={t("balance.aria")}>
      <span className="balance__label">{t("balance.today")}</span>
      {items.map((it) => (
        <button
          key={it.pairKey}
          type="button"
          className={
            "balance__chip" +
            (it.pairKey === activePairKey ? " is-active" : "") +
            (it.done ? " is-done" : "")
          }
          onClick={() =>
            onSwitch({ learnLang: it.learnLang, nativeLang: it.nativeLang })
          }
        >
          <span aria-hidden="true">{LANG_EMOJI[it.learnLang] || "🌐"}</span>
          <span className="balance__code">
            {String(it.learnLang).toUpperCase()}
          </span>
          <span className="balance__count">
            {it.taken}/{it.quota}
          </span>
          {it.done && (
            <span className="balance__check" aria-hidden="true">
              ✓
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
