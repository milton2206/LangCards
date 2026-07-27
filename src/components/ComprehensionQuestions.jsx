import { useState, useEffect, useMemo, useRef } from "react";
import { checkComprehension } from "../lib/comprehensionClient.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./ComprehensionQuestions.css";

// ============================================================================
// Общий блок вопросов на понимание «верно/неверно» (фаза 6.2). ОДИН на два
// источника: и мини-диалог аудирования, и текст чтения отдают одинаковые
// вопросы, а этот компонент их проводит: показывает утверждение, принимает
// ответ, при ОШИБКЕ раскрывает объяснение (почему, со ссылкой на содержание).
// ----------------------------------------------------------------------------
// questions — [{ statement, statementTranslation, answer:boolean, explanation }].
// learnLang / nativeLang — для правильного языка текста утверждения и перевода.
// footer     — что показать под итогом (аудирование кладёт сюда расшифровку
//              диалога, чтобы её нельзя было прочитать ДО ответов).
// ============================================================================
export default function ComprehensionQuestions({
  questions,
  learnLang,
  nativeLang,
  footer = null,
  // Движок заданий (необязательно): вызывается ОДИН раз, когда пользователь
  // реально прошёл все вопросы (дошёл до итога) — по этому событию блок занятия
  // отмечается выполненным. Простой заход на экран его не вызывает.
  onFinished = null,
}) {
  const { t } = useI18n();

  // Подпись набора: по ней сбрасываемся, когда пришли ДРУГИЕ вопросы (новый
  // диалог/текст), но не при перерисовке тем же набором.
  const sig = useMemo(
    () => (questions || []).map((q) => q.statement).join("|"),
    [questions],
  );

  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(null); // выбранный ответ: true|false|null
  const [correctCount, setCorrectCount] = useState(0);

  // Смена набора вопросов — начинаем сначала.
  useEffect(() => {
    setIndex(0);
    setChosen(null);
    setCorrectCount(0);
    finishedFiredRef.current = false; // новый набор — событие завершения снова доступно
  }, [sig]);

  const list = Array.isArray(questions) ? questions : [];
  const total = list.length;
  const current = index < total ? list[index] : null;
  const finished = total > 0 && index >= total;
  const result = chosen === null || !current ? null : checkComprehension(current.answer, chosen);

  // Реальное завершение: пользователь дошёл до итога, ответив на все вопросы.
  // Сообщаем движку заданий ОДИН раз (не при каждой перерисовке итога).
  const finishedFiredRef = useRef(false);
  useEffect(() => {
    if (finished && !finishedFiredRef.current) {
      finishedFiredRef.current = true;
      onFinished?.();
    }
  }, [finished, onFinished]);

  function answer(value) {
    if (!current || chosen !== null) return;
    setChosen(value);
    if (checkComprehension(current.answer, value).correct) {
      setCorrectCount((n) => n + 1);
    }
  }

  function next() {
    setChosen(null);
    setIndex((i) => i + 1);
  }

  // Пройти заново тот же набор — БЕЗ запроса к API (вопросы уже на руках).
  function retake() {
    setIndex(0);
    setChosen(null);
    setCorrectCount(0);
  }

  if (total === 0) return null;

  if (finished) {
    return (
      <div className="comp">
        <div className="comp__done" role="status">
          <div className="comp__done-emoji" aria-hidden="true">
            🎉
          </div>
          <h3 className="comp__done-title">{t("comprehension.doneTitle")}</h3>
          <p className="comp__done-score">
            {t("comprehension.score", { n: correctCount, total })}
          </p>
          <button type="button" className="comp__retake" onClick={retake}>
            {t("comprehension.retake")}
          </button>
        </div>
        {footer}
      </div>
    );
  }

  return (
    <div className="comp">
      <div className="comp__head">
        <span className="comp__progress">
          {t("comprehension.progress", { n: index + 1, total })}
        </span>
      </div>

      <p className="comp__prompt">{t("comprehension.prompt")}</p>

      <p className="comp__statement" lang={learnLang}>
        {current.statement}
      </p>
      {current.statementTranslation && (
        <p className="comp__statement-tr" lang={nativeLang}>
          {current.statementTranslation}
        </p>
      )}

      {/* Ответ «верно/неверно» */}
      <div className="comp__answers" role="group">
        {[true, false].map((value) => {
          let mark = "";
          if (result) {
            if (current.answer === value) mark = " is-correct";
            else if (chosen === value) mark = " is-wrong";
          }
          return (
            <button
              key={String(value)}
              type="button"
              className={"comp__answer" + mark}
              disabled={chosen !== null}
              aria-pressed={chosen === value}
              onClick={() => answer(value)}
            >
              {value ? t("comprehension.true") : t("comprehension.false")}
            </button>
          );
        })}
      </div>

      {/* Проверка: вердикт, а при ОШИБКЕ — объяснение со ссылкой на содержание. */}
      {result && (
        <div
          className={"comp__result" + (result.correct ? " is-correct" : " is-wrong")}
          role="status"
        >
          <p className="comp__verdict">
            {result.correct
              ? `✅ ${t("comprehension.right")}`
              : `❌ ${t("comprehension.wrong")}`}
          </p>
          {!result.correct && current.explanation && (
            <div className="comp__why">
              <p className="comp__why-label">{t("comprehension.why")}</p>
              <p className="comp__why-text" lang={nativeLang}>
                {current.explanation}
              </p>
            </div>
          )}
          <button type="button" className="comp__next" onClick={next}>
            {index + 1 < total
              ? t("comprehension.next")
              : t("comprehension.finish")}
          </button>
        </div>
      )}
    </div>
  );
}
