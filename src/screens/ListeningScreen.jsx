import { useState, useEffect, useRef, useMemo } from "react";
import {
  loadSet,
  saveSet,
  requestListeningSet,
  checkAnswer,
  optionMatches,
  PHRASES_PER_SET,
  BLANK,
} from "../lib/listeningClient.js";
import {
  loadDialogue,
  saveDialogue,
  requestDialogueSet,
  recentDialogueTitles,
} from "../lib/comprehensionClient.js";
import { requestGrammar, loadTexts } from "../lib/readingClient.js";
import { apiErrorText } from "../lib/apiClient.js";
import { stopCurrentAudio, prewarmPhrases } from "../lib/ttsClient.js";
import AudioPlayer from "../components/AudioPlayer.jsx";
import ComprehensionQuestions from "../components/ComprehensionQuestions.jsx";
import Icon from "../components/icons/Icon.jsx";
import Flag from "../components/icons/Flag.jsx";
import {
  LISTENING_LEVELS,
  getListeningLevel,
  LISTENING_FORMATS,
  LISTENING_MODES,
} from "../lib/listeningLevels.js";
import { ENOUGH_WORDS_FOR_READING } from "../hooks/useWordLists.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./ListeningScreen.css";

// Единственное поведение генерации (выбор источника слов убран): «смешанно» —
// вокруг уже изучаемых слов + немного нового под тему и уровень. Служит и ключом
// кэша: старые записи «mine»/«new» просто не читаются (не ломают выдачу).
const WORD_SOURCE = "mixed";

/**
 * Аудирование (фаза 6.2). ОСНОВНОЙ режим — проверка ПОНИМАНИЯ (Hörverstehen):
 * звучит короткий диалог вокруг активных слов пользователя, потом вопросы
 * «верно/неверно» с объяснением ошибки. Это проверяет понимание речи, а не
 * узнавание отдельного слова, за что старый формат и раскритиковали.
 *
 * Второй режим — «слова»: старые форматы «пропущенное слово» / «на слух»
 * оставлены как дополнительный выбор (кому-то заходят).
 *
 * Ничего нового под капотом: диалог и текст даёт генерация 6.1 (вокруг активных
 * слов пары), проигрывание — готовый AudioPlayer (пауза/перемотка/переслушать),
 * вопросы — общий механизм (ComprehensionQuestions), звук — общий TTS-кэш (5.1).
 * Диалог и его вопросы кэшируются вместе — переслушать и перепройти без нового
 * запроса к API. Без сети режим недоступен — карточки и повторение работают.
 */
