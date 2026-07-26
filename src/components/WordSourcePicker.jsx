import { WORD_SOURCES } from "../lib/wordSource.js";
import { ENOUGH_WORDS_FOR_READING } from "../hooks/useWordLists.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./WordSourcePicker.css";

/**
 * Выбор источника слов (mine / mixed / new) — одна и та же настройка на чтении и
 * аудировании. Показывает текущее значение и меняет его через onChange.
 *
 * takenCount нужен для мягкой подсказки: если выбрано «Мои слова», а взятых слов
 * мало (порог из 6.1 — ENOUGH_WORDS_FOR_READING), предупреждаем, что разнообразие
 * будет ограничено и слова начнут повторяться, и предлагаем «Смешанно».
 * Не блокируем — это подсказка, а не запрет. Один и тот же пикер в чтении и в
 * обоих форматах аудирования — источник везде работает полноценно.
 */
export default function WordSourcePicker({ value, onChange, takenCount = 0 }) {
  const { t } = useI18n();
  const fewForMine =
    value === "mine" && takenCount < ENOUGH_WORDS_FOR_READING;

  return (
    <div className="wordsource">
      <span className="wordsource__label">{t("wordSource.label")}</span>
      <div className="wordsource__chips" role="group">
        {WORD_SOURCES.map((s) => (
          <button
            key={s}
            type="button"
            className={
              "wordsource__chip" + (value === s ? " is-active" : "")
            }
            aria-pressed={value === s}
            onClick={() => onChange(s)}
          >
            {t(`wordSource.${s}`)}
          </button>
        ))}
      </div>
      <p className="wordsource__hint">{t(`wordSource.hint.${value}`)}</p>

      {fewForMine && (
        <div className="wordsource__warn" role="status">
          <p className="wordsource__warn-text">{t("wordSource.fewMine")}</p>
          <button
            type="button"
            className="wordsource__warn-cta"
            onClick={() => onChange("mixed")}
          >
            {t("wordSource.switchMixed")}
          </button>
        </div>
      )}
    </div>
  );
}
