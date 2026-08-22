import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { highlightWordInExample } from "../../lib/highlightWord.js";
import { lemmaOfForm } from "../lib/conjugationClient.js";
import { formatInterval } from "../i18n/format.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import { nextSrs, shouldOfferKnown } from "../hooks/useWordLists.js";
import { cardForDisplay, learnText } from "../lib/displayText.js";
import { reviewDirection, REVERSE } from "../lib/reviewDirection.js";
import {
  buildQuizTask,
  QUIZ_MIN_WORDS,
  QUIZ_REVIEW_EVERY,
  QUIZ_REVIEW_SLOT,
} from "../lib/quizEngine.js";
import PlayButton from "../components/PlayButton.jsx";
import QuizTask from "../components/QuizTask.jsx";
import Icon from "../components/icons/Icon.jsx";
import "./ReviewScreen.css";

const GRADES = [
  // «Не помню» не откладывает слово на интервал, а возвращает его дальше в
  // текущей сессии (replay) — поэтому вместо срока показываем «повторить сейчас».
  { grade: "again", cls: "again", replay: true },
  { grade: "hard", cls: "hard" },
  { grade: "good", cls: "good" },
  { grade: "easy", cls: "easy" },
];

// На сколько карточек назад отправить слово при «Не помню» — чтобы был
// небольшой промежуток на вспоминание, а не мгновенный повтор.
const REQUEUE_GAP = 3;

// Сколько раз за одно занятие можно предложить перенос в известные. Без потолка
// после долгого перерыва человека завалило бы вопросами. Но потолок 3 при 150
// активных словах давал слишком медленный отток (созревает по 10–15 в день),
// поэтому здесь 6, а разгружаться пачкой можно в списке «Мои слова» — там
// созревшие разбираются списком, а не по одному.
const KNOWN_OFFERS_PER_SESSION = 6;

/**
 * Экран повторения ВЗЯТЫХ слов (интервальное повторение) — отдельный режим
 * от потока новых карточек (Взять/Пропустить/Знаю там не трогаем).
 *
 * НАПРАВЛЕНИЕ ВОПРОСА ЧЕРЕДУЕТСЯ у одного и того же слова между повторениями
 * (см. lib/reviewDirection.js). ПРЯМОЕ: лицо — пример предложения целиком, с
 * выделенным изучаемым словом (учим слово в контексте, а не изолированно).
 * ОБРАТНОЕ: лицо — только перевод на родном языке, человек вспоминает само
 * слово; примера, транскрипции и озвучки на лице НЕТ — каждое из них выдало бы
 * ответ. Оборот в обоих направлениях одинаковый.
 *
 * По тапу «Показать перевод» (в обратном направлении — «Показать слово»)
 * открывается само слово, транскрипция, перевод слова и перевод предложения,
 * затем самооценка (4 кнопки) пересчитывает интервал повтора (см. nextSrs
 * в useWordLists.js) и переходит к следующему слову.
 *
 * ЧАСТЬ слов показывается ТЕСТОМ с вариантами ответа вместо карточки с
 * самооценкой (см. блок «Тест в потоке повторения» ниже). Тест карточки не
 * заменяет — он с ними ЧЕРЕДУЕТСЯ: пример и озвучка остаются несущей идеей.
 *
 * dueWords — живой список слов «пора повторить» (пересчитывается в App.jsx
 * после каждой оценки: слово с обновлённым nextReviewDate уходит из очереди
 * само, отдельный index не нужен).
 *
 * Порядок показа держим в ЛОКАЛЬНОЙ очереди сессии (queue): «Не помню» не
 * трогает интервал слова (оно остаётся «пора повторить»), а лишь отправляет
 * его на несколько карточек назад — так слово крутится в текущей сессии, пока
 * по нему не нажмут другую кнопку. Остальные оценки применяют интервал через
 * onReview → слово выпадает из dueWords и очередь его убирает при синхронизации.
 */