export default function ListeningScreen({
  pairKey,
  learnLang,
  nativeLang,
  topic,
  level,
  takenWords,
  wordInfo,
  levelId,
  onChangeLevel,
  mode,
  onChangeMode,
  formatId,
  onChangeFormat,
  scheduleActive,
  onBack,
  // Движок заданий (необязательно): объём блока «диалог» — сколько вопросов на
  // понимание. Без него — серверный дефолт.
  plannedQuestions = null,
  // Реальное завершение блока аудирования: прослушал И ответил на вопросы.
  onQuestionsComplete = null,
}) {
  const { t } = useI18n();
  const listeningLevel = getListeningLevel(levelId);

  // ---------- Состояние ----------
  // Понимание: диалог + вопросы (кэшируются вместе по паре).
  const [dialogueSet, setDialogueSet] = useState(() =>
    loadDialogue(pairKey, WORD_SOURCE),
  );
  // Слова: текущий подход старых форматов (по паре).
  const [set, setSet] = useState(() => loadSet(pairKey));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ответ для формата gap: "type" — вписать, "choice" — выбрать.
  const [modeAnswer, setModeAnswer] = useState("type");
  const [typed, setTyped] = useState("");
  const [result, setResult] = useState(null);
  const [grammar, setGrammar] = useState(null);

  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );
  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Уходим с экрана — глушим звук (плеер общий на всё приложение).
  useEffect(() => {
    return () => stopCurrentAudio();
  }, []);

  // Смена активной пары: подхватываем свой диалог и свой подход слов.
  const pairRef = useRef(pairKey);
  useEffect(() => {
    if (pairRef.current === pairKey) return;
    pairRef.current = pairKey;
    stopCurrentAudio();
    setDialogueSet(loadDialogue(pairKey, WORD_SOURCE));
    setSet(loadSet(pairKey));
    setResult(null);
    setGrammar(null);
    setTyped("");
    setError(null);
  }, [pairKey]);

  // Смена режима или формата: глушим звук и чистим временное состояние.
  useEffect(() => {
    stopCurrentAudio();
    setResult(null);
    setGrammar(null);
    setTyped("");
    setError(null);
  }, [mode, formatId]);

  // ---------- Понимание (диалог) ----------
  // Показываем диалог, только если он совпадает с текущим источником: наборы
  // разных источников (мои/смешанно/новые) — разные, кэш их не путает.
  const activeDialogue =
    dialogueSet && dialogueSet.source === WORD_SOURCE ? dialogueSet : null;

  // Реплики диалога → треки плеера. Плеер склеит их в одну шкалу времени и даст
  // паузу/перемотку/переслушать. Скорость (rate) берётся из выбранного уровня.
  const dialogueTracks = useMemo(
    () =>
      activeDialogue
        ? activeDialogue.dialogue.map((line) => ({
            text: line.text,
            learnLang,
            rate: listeningLevel.rate,
          }))
        : [],
    [activeDialogue, learnLang, listeningLevel.rate],
  );

  // Расшифровка диалога — показывается ТОЛЬКО в итоге (после ответов), чтобы её
  // нельзя было прочитать вместо того, чтобы слушать.
  const transcript = activeDialogue ? (
    <div className="listening__transcript">
      <h3 className="listening__transcript-title">{t("listening.transcript")}</h3>
      {activeDialogue.dialogue.map((line, i) => (
        <div className="listening__line" key={i}>
          <p className="listening__line-text" lang={learnLang}>
            <b className="listening__speaker">{line.speaker}:</b> {line.text}
          </p>
          {line.translation && (
            <p className="listening__line-tr" lang={nativeLang}>
              {line.translation}
            </p>
          )}
        </div>
      ))}
    </div>
  ) : null;

  // ---------- Старые форматы (слова) ----------
  const activeSet =
    set && set.format === formatId && set.source === WORD_SOURCE ? set : null;
  const items = activeSet?.items || [];
  const index = activeSet?.index || 0;
  const current = index < items.length ? items[index] : null;
  const finished = Boolean(activeSet && index >= items.length);

  const audioText = current
    ? current.kind === "soundalike"
      ? current.word
      : current.text
    : "";
  const correctText = current
    ? current.kind === "soundalike"
      ? current.word
      : current.answer
    : "";
  const options = current
    ? current.kind === "soundalike"
      ? current.options
      : current.choices || []
    : [];
  const canChoose = options.length > 1;
  const answerMode =
    current?.kind === "soundalike" || current?.choiceOnly
      ? "choice"
      : canChoose
        ? modeAnswer
        : "type";

  const takenCount = (takenWords || []).length;
  const noWords = takenCount === 0;
  const fewWords = takenCount > 0 && takenCount < ENOUGH_WORDS_FOR_READING;

  function updateSet(next) {
    setSet(next);
    saveSet(pairKey, next);
  }

  // Трек текущего задания старых форматов (autoPlay при смене задания/скорости).
  const audioTracks = useMemo(
    () =>
      current && audioText
        ? [{ text: audioText, learnLang, rate: listeningLevel.rate }]
        : [],
    [current, audioText, learnLang, listeningLevel.rate],
  );

  function handleLevel(id) {
    onChangeLevel(id);
  }

  // ---------- Подход: понимание (диалог) ----------
  async function handleGenerateDialogue() {
    if (loading || offline) return;
    // Диалог строится вокруг активных слов пользователя.
    if (noWords) {
      setError(t("listening.needWords"));
      return;
    }
    setLoading(true);
    setError(null);
    stopCurrentAudio();
    try {
      // Заголовки недавних диалогов ЭТОЙ темы — чтобы модель дала другой сюжет.
      const recentTitles = recentDialogueTitles(pairKey, WORD_SOURCE, topic);
      // …и недавних текстов чтения этой темы — чтобы диалог не совпал с текстом
      // (механизм генерации общий, но результаты должны расходиться).
      const otherTitles = loadTexts(pairKey, WORD_SOURCE)
        .filter((tx) => tx && tx.title && tx.topic === topic)
        .map((tx) => tx.title);
      const next = await requestDialogueSet({
        learnLang,
        nativeLang,
        topic,
        level,
        takenWords: takenWords || [],
        recentTitles,
        otherTitles,
        // Объём блока диалога из движка заданий (сервер зажимает число вопросов).
        questionCount: plannedQuestions || undefined,
      });
      // Новый диалог становится текущим (заменяет прежний на экране); прежние
      // остаются в кэше только для разнообразия и показа последнего при перезаходе.
      saveDialogue(pairKey, WORD_SOURCE, next);
      setDialogueSet(next);
      // Заранее греем озвучку реплик в общем кэше — переслушивание мгновенное.
      prewarmPhrases(
        next.dialogue.map((l) => l.text),
        learnLang,
        listeningLevel.rate,
      );
    } catch (err) {
      setError(apiErrorText(err, t, "listening.dialogueFailed"));
    } finally {
      setLoading(false);
    }
  }

  // ---------- Подход: старые форматы (слова) ----------
  async function handleGenerate() {
    if (loading || offline) return;
    if (noWords) {
      setError(t("listening.needWords"));
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setGrammar(null);
    setTyped("");
    stopCurrentAudio();
    try {
      const next = await requestListeningSet({
        format: formatId,
        learnLang,
        nativeLang,
        topic,
        level,
        takenWords: takenWords || [],
        wordInfo: wordInfo || {},
        sentenceLength: listeningLevel.length,
        source: WORD_SOURCE,
      });
      if (!next.items.length) {
        setError(
          formatId === "soundalike"
            ? t("listening.soundalikeEmpty")
            : t("listening.gapEmpty"),
        );
        return;
      }
      updateSet(next);
      prewarmPhrases(
        next.items.map((it) => (it.kind === "soundalike" ? it.word : it.text)),
        learnLang,
        listeningLevel.rate,
      );
    } catch (err) {
      setError(apiErrorText(err, t, "listening.failed"));
    } finally {
      setLoading(false);
    }
  }

  function submitAnswer(answer, viaType) {
    if (!current || result) return;
    const checked = viaType
      ? checkAnswer(answer, correctText)
      : { correct: optionMatches(answer, correctText), ops: null };
    setResult({ ...checked, chosen: answer, viaType });
    if (checked.correct) {
      updateSet({ ...activeSet, correctCount: (activeSet.correctCount || 0) + 1 });
    }
  }

  function handleNext() {
    if (!activeSet) return;
    const nextIndex = index + 1;
    setResult(null);
    setGrammar(null);
    setTyped("");
    updateSet({ ...activeSet, index: nextIndex });
  }

  async function handleGrammar() {
    if (!current || current.kind !== "gap") return;
    if (grammar) {
      setGrammar(null);
      return;
    }
    setGrammar({ status: "loading" });
    try {
      const res = await requestGrammar({
        sentence: current.text,
        learnLang,
        nativeLang,
        level,
      });
      setGrammar({ status: "ready", points: res.points });
    } catch (err) {
      setGrammar({
        status: "error",
        errorText: apiErrorText(err, t, "reading.grammarFailed"),
      });
    }
  }

  function renderFilled(display, answer) {
    const parts = display.split(BLANK);
    return (
      <>
        {parts[0]}
        <b className="listening__answer">{answer}</b>
        {parts.slice(1).join(BLANK)}
      </>
    );
  }

  // ---------- Пикеры ----------
  const loadingText =
    mode === "comprehension"
      ? t("listening.generatingDialogue")
      : t("listening.generating");

  const modeTabs = (
    <div className="listening__mode">
      <span className="listening__level-label">{t("listening.modeLabel")}</span>
      <div className="listening__mode-tabs" role="group">
        {LISTENING_MODES.map((m) => (
          <button
            key={m}
            type="button"
            className={"listening__mode-tab" + (mode === m ? " is-active" : "")}
            aria-pressed={mode === m}
            onClick={() => onChangeMode(m)}
          >
            {t(`listening.mode.${m}`)}
          </button>
        ))}
      </div>
      <p className="listening__level-hint">
        {mode === "comprehension"
          ? t("listening.modeHintComprehension")
          : t("listening.modeHintWords")}
      </p>
    </div>
  );

  const formatPicker = (
    <div className="listening__format">
      <span className="listening__level-label">{t("listening.formatLabel")}</span>
      <div className="listening__format-chips" role="group">
        {LISTENING_FORMATS.map((f) => (
          <button
            key={f}
            type="button"
            className={
              "listening__format-chip" + (formatId === f ? " is-active" : "")
            }
            aria-pressed={formatId === f}
            onClick={() => onChangeFormat(f)}
          >
            {t(`listening.format.${f}`)}
          </button>
        ))}
      </div>
      <p className="listening__level-hint">
        {formatId === "soundalike"
          ? t("listening.formatHintSoundalike")
          : t("listening.formatHintGap")}
      </p>
    </div>
  );

  const levelPicker = (
    <div className="listening__level">
      <span className="listening__level-label">{t("listening.levelLabel")}</span>
      <div className="listening__level-chips" role="group">
        {LISTENING_LEVELS.map((l) => (
          <button
            key={l.id}
            type="button"
            className={
              "listening__level-chip" + (levelId === l.id ? " is-active" : "")
            }
            aria-pressed={levelId === l.id}
            onClick={() => handleLevel(l.id)}
          >
            {t(`listening.level.${l.id}`)}
          </button>
        ))}
      </div>
      <p className="listening__level-hint">
        {mode === "comprehension"
          ? t("listening.levelHintSpeed")
          : t("listening.levelHint")}
      </p>
    </div>
  );

  return (
    <section className="listening">
      <header className="listening__header">
        <button
          type="button"
          className="listening__back"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <h1 className="listening__title">{t("listening.title")}</h1>
        {mode === "words" && current && (
          <span className="listening__progress">
            {t("listening.progress", { n: index + 1, total: items.length })}
          </span>
        )}
      </header>

      {/* Основной выбор: понимание (диалог) / слова (старые форматы). */}
      {modeTabs}

      {scheduleActive && (
        <p className="listening__schedule">
          <Flag lang={learnLang} size={22} />
          {t("schedule.today", { lang: t(`lang.${learnLang}`) })}
        </p>
      )}

      {offline && <p className="listening__notice">{t("listening.offline")}</p>}

      {error && <p className="listening__error">{error}</p>}

      {loading && (
        <div className="listening__center">
          <span className="listening__spinner" aria-hidden="true" />
          <p className="listening__notice">{loadingText}</p>
        </div>
      )}

      {/* ============ Режим ПОНИМАНИЯ: диалог + вопросы ============ */}
      {mode === "comprehension" && !offline && !loading && (
        <>
          {!activeDialogue && (
            <div className="listening__center">
              <div className="listening__emoji" aria-hidden="true">
                🎧
              </div>
              <p className="listening__notice">
                {t("listening.emptyHintDialogue")}
              </p>
              {noWords && (
                <p className="listening__tip">
                  <Icon name="bulb" size={18} className="listening__tip-icon" />
                  <span>{t("listening.tipNoWords")}</span>
                </p>
              )}
            </div>
          )}

          {activeDialogue && (
            <div className="listening__practice">
              {fewWords && (
                <p className="listening__tip">
                  <Icon name="bulb" size={18} className="listening__tip-icon" />
                  <span>{t("listening.tipFewWords")}</span>
                </p>
              )}

              {activeDialogue.title && (
                <header className="listening__dialogue-head">
                  <h2 className="listening__dialogue-title" lang={learnLang}>
                    {activeDialogue.title}
                  </h2>
                  {activeDialogue.titleTranslation && (
                    <p
                      className="listening__dialogue-subtitle"
                      lang={nativeLang}
                    >
                      {activeDialogue.titleTranslation}
                    </p>
                  )}
                </header>
              )}

              {/* Диалог играется через готовый плеер: пауза/перемотка/переслушать
                  фрагмент — можно слушать сколько угодно раз. */}
              <div className="listening__player">
                <AudioPlayer
                  tracks={dialogueTracks}
                  appearance="ember"
                  ariaLabel={t("listening.listen")}
                />
              </div>

              <p className="listening__prompt">{t("listening.listenPrompt")}</p>

              {/* Общий механизм вопросов: те же «верно/неверно» + объяснение
                  ошибки, что и в чтении. Расшифровку показываем лишь в итоге. */}
              <ComprehensionQuestions
                questions={activeDialogue.questions}
                learnLang={learnLang}
                nativeLang={nativeLang}
                footer={transcript}
                onFinished={onQuestionsComplete}
                appearance="ember"
              />
            </div>
          )}
        </>
      )}

      {/* ============ Режим СЛОВ: старые форматы ============ */}
      {mode === "words" && !offline && !loading && (
        <>
          {!activeSet && !finished && (
            <div className="listening__center">
              <div className="listening__emoji" aria-hidden="true">
                🎧
              </div>
              <p className="listening__notice">
                {formatId === "soundalike"
                  ? t("listening.emptyHintSoundalike")
                  : t("listening.emptyHintGap")}
              </p>
              {noWords && (
                <p className="listening__tip">
                  <Icon name="bulb" size={18} className="listening__tip-icon" />
                  <span>{t("listening.tipNoWords")}</span>
                </p>
              )}
            </div>
          )}

          {finished && (
            <div className="listening__center">
              <div className="listening__emoji" aria-hidden="true">
                🎉
              </div>
              <h2 className="listening__done-title">
                {t("listening.doneTitle")}
              </h2>
              <p className="listening__notice">
                {t("listening.doneHint", {
                  n: activeSet.correctCount || 0,
                  total: items.length,
                })}
              </p>
            </div>
          )}

          {current && (
            <div className="listening__practice">
              {fewWords && !result && (
                <p className="listening__tip">
                  <Icon name="bulb" size={18} className="listening__tip-icon" />
                  <span>{t("listening.tipFewWords")}</span>
                </p>
              )}

              <div className="listening__player">
                <AudioPlayer
                  tracks={audioTracks}
                  autoPlay
                  appearance="ember"
                  ariaLabel={t("listening.listen")}
                />
              </div>

              <p className="listening__prompt">
                {current.kind === "soundalike"
                  ? t("listening.soundalikePrompt")
                  : t("listening.gapPrompt")}
              </p>
              {current.kind === "gap" && (
                <p className="listening__sentence" lang={learnLang}>
                  {result
                    ? renderFilled(current.display, current.answer)
                    : current.display.split(BLANK).map((part, i, arr) => (
                        <span key={i}>
                          {part}
                          {i < arr.length - 1 && (
                            <span
                              className="listening__blank"
                              aria-hidden="true"
                            >
                              ▁▁▁
                            </span>
                          )}
                        </span>
                      ))}
                </p>
              )}

              {current.kind === "gap" &&
                !current.choiceOnly &&
                canChoose &&
                !result && (
                  <div className="listening__modes" role="group">
                    <button
                      type="button"
                      className={
                        "listening__mode-chip" +
                        (modeAnswer === "type" ? " is-active" : "")
                      }
                      aria-pressed={modeAnswer === "type"}
                      onClick={() => setModeAnswer("type")}
                    >
                      {t("listening.modeType")}
                    </button>
                    <button
                      type="button"
                      className={
                        "listening__mode-chip" +
                        (modeAnswer === "choice" ? " is-active" : "")
                      }
                      aria-pressed={modeAnswer === "choice"}
                      onClick={() => setModeAnswer("choice")}
                    >
                      {t("listening.modeChoice")}
                    </button>
                  </div>
                )}

              {answerMode === "choice" && (
                <div className="listening__options">
                  {options.map((option, i) => {
                    let mark = "";
                    if (result) {
                      if (optionMatches(option, correctText)) mark = " is-correct";
                      else if (option === result.chosen) mark = " is-wrong";
                    }
                    return (
                      <button
                        key={i}
                        type="button"
                        className={"listening__option" + mark}
                        lang={learnLang}
                        disabled={Boolean(result)}
                        onClick={() => submitAnswer(option, false)}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
              )}

              {answerMode === "type" && (
                <div className="listening__input-block">
                  <input
                    type="text"
                    className="listening__input"
                    lang={learnLang}
                    value={typed}
                    readOnly={Boolean(result)}
                    placeholder={t("listening.inputPlaceholder")}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && typed.trim() && !result) {
                        e.preventDefault();
                        submitAnswer(typed, true);
                      }
                    }}
                  />
                  {!result && (
                    <button
                      type="button"
                      className="listening__check"
                      disabled={!typed.trim()}
                      onClick={() => submitAnswer(typed, true)}
                    >
                      {t("listening.check")}
                    </button>
                  )}
                </div>
              )}

              {result && (
                <div
                  className={
                    "listening__result" +
                    (result.correct ? " is-correct" : " is-wrong")
                  }
                  role="status"
                >
                  <p className="listening__verdict">
                    {result.correct
                      ? `✅ ${t("listening.right")}`
                      : `❌ ${t("listening.wrong")}`}
                  </p>

                  {current.kind === "gap" ? (
                    <p className="listening__phrase" lang={learnLang}>
                      {renderFilled(current.display, current.answer)}
                    </p>
                  ) : (
                    <p className="listening__phrase" lang={learnLang}>
                      <b className="listening__answer">{current.word}</b>
                    </p>
                  )}
                  {current.translation && (
                    <p className="listening__translation" lang={nativeLang}>
                      {current.translation}
                    </p>
                  )}

                  {result.viaType && !result.correct && (
                    <p className="listening__youwrote">
                      {t("listening.youWrote", {
                        word: result.chosen.trim() || "—",
                      })}
                    </p>
                  )}

                  <div className="listening__result-actions">
                    {current.kind === "gap" && (
                      <button
                        type="button"
                        className={
                          "listening__grammar-btn" + (grammar ? " is-open" : "")
                        }
                        onClick={handleGrammar}
                        disabled={offline}
                      >
                        ¶ {t("listening.explain")}
                      </button>
                    )}
                    <button
                      type="button"
                      className="listening__next"
                      onClick={handleNext}
                    >
                      {index + 1 < items.length
                        ? t("listening.next")
                        : t("listening.finish")}
                    </button>
                  </div>

                  {grammar && (
                    <div className="listening__grammar">
                      {grammar.status === "loading" && (
                        <p className="listening__notice">
                          {t("reading.grammarLoading")}
                        </p>
                      )}
                      {grammar.status === "error" && (
                        <p className="listening__error">{grammar.errorText}</p>
                      )}
                      {grammar.status === "ready" && (
                        <ul
                          className="listening__grammar-list"
                          lang={nativeLang}
                        >
                          {grammar.points.map((p, pi) => (
                            <li key={pi}>{p}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ---------- Управление ---------- */}
      {!offline && (
        <div className="listening__controls">
          {/* Формат «слов» — только в режиме слов. */}
          {mode === "words" && formatPicker}

          {levelPicker}

          {mode === "comprehension" ? (
            <button
              type="button"
              className="listening__generate"
              onClick={handleGenerateDialogue}
              disabled={loading}
            >
              <Icon name="review" size={18} className="listening__generate-icon" />
              {activeDialogue
                ? t("listening.newDialogue")
                : t("listening.startDialogue")}
            </button>
          ) : (
            <button
              type="button"
              className="listening__generate"
              onClick={handleGenerate}
              disabled={loading}
            >
              <Icon name="review" size={18} className="listening__generate-icon" />
              {activeSet && !finished
                ? t("listening.restart", { n: PHRASES_PER_SET })
                : t("listening.start", { n: PHRASES_PER_SET })}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
