import { useI18n } from "../i18n/I18nContext.jsx";
import Icon from "./icons/Icon.jsx";
import "./QuizTask.css";

// ============================================================================
// ОДНО задание теста с вариантами ответа. Общий компонент на два режима: и на
// повторение (тест вместо карточки), и на отдельный игровой прогон — задание
// выглядит и ведёт себя одинаково, различается только то, что снаружи делают
// с ответом.
// ----------------------------------------------------------------------------
// Компонент НИЧЕГО не решает и не считает: задание уже собрано (см.
// lib/quizEngine.js), выбранный вариант хранит родитель. Здесь только показ.
//
// ПОСЛЕ ОТВЕТА — просто верно или неверно: выбранный вариант получает галочку
// или крестик, при ошибке спокойно подсвечивается правильный. Плашки-вердикта
// («Правильно!») здесь НЕТ намеренно — такие плашки мы недавно убирали из
// вопросов на понимание: они повторяли вторым текстом то, что уже сказано
// самой кнопкой. Для тех, кто слушает экран, результат называет скрытая строка.
// Карточка с примером и озвучкой по ответу НЕ открывается — она замедлила бы
// поток; пример и звук человек видит на обычных карточках, с которыми тест
// чередуется.
// ============================================================================

const PROMPT_KEY = {
  wordToTranslation: "quiz.promptWord",
  translationToWord: "quiz.promptTranslation",
  cloze: "quiz.promptCloze",
};

export default function QuizTask({
  task,
  // Индекс выбранного варианта или null, пока ответа нет. Ответ дан ровно один
  // раз: дальше кнопки неактивны, и порядок вариантов уже не меняется.
  chosen = null,
  onAnswer,
  learnLang,
  nativeLang,
}) {
  const { t } = useI18n();
  if (!task) return null;

  const answered = chosen !== null;
  const correct = answered && Boolean(task.options[chosen]?.correct);
  const promptLang = task.promptLang === "native" ? nativeLang : learnLang;
  const optionsLang = task.optionsLang === "native" ? nativeLang : learnLang;

  return (
    <div className="quiz-task">
      {/* Что делать — на родном языке; сам материал — на изучаемом. */}
      <p className="quiz-task__prompt">{t(PROMPT_KEY[task.format])}</p>

      {task.segments ? (
        // Пропуск в примере: предложение карточки, из которого вырезано
        // изучаемое слово. Место пропуска — заметный прочерк, а не пустота.
        <p className="quiz-task__text" lang={learnLang}>
          {task.segments.map((seg, i) =>
            seg.blank ? (
              <span key={i} className="quiz-task__blank">
                {/* Прочерк рисует CSS; слушающим экран пропуск называем словом,
                    иначе предложение прочлось бы без разрыва. */}
                <span className="visually-hidden">{t("quiz.blankAria")}</span>
                {"    "}
              </span>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
      ) : (
        <p className="quiz-task__text" lang={promptLang}>
          {task.prompt}
        </p>
      )}

      <div className="quiz-task__options" role="group">
        {task.options.map((option, i) => {
          // ДО ответа все варианты одинаковы и нейтральны — правильный ничем не
          // выделен. ПОСЛЕ: правильный оливковым, ошибочный выбор — красноватым.
          let mark = "";
          if (answered) {
            if (option.correct) mark = " is-correct";
            else if (i === chosen) mark = " is-wrong";
          }
          return (
            <button
              key={i}
              type="button"
              className={"quiz-task__option" + mark}
              lang={optionsLang}
              disabled={answered}
              onClick={() => onAnswer(i)}
            >
              {mark === " is-correct" && (
                <Icon name="check" size={18} className="quiz-task__option-icon" />
              )}
              {mark === " is-wrong" && (
                <Icon name="close" size={18} className="quiz-task__option-icon" />
              )}
              <span className="quiz-task__option-text">{option.text}</span>
            </button>
          );
        })}
      </div>

      {/* Цвет и иконка — сигнал только для глаз. Тем, кто слушает экран,
          результат сообщает эта строка: её не видно, но она читается вслух. */}
      {answered && (
        <p className="visually-hidden" role="status">
          {correct ? t("quiz.right") : t("quiz.wrong")}
        </p>
      )}
    </div>
  );
}
