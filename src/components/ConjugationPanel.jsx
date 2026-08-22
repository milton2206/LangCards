import { useState, useEffect } from "react";
import { requestConjugation, normalizeForm } from "../lib/conjugationClient.js";
import { learnPronoun } from "../lib/pronouns.js";
import { apiErrorText } from "../lib/apiClient.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import Icon from "./icons/Icon.jsx";
import "./ConjugationPanel.css";

// Порядок строк (лица-числа) и столбцов (времена) таблицы спряжения. Формы и
// МЕСТОИМЕНИЯ — на изучаемом языке, заголовки времён и перевод местоимения —
// на родном (cards.tense.* / cards.pron.*). Времена идут по естественной оси:
// настоящее → прошедшее → будущее.
const PERSONS = ["1sg", "2sg", "3sg", "1pl", "2pl", "3pl"];
const TENSES = ["present", "past", "future"];

// Совпадает ли ячейка таблицы с формой, по которой тапнул человек. Сравниваем и
// целиком, и по последнему слову: в тексте тапают одно слово, а в ячейке может
// стоять форма с частицей («θα πάω» ↔ тап по «πάω»).
function matchesForm(cell, form) {
  const target = normalizeForm(form);
  if (!target) return false;
  const value = normalizeForm(cell);
  if (!value) return false;
  if (value === target) return true;
  const parts = value.split(" ");
  return parts.length > 1 && parts[parts.length - 1] === target;
}

/**
 * ОБЩАЯ панель спряжения глагола — ОДИН модуль на карточку и на текст чтения.
 * Кнопка «Формы» + таблица (местоимения × времена) строятся ПО ЗАПРОСУ, кэш —
 * по НАЧАЛЬНОЙ форме (см. conjugationClient): любая личная форма одного глагола
 * открывает одну и ту же таблицу и повторно API не дёргает. Показывать панель
 * должен вызывающий и ТОЛЬКО для глаголов (word.pos === "verb") — сама панель
 * part-of-speech не проверяет.
 *
 * word — что спрягать (заголовочное слово); learnLang/nativeLang — язык форм /
 *   язык подписей.
 * form — форма, по которой человек тапнул: подсвечиваем её в таблице, чтобы было
 *   видно, где она в системе. Если не передана, подсветки нет.
 * variant — необязательный класс-обёртка для мелкой подгонки под место вызова.
 */
export default function ConjugationPanel({
  word,
  form,
  learnLang,
  nativeLang,
  variant,
}) {
  const { t } = useI18n();
  // conj: null (скрыто) | { status: "loading"|"ready"|"error", table?, lemma?, errorText? }
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
        lemma: res && res.isVerb ? res.lemma : null,
      });
    } catch (err) {
      setConj({
        status: "error",
        errorText: apiErrorText(err, t, "cards.conjFailed"),
      });
    }
  }

  // Местоимение изучаемого языка для строки таблицы. Языка нет в списке —
  // вернётся пустая строка, и строка выглядит как раньше (только перевод).
  const pronOf = (person) => learnPronoun(learnLang, person);
  // Совпало ли местоимение изучаемого языка с подписью на родном (сравниваем
  // без регистра и без разделителей: «он · она» и «он/она» — одно и то же).
  const flat = (s) => String(s).toLowerCase().replace(/[s·/]+/g, "");
  const samePronoun = (person) =>
    Boolean(pronOf(person)) && flat(pronOf(person)) === flat(t(`cards.pron.${person}`));

  // Начальную форму показываем, только если она отличается от того, что человек
  // видел/тапнул — иначе это шум.
  const shownForm = form || word;
  const showLemma =
    conj?.lemma && normalizeForm(conj.lemma) !== normalizeForm(shownForm);

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
        <>
          {showLemma && (
            <p className="conj__lemma">
              {t("cards.conjBase")}:{" "}
              <span className="conj__lemma-word" lang={learnLang}>
                {conj.lemma}
              </span>
            </p>
          )}
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
                    {/* МЕСТОИМЕНИЕ НА ИЗУЧАЕМОМ ЯЗЫКЕ — сверху и крупнее, а
                        перевод под ним мельче: учится связка целиком («I go»,
                        «du gehst»), а не форма с русской подписью сбоку. Двумя
                        строками, а не «I · я»: таблица узкая, в ней три
                        столбца форм, и длинные местоимения («nosotros»,
                        «αυτός/αυτή») в одну строку раздували бы её вширь. */}
                    <th scope="row" className="conj__pron">
                      {pronOf(p) && (
                        <span className="conj__pron-learn" lang={learnLang}>
                          {pronOf(p)}
                        </span>
                      )}
                      {/* У близких языков (русский для украинца) местоимение
                          совпадает с переводом — вторую строку не дублируем. */}
                      {!samePronoun(p) && (
                        <span className="conj__pron-native">
                          {t(`cards.pron.${p}`)}
                        </span>
                      )}
                    </th>
                    {TENSES.map((tn) => {
                      const cell = conj.table[tn]?.[p] || "";
                      const isTapped = matchesForm(cell, form);
                      return (
                        <td
                          key={tn}
                          lang={learnLang}
                          className={isTapped ? "is-tapped" : undefined}
                          aria-current={isTapped ? "true" : undefined}
                        >
                          {cell || "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
