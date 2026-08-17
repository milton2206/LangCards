import { useState, useMemo, useCallback, useRef } from "react";
import { lemmaOfForm } from "../lib/conjugationClient.js";
import {
  buildQuizRun,
  QUIZ_MIN_WORDS,
  QUIZ_RUN_LENGTH,
} from "../lib/quizEngine.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import QuizTask from "../components/QuizTask.jsx";
import Icon from "../components/icons/Icon.jsx";
import "./QuizScreen.css";

// ============================================================================
// Тест с вариантами ответа — ОТДЕЛЬНЫЙ режим («игрушка»).
// ----------------------------------------------------------------------------
// Вне занятия и вне расписания: открывается из ручного хаба в любой момент.
// Гоняем ЛЮБЫЕ свои слова — и взятые, и известные, — независимо от того, созрели
// они или нет.
//
// НА SRS НЕ ВЛИЯЕТ ВООБЩЕ. Это не «мягкое» ограничение, а устройство экрана: сюда
// не передаётся НИ ОДНА функция, которая что-то пишет (ни reviewWord, ни
// markKnown, ни noteKnownOffer) — записывать просто нечем. Ни оценок, ни
// интервалов, ни счётчиков. Человеку об этом говорим спокойно и коротко строкой
// внизу: здесь тренировка ради тренировки, прогресс не двигается.
//
// Пока своих слов меньше порога, режим не прячется молча: экран показывает,
// сколько слов осталось до открытия — иначе функция выглядела бы отсутствующей.
// ============================================================================

export default function QuizScreen({
  // Пул своих слов (взятые + известные с переводом) — собран в App.jsx одной
  // общей функцией, той же, по которой считается порог открытия.
  pool = [],
  learnLang,
  nativeLang,
  onBack,
}) {
  const { t, tp } = useI18n();

  // «Соль» прогона: от неё зависит и набор слов, и порядок вариантов. Новый
  // прогон («Ещё раз») берёт новую соль — иначе тест повторился бы слово в слово.
  const [salt, setSalt] = useState(() => Math.random().toString(36).slice(2));
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState(null);
  const [correctCount, setCorrectCount] = useState(0);

  // Начальные формы берём из уже накопленного индекса спряжений (сети за ним
  // нет): только ими связываются формы с другой основой — ging ↔ gehen. Промах
  // индекса штатен: тогда формат с пропуском просто уступит место другому.
  const lemmaOf = useCallback(
    (form) => lemmaOfForm(learnLang, form),
    [learnLang],
  );

  const ready = pool.length >= QUIZ_MIN_WORDS;

  // Пул берём СВЕЖИЙ на момент сборки прогона, но сам прогон от его изменений
  // не пересобираем: слова могут приехать из облака прямо посреди игры, и тогда
  // задания перетасовались бы под пальцем. Поэтому пул читается через ref, а
  // пересборка происходит только по новой соли («Ещё раз») или когда слов
  // наконец стало достаточно (ready).
  const poolRef = useRef(pool);
  poolRef.current = pool;

  const tasks = useMemo(
    () =>
      ready
        ? buildQuizRun({
            pool: poolRef.current,
            count: QUIZ_RUN_LENGTH,
            salt,
            lemmaOf,
          })
        : [],
    [ready, salt, lemmaOf],
  );

  const total = tasks.length;
  const task = index < total ? tasks[index] : null;
  const finished = total > 0 && index >= total;

  function answer(optionIndex) {
    if (!task || chosen !== null) return;
    setChosen(optionIndex);
    if (task.options[optionIndex]?.correct) setCorrectCount((n) => n + 1);
  }

  function next() {
    setChosen(null);
    setIndex((i) => i + 1);
  }

  function restart() {
    setSalt(Math.random().toString(36).slice(2));
    setIndex(0);
    setChosen(null);
    setCorrectCount(0);
  }

  const header = (
    <header className="quiz__header">
      <button
        type="button"
        className="quiz__back"
        onClick={onBack}
        aria-label={t("common.back")}
      >
        ←
      </button>
      <h1 className="quiz__title">{t("quiz.title")}</h1>
    </header>
  );

  // Порог видимый: пока слов мало, честно говорим сколько осталось.
  if (!ready) {
    const left = QUIZ_MIN_WORDS - pool.length;
    return (
      <section className="quiz">
        {header}
        <div className="quiz__center">
          <div className="quiz__badge" aria-hidden="true">
            <Icon name="lock" size={28} />
          </div>
          <h2 className="quiz__locked-title">
            {t("quiz.locked", { n: left, word: tp("plural.words", left) })}
          </h2>
          <p className="quiz__hint">
            {t("quiz.lockedHint", { min: QUIZ_MIN_WORDS })}
          </p>
          <button type="button" className="quiz__ghost" onClick={onBack}>
            {t("common.back")}
          </button>
        </div>
      </section>
    );
  }

  // Слов хватает, но заданий не собралось (у слов нет переводов-пар нужного
  // вида). Тупика не делаем — объясняем и отпускаем.
  if (total === 0) {
    return (
      <section className="quiz">
        {header}
        <div className="quiz__center">
          <p className="quiz__hint">{t("quiz.empty")}</p>
          <button type="button" className="quiz__ghost" onClick={onBack}>
            {t("common.back")}
          </button>
        </div>
      </section>
    );
  }

  if (finished) {
    return (
      <section className="quiz">
        {header}
        <div className="quiz__center">
          <div className="quiz__done-emoji" aria-hidden="true">
            🎯
          </div>
          <h2 className="quiz__done-title">{t("quiz.doneTitle")}</h2>
          <p className="quiz__score">
            {t("quiz.score", { n: correctCount, total })}
          </p>
          <div className="quiz__actions">
            <button type="button" className="quiz__primary" onClick={restart}>
              {t("quiz.again")}
            </button>
            <button type="button" className="quiz__ghost" onClick={onBack}>
              {t("common.done")}
            </button>
          </div>
        </div>
        <p className="quiz__footnote">{t("quiz.noSrsNote")}</p>
      </section>
    );
  }

  return (
    <section className="quiz">
      {header}

      {/* Прогресс прогона — точками, как в вопросах на понимание. */}
      <span
        className="quiz__dots"
        aria-label={t("quiz.progress", { n: index + 1, total })}
      >
        {tasks.map((_, i) => (
          <span
            key={i}
            className={
              "quiz__dot" + (i === index ? " is-active" : i < index ? " is-done" : "")
            }
            aria-hidden="true"
          />
        ))}
      </span>

      <QuizTask
        task={task}
        chosen={chosen}
        onAnswer={answer}
        learnLang={learnLang}
        nativeLang={nativeLang}
      />

      {chosen !== null && (
        <button type="button" className="quiz__next" onClick={next}>
          {index + 1 < total ? t("quiz.next") : t("quiz.finish")}
        </button>
      )}

      {/* Спокойно и коротко: здесь прогресс не двигается. */}
      <p className="quiz__footnote">{t("quiz.noSrsNote")}</p>
    </section>
  );
}
