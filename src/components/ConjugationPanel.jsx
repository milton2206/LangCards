import { useState, useEffect } from "react";
import { requestConjugation } from "../lib/conjugationClient.js";
import { apiErrorText } from "../lib/apiClient.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import Icon from "./icons/Icon.jsx";
import "./ConjugationPanel.css";

// Порядок строк (лица-числа) и столбцов (времена) таблицы спряжения. Подписи
// местоимений и заголовки времён — из i18n на родном языке (cards.pron.* /
// cards.tense.*), формы — на изучаемом.
const PERSONS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
const TENSES = ["present", "future", "past"];

/**
 * ОБЩАЯ панель спряжения глагола — ОДИН модуль на карточку и на текст чтения.
 * Кнопка «Формы» + таблица (местоимения × времена) строятся ПО ЗАПРОСУ, с общим
 * кэшем по слову (conjugationClient): одно и то же слово из карточки и из текста
 * не генерируется дважды. Показывать панель должен вызывающий и ТОЛЬКО для
 * глаголов (word.pos === "verb") — сама панель part-of-speech не проверяет.
 *
 * word — что спрягать; learnLang/nativeLang — язык форм / язык подписей.
 * variant — необязательный класс-обёртка для мелкой подгонки под место вызова.
 */
export default function ConjugationPanel({
  word,
  learnLang,
  nativeLang,
  variant,
}) {
  const { t } = useI18n();
  // conj: null (скрыто) | { status: "loading"|"ready"|"error", table?, errorText? }
  const [conj, setConj] = useState(null);

  // Смена слова — сворачиваем прошлую таблицу (чтобы не «прилипала»).
  useEffect(() => {
    setConj(null);
  }, [word]);

  async function handleToggle() {
    // Повторный тап — свернуть: данные уже в кэше, следующее открытие мгновенно.
    if (conj) {
      setConj(null);
      return;
    }
    setConj({ status: "loading" });
    try {
      const res = await requestConjugation({ word, learnLang, nativeLang });
      setConj({
        status: "ready",
        table: res && res.isVerb ? res.conjugation : null,
      });
    } catch (err) {
      setConj({
        status: "error",
        errorText: apiErrorText(err, t, "cards.conjFailed"),
      });
    }
  }

  return (
    <div className={"conj" + (variant ? ` conj--${variant}` : "")}>
      <button
        type="button"
        className={"conj__btn" + (conj ? " is-open" : "")}
        onClick={handleToggle}
        disabled={conj?.status === "loading"}
        aria-expanded={Boolean(conj)}
      >
        <Icon name="grammar" size={18} className="conj__btn-icon" />
        {t("cards.conjugation")}
      </button>

      {conj?.status === "loading" && (
        <p className="conj__note">{t("cards.conjLoading")}</p>
      )}
      {conj?.status === "error" && <p className="conj__error">{conj.errorText}</p>}
      {conj?.status === "ready" && !conj.table && (
        <p className="conj__note">{t("cards.conjNotVerb")}</p>
      )}
      {conj?.status === "ready" && conj.table && (
        <div className="conj__table-wrap">
          <table className="conj__table">
            <thead>
              <tr>
                <th className="conj__corner" aria-hidden="true" />
                {TENSES.map((tn) => (
                  <th key={tn} scope="col">
                    {t(`cards.tense.${tn}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERSONS.map((p) => (
                <tr key={p}>
                  <th scope="row" className="conj__pron">
                    {t(`cards.pron.${p}`)}
                  </th>
                  {TENSES.map((tn) => (
                    <td key={tn} lang={learnLang}>
                      {conj.table[tn]?.[p] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
