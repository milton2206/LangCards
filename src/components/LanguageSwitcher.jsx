import { useState } from "react";
import { LANG_EMOJI } from "../data/onboarding.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import Flag from "./icons/Flag.jsx";
import "./LanguageSwitcher.css";

/**
 * Компактный переключатель языковой пары (фаза 4.2, мультирежим).
 * Чип «флаг + код изучаемого языка» вверху экрана карточек; тап открывает
 * список активных пар пользователя. Рендерится ТОЛЬКО при multiLangMode=true —
 * в одноязычном режиме интерфейс остаётся ровно как раньше (см. CardScreen).
 *
 * appearance — ТОЛЬКО вид (поведение одинаково):
 *   "default" — эмодзи-флаг (как раньше; экран занятия остаётся прежним);
 *   "ember"   — круглый флаг (набор Ember) + тёплые токены. Экраны, ещё не
 *               мигрированные на Ember, проп НЕ передают и выглядят как прежде.
 */
export default function LanguageSwitcher({
  languages,
  activeLanguage,
  onSwitch,
  appearance = "default",
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  if (!activeLanguage) return null;

  const ember = appearance === "ember";
  // Флаг: круглый (Ember) или эмодзи (прежний вид).
  const flagFor = (lang) =>
    ember ? (
      <Flag lang={lang} size={22} />
    ) : (
      <span aria-hidden="true">{LANG_EMOJI[lang] || "🌐"}</span>
    );

  function pick(lang) {
    setOpen(false);
    // Уже активная пара — ничего не делаем.
    if (
      lang.learnLang === activeLanguage.learnLang &&
      lang.nativeLang === activeLanguage.nativeLang
    ) {
      return;
    }
    onSwitch({ learnLang: lang.learnLang, nativeLang: lang.nativeLang });
  }

  return (
    <div className={"langswitch" + (ember ? " langswitch--ember" : "")}>
      <button
        type="button"
        className="langswitch__chip"
        aria-label={t("langSwitch.aria")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {flagFor(activeLanguage.learnLang)}
        <span className="langswitch__code">
          {String(activeLanguage.learnLang).toUpperCase()}
        </span>
      </button>

      {open && (
        <>
          {/* Прозрачная подложка: тап мимо списка закрывает его */}
          <div
            className="langswitch__backdrop"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div className="langswitch__list" role="listbox">
            {languages.map((lang) => {
              const isActive =
                lang.learnLang === activeLanguage.learnLang &&
                lang.nativeLang === activeLanguage.nativeLang;
              return (
                <button
                  key={`${lang.learnLang}-${lang.nativeLang}`}
                  type="button"
                  role="option"
                  aria-selected={isActive}
                  className={
                    "langswitch__item" + (isActive ? " is-active" : "")
                  }
                  onClick={() => pick(lang)}
                >
                  {flagFor(lang.learnLang)}
                  <span className="langswitch__item-name">
                    {t(`lang.${lang.learnLang}`)}
                  </span>
                  <span className="langswitch__item-native">
                    → {t(`lang.${lang.nativeLang}`)}
                  </span>
                  {isActive && (
                    <span className="langswitch__check" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