export default function ReviewScreen({
  dueWords,
  wordInfo,
  srsByWord,
  todayKey,
  learnLang,
  nativeLang,
  onReview,
  onBack,
  // Движок заданий (необязательно): вызывается ОДИН раз, когда пройдены ВСЕ
  // созревшие слова (очередь опустела) — по этому событию блок «повторение»
  // отмечается выполненным. Простой заход и выход его не вызывает.
  onFinished = null,
  // Чек-пойнт «похоже, ты его знаешь»: перенос слова в известные по согласию
  // человека и отметка «про это слово уже спрашивали». Без них экран работает
  // как раньше — предложение просто не показывается.
  onPromoteToKnown = null,
  onOfferShown = null,
  // Пул своих слов для теста с вариантами (взятые + известные с переводом).
  // Пустой или короткий пул — теста просто не будет, повторение идёт как раньше.
  quizPool = [],
}) {
  const { t, lang } = useI18n();
  const [revealed, setRevealed] = useState(false);
  const [queue, setQueue] = useState(() => dueWords);

  // Чек-пойнт «похоже, ты его знаешь»: { word, interval } — предложение живёт
  // РЯДОМ с потоком, а не вместо него. Пока оно на экране, следующее слово уже
  // показано, поэтому в тексте называем само слово — иначе непонятно, о каком
  // идёт речь. Отказ записывается в момент ПОКАЗА, поэтому «просто пойти
  // дальше» равносильно «пока оставить» и переживает закрытие приложения.
  const [knownOffer, setKnownOffer] = useState(null);
  const offersLeftRef = useRef(KNOWN_OFFERS_PER_SESSION);

  // ---------- Тест в потоке повторения ----------
  // step — сквозной номер показанного задания за это занятие (не номер слова:
  // «Не помню» возвращает слово в очередь, и оно считается заново). По нему и
  // чередуются карточки с тестом, и чередуются форматы самого теста.
  const [step, setStep] = useState(0);
  const [quizChosen, setQuizChosen] = useState(null);
  // Слова, на которых человек уже ошибся в тесте: они возвращаются в очередь и
  // дальше показываются ТОЛЬКО карточкой. Правильный ответ ему только что
  // показали — спрашивать тем же тестом снова бессмысленно, а вот пример с
  // озвучкой после ошибки как раз к месту.
  const failedQuizRef = useRef(new Set());
  // «Соль» перемешивания на этот заход: порядок вариантов стабилен, пока
  // задание на экране, но у следующего занятия он другой.
  const quizSaltRef = useRef(Math.random().toString(36).slice(2));

  // Синхронизация очереди с актуальным набором «пора повторить»: убираем слова,
  // которые уже ушли на интервал (после Трудно/Нормально/Легко), и добавляем
  // новые. Локальный порядок (в т.ч. переносы от «Не помню») сохраняется.
  // «Не помню» не меняет dueWords, поэтому эта синхронизация не сбрасывает его.
  useEffect(() => {
    setQueue((prev) => {
      const due = new Set(dueWords);
      const kept = prev.filter((w) => due.has(w));
      const keptSet = new Set(kept);
      const added = dueWords.filter((w) => !keptSet.has(w));
      const next = [...kept, ...added];
      const same =
        next.length === prev.length && next.every((w, i) => w === prev[i]);
      return same ? prev : next;
    });
  }, [dueWords]);

  const total = queue.length;
  const currentWord = queue[0];

  // Новое слово в очереди — прячем ответ и снимаем выбранный вариант теста.
  useEffect(() => {
    setRevealed(false);
    setQuizChosen(null);
  }, [currentWord]);

  // Все созревшие пройдены (очередь опустела) — сообщаем движку ОДИН раз.
  // Пока на экране висит предложение «перенести в известные», сигнал придержан:
  // движок по нему уводит к плану занятия, и вопрос по ПОСЛЕДНЕМУ слову очереди
  // исчез бы вместе с экраном, так и не показавшись. Ответ (или «пока оставить»)
  // отпускает сигнал, и возврат к плану происходит как обычно.
  const finishedFiredRef = useRef(false);
  useEffect(() => {
    if (!currentWord && !knownOffer && !finishedFiredRef.current) {
      finishedFiredRef.current = true;
      onFinished?.();
    }
  }, [currentWord, knownOffer, onFinished]);

  // Начальные формы — из уже накопленного индекса спряжений (сети за ним нет).
  const lemmaOf = useCallback(
    (form) => lemmaOfForm(learnLang, form),
    [learnLang],
  );

  // Тест вместо карточки — каждое N-е задание, и только если задание реально
  // собирается из СВОИХ слов человека. Не собралось (мало похожих слов нужной
  // части речи) — слово идёт обычной карточкой: лучше пропустить тест, чем
  // показать очевидное. Порог QUIZ_MIN_WORDS общий с отдельным режимом.
  const quizTask = useMemo(() => {
    if (!currentWord) return null;
    if (quizPool.length < QUIZ_MIN_WORDS) return null;
    if (step % QUIZ_REVIEW_EVERY !== QUIZ_REVIEW_SLOT) return null;
    if (failedQuizRef.current.has(currentWord)) return null;
    const entry = quizPool.find((e) => e.word === currentWord);
    if (!entry) return null;
    return buildQuizTask({
      entry,
      pool: quizPool,
      // Номер ЗАДАНИЯ ТЕСТА, а не номер шага повторения. Тесты выпадают всегда
      // на один и тот же остаток от деления шага, поэтому от самого step формат
      // был бы вечно одним и тем же (только «перевод → слово»), а форматы
      // должны чередоваться сами.
      index: Math.floor(step / QUIZ_REVIEW_EVERY),
      salt: quizSaltRef.current,
      lemmaOf,
    });
  }, [currentWord, quizPool, step, lemmaOf]);

  // «Не помню» — вернуть слово в текущую сессию через несколько карточек, не
  // применяя интервал. Остальные оценки — обычный SRS (слово покидает сессию).
  function handleGrade(word, grade) {
    setRevealed(false);
    setQuizChosen(null);
    // Одно задание показано — двигаем сквозной счётчик (от него зависит, чем
    // будет следующее: карточкой или тестом, и каким форматом теста).
    setStep((s) => s + 1);
    // Предложение по предыдущему слову больше не к месту — человек пошёл
    // дальше. Это и есть «пока оставить», спрашивать второй раз не будем.
    setKnownOffer(null);
    if (grade === "again") {
      setQueue((prev) => {
        if (prev.length <= 1) return prev; // некуда переносить — покажем снова
        const [first, ...rest] = prev;
        const pos = Math.min(REQUEUE_GAP, rest.length);
        return [...rest.slice(0, pos), first, ...rest.slice(pos)];
      });
      return;
    }
    onReview(word, grade);

    // Слово созрело — спокойно спрашиваем, не перенести ли его в известные.
    // Только после УСПЕШНОГО вспоминания («Нормально»/«Легко»): «Трудно» — это
    // ещё не «знаю». Интервал считаем той же nextSrs, что применилась к слову.
    if (grade !== "good" && grade !== "easy") return;
    if (!onPromoteToKnown || offersLeftRef.current <= 0) return;
    const srs = srsByWord[word];
    const interval = nextSrs(srs, grade, todayKey).interval;
    if (!shouldOfferKnown(srs, interval)) return;
    offersLeftRef.current -= 1;
    setKnownOffer({ word, interval });
    onOfferShown?.(word, interval);
  }

  // Ответ на тест ЗАСЧИТЫВАЕТСЯ ОЦЕНКОЙ, той же самой, что и кнопка на
  // карточке: верно → «Нормально», неверно → «Не помню». Промежуточных оценок
  // тест не даёт, и это нормально — оттенки («Трудно»/«Легко») остаются на
  // карточках. Идём через тот же handleGrade, поэтому и SRS, и чек-пойнт
  // «перенести в известные» работают ровно как после оценки на карточке.
  //
  // Оценка применяется НЕ в момент ответа, а по кнопке «Дальше»: иначе слово
  // ушло бы из очереди сразу и человек не успел бы увидеть, где правильный
  // вариант.
  function handleQuizNext() {
    if (quizChosen === null || !quizTask) return;
    const correct = Boolean(quizTask.options[quizChosen]?.correct);
    if (!correct) failedQuizRef.current.add(quizTask.word);
    handleGrade(quizTask.word, correct ? "good" : "again");
  }

  // Перенос по согласию: слово уходит в известные КАК ЕСТЬ — состояние
  // повторения не переписывается, поэтому вернуть его в изучение можно без
  // потери накопленного прогресса.
  function acceptKnownOffer() {
    if (!knownOffer) return;
    onPromoteToKnown(knownOffer.word);
    setKnownOffer(null);
  }

  // Предложение занимает место рядом с потоком и закрывается чем угодно —
  // ответом, следующей оценкой или уходом с экрана. Ничего не блокирует.
  const offerBanner = knownOffer ? (
    <div className="review__offer" role="group" aria-label={t("knownOffer.aria")}>
      <div className="review__offer-text">
        <p className="review__offer-title">
          {t("knownOffer.title", {
            word: learnText(knownOffer.word, learnLang),
          })}
        </p>
        <p className="review__offer-hint">
          {t("knownOffer.hint", {
            interval: formatInterval(t, lang, knownOffer.interval),
          })}
        </p>
      </div>
      <div className="review__offer-actions">
        <button
          type="button"
          className="review__offer-yes"
          onClick={acceptKnownOffer}
        >
          {t("knownOffer.yes")}
        </button>
        <button
          type="button"
          className="review__offer-later"
          onClick={() => setKnownOffer(null)}
        >
          {t("knownOffer.later")}
        </button>
      </div>
    </div>
  ) : null;

  if (!currentWord) {
    return (
      <section className="review review--status">
        <button
          type="button"
          className="review__back-corner"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        {/* Созрело последнее слово в очереди — предложение не должно пропасть
            вместе с очередью, поэтому живёт и на экране «всё повторено». */}
        {offerBanner}
        <div className="review__status-badge" aria-hidden="true">
          <Icon name="check" size={32} />
        </div>
        <h1 className="review__status-title">{t("review.doneTitle")}</h1>
        <p className="review__status-hint">{t("review.doneHint")}</p>
        <button type="button" className="review__done" onClick={onBack}>
          {t("common.done")}
        </button>
      </section>
    );
  }

  // Шапка одна на оба вида задания (карточка и тест): счётчик «осталось» и
  // выход не должны прыгать при чередовании.
  const headerBar = (
    <header className="review__header">
      <button
        type="button"
        className="review__back"
        onClick={onBack}
        aria-label={t("common.back")}
      >
        ←
      </button>
      <span className="review__remaining">
        {t("review.remaining", { n: total })}
      </span>
    </header>
  );

  // ---------- Задание тестом (вместо карточки с самооценкой) ----------
  if (quizTask) {
    return (
      <section className="review">
        {headerBar}
        {offerBanner}
        <div className="review__quiz">
          <QuizTask
            task={quizTask}
            chosen={quizChosen}
            onAnswer={setQuizChosen}
            learnLang={learnLang}
            nativeLang={nativeLang}
          />
          {quizChosen !== null && (
            <button
              type="button"
              className="review__quiz-next"
              onClick={handleQuizNext}
            >
              {t("quiz.next")}
            </button>
          )}
          {/* Честно говорим, как ответ засчитывается: тест — это те же две
              оценки, а не отдельная валюта. */}
          <p className="review__quiz-note">{t("quiz.reviewNote")}</p>
        </div>
      </section>
    );
  }

  // На экран идёт ПОЧИЩЕННАЯ копия записи: у слов, взятых до появления
  // зачистки, в самом слове и в примере остались знаки ударения. Ключом всюду
  // остаётся currentWord — им и оценивается слово (onReview), и берётся запись
  // из wordInfo. Подсветку тоже считаем по чистой паре: знак в слове мешал бы
  // сопоставлению с примером.
  const info = wordInfo[currentWord] || {};
  const view = cardForDisplay({ ...info, word: currentWord }, learnLang);
  const hasExample = Boolean(view.example);
  const segments = hasExample
    ? // Третьим аргументом — доступ к уже накопленному индексу начальных форм:
      // только им связываются формы с другой основой (ging ↔ gehen). Сети за
      // ним нет, промах индекса штатен — сработает сравнение по основе.
      highlightWordInExample(view.example, view.word, lemmaOf)
    : [];

  // Какой интервал реально применится при каждой оценке — считаем той же
  // функцией, что и на самом нажатии (nextSrs), с текущими параметрами
  // ИМЕННО этого слова, поэтому у разных слов подписи разные.
  const currentSrs = srsByWord[currentWord];

  // Сторона вопроса для ЭТОГО слова. Считается от repetitions, поэтому внутри
  // сессии не меняется: «Не помню» SRS не применяет (слово лишь переносится по
  // очереди), и слово возвращается той же стороной — см. lib/reviewDirection.js.
  //
  // К ТЕСТУ ЭТО НЕ ОТНОСИТСЯ. Если слово выпало на тест с вариантами, экран
  // вернул разметку теста выше и до карточки не дошёл: два механизма стоят
  // последовательно, а не спорят за одно и то же слово. Тест чередует свои
  // форматы сам (см. buildQuizTask), направление карточки его не касается.
  const isReverse =
    reviewDirection(currentSrs, Boolean(view.translation)) === REVERSE;

  const gradesWithInterval = GRADES.map((g) => ({
    ...g,
    interval: nextSrs(currentSrs, g.grade, todayKey).interval,
  }));

  return (
    <section className="review" aria-labelledby="review-word">
      {headerBar}

      {offerBanner}

      <article className="review__card">
        {!revealed && isReverse ? (
          /* ЛИЦО ОБРАТНОЙ КАРТОЧКИ: ТОЛЬКО ПЕРЕВОД, и это существенно.
             Примера здесь нет — в нём стоит само изучаемое слово, то есть
             ответ. Транскрипции нет — она читается как слово. Кнопки озвучки
             нет — послушать слово значит услышать ответ. Всё это появляется на
             обороте, вместе с разбором. */
          <div className="review__front review__front--reverse">
            <p className="review__ask">{t("review.askWord")}</p>
            <p
              id="review-word"
              className="review__reverse-translation"
              lang={nativeLang}
            >
              {view.translation}
            </p>
            <button
              type="button"
              className="review__reveal"
              onClick={() => setRevealed(true)}
            >
              {t("review.revealWord")}
            </button>
          </div>
        ) : !revealed ? (
          /* Лицо: ПРИМЕР целиком с выделенным изучаемым словом — слово
             вспоминается в контексте, а не в пустоте. Транскрипции здесь нет
             намеренно: она подсказывала бы ответ раньше времени. Разбор (слово,
             транскрипция, переводы, заметка) открывается по «Показать перевод». */
          <div
            className={
              "review__front" + (hasExample ? " review__front--example" : "")
            }
          >
            {hasExample ? (
              <div className="review__sentence-row">
                <p
                  id="review-word"
                  className="review__sentence"
                  lang={learnLang}
                >
                  {segments.map((seg, i) =>
                    seg.highlight ? (
                      <mark key={i} className="review__highlight">
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    ),
                  )}
                </p>
                <PlayButton
                  text={view.example}
                  learnLang={learnLang}
                  kind="example"
                  appearance="ember"
                />
              </div>
            ) : (
              // Нет сохранённого примера (старые записи в wordInfo) — лицом
              // остаётся само слово: рабочий фолбэк, экран не ломается.
              <div className="review__front-word">
                <h1 id="review-word" className="review__word" lang={learnLang}>
                  {view.word}
                </h1>
                <PlayButton
                  text={view.word}
                  learnLang={learnLang}
                  kind="word"
                  appearance="ember"
                />
              </div>
            )}
            <button
              type="button"
              className="review__reveal"
              onClick={() => setRevealed(true)}
            >
              {t("review.reveal")}
            </button>
          </div>
        ) : (
          /* Оборот (после тапа): сверху ПАРА «предложение → его перевод» (они
             читаются вместе, поэтому стоят рядом), ниже разбор самого слова —
             слово, транскрипция, перевод слова, заметка. */
          <>
            {hasExample ? (
              <div className="review__example-block">
                <div className="review__sentence-row">
                  <p className="review__sentence" lang={learnLang}>
                    {segments.map((seg, i) =>
                      seg.highlight ? (
                        <mark key={i} className="review__highlight">
                          {seg.text}
                        </mark>
                      ) : (
                        <span key={i}>{seg.text}</span>
                      ),
                    )}
                  </p>
                  <PlayButton
                    text={view.example}
                    learnLang={learnLang}
                    kind="example"
                    appearance="ember"
                  />
                </div>
                {/* Прямо под примером — подписи не нужно, пара очевидна. */}
                {view.exampleTranslation && (
                  <p className="review__sentence-translation" lang={nativeLang}>
                    {view.exampleTranslation}
                  </p>
                )}
              </div>
            ) : (
              // Нет сохранённого примера (редкий случай для старых данных) —
              // показываем хотя бы само слово, чтобы экран оставался рабочим.
              <p className="review__sentence" lang={learnLang}>
                {view.word}
              </p>
            )}

            <div className="review__divider" />
            <div className="review__answer">
              <div className="review__word-row">
                <h1 id="review-word" className="review__word" lang={learnLang}>
                  {view.word}
                </h1>
                <PlayButton
                  text={view.word}
                  learnLang={learnLang}
                  kind="word"
                  appearance="ember"
                />
              </div>
              {view.register && (
                <span className="review__register">{view.register}</span>
              )}
              {view.translit && (
                <p className="review__translit">{view.translit}</p>
              )}
              {view.translation && (
                <p className="review__translation">{view.translation}</p>
              )}
              {view.note && (
                <div className="review__sentence-translation-block">
                  <span className="review__sentence-translation-label">
                    {t("cards.usageNote")}
                  </span>
                  <p className="review__sentence-translation" lang={nativeLang}>
                    {view.note}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </article>

      {revealed && (
        <div className="review__grades">
          {gradesWithInterval.map(({ grade, cls, interval, replay }) => (
            <button
              key={grade}
              type="button"
              className={`review__grade review__grade--${cls}`}
              onClick={() => handleGrade(currentWord, grade)}
            >
              <span className="review__grade-label">{t(`grade.${grade}`)}</span>
              <span className="review__grade-interval">
                {replay
                  ? t("review.replayNow")
                  : formatInterval(t, lang, interval)}
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
