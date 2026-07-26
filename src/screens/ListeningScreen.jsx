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
import { requestGrammar } from "../lib/readingClient.js";
import { apiErrorText } from "../lib/apiClient.js";
import { stopCurrentAudio, prewarmPhrases } from "../lib/ttsClient.js";
import AudioPlayer from "../components/AudioPlayer.jsx";
import {
  LISTENING_LEVELS,
  getListeningLevel,
  LISTENING_FORMATS,
} from "../lib/listeningLevels.js";
import { ENOUGH_WORDS_FOR_READING } from "../hooks/useWordLists.js";
import WordSourcePicker from "../components/WordSourcePicker.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./ListeningScreen.css";

/**
 * Аудирование (фаза 6.2) — два честных формата:
 *   gap        — звучит всё предложение, одно слово скрыто (___); пользователь
 *                вписывает или выбирает пропущенное слово;
 *   soundalike — звучит слово, варианты похожи по звучанию (нельзя угадать по
 *                первому звуку); формат для продвинутых.
 * Старый формат «выбери услышанную фразу целиком» убран: он проверял чтение.
 *
 * Ничего нового под капотом: предложения даёт генерация 6.1 вокруг активных
 * слов пары, похожие по звучанию подбирает модель (/api/listening), звук — общий
 * TTS-кэш (5.1), разбор грамматики — то же кэшированное объяснение, что в чтении.
 * Без сети формат недоступен (слушать нечего) — карточки и повторение работают.
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
  formatId,
  onChangeFormat,
  wordSource,
  onChangeWordSource,
  scheduleActive,
  onBack,
}) {
  const { t } = useI18n();
  const listeningLevel = getListeningLevel(levelId);

  // Источник слов работает в ОБОИХ форматах (mine/mixed/new) — см. requestGapSet
  // и requestSoundAlikeSet. Экран лишь передаёт выбор и хранит его в штампе
  // набора, чтобы кэш не подменял источники между собой.

  // Текущий подход пары: переживает уход с экрана и перезагрузку.
  const [set, setSet] = useState(() => loadSet(pairKey));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ответ для формата gap: "type" — вписать, "choice" — выбрать. По умолчанию
  // вписывать (основной способ). Формат soundalike — всегда выбор.
  const [mode, setMode] = useState("type");
  const [typed, setTyped] = useState("");
  // Результат проверки: { correct, ops?, chosen, viaType }
  const [result, setResult] = useState(null);
  // Разбор грамматики предложения (только для gap) — как в режиме чтения.
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

  // Набор хранится по паре: смена активного языка подхватывает свой подход.
  const pairRef = useRef(pairKey);
  useEffect(() => {
    if (pairRef.current === pairKey) return;
    pairRef.current = pairKey;
    stopCurrentAudio();
    setSet(loadSet(pairKey));
    setResult(null);
    setGrammar(null);
    setTyped("");
    setError(null);
  }, [pairKey]);

  // Смена формата или источника: старый набор не подходит (нужен новый),
  // сбрасываем ввод и глушим звук.
  useEffect(() => {
    stopCurrentAudio();
    setResult(null);
    setGrammar(null);
    setTyped("");
    setError(null);
  }, [formatId, wordSource]);

  // Набор показываем, только если совпадают И формат, И источник: наборы разных
  // источников (мои/смешанно/новые) — разные, кэш не должен подсунуть один
  // вместо другого. Это касается обоих форматов.
  const activeSet =
    set && set.format === formatId && set.source === wordSource ? set : null;
  const items = activeSet?.items || [];
  const index = activeSet?.index || 0;
  const current = index < items.length ? items[index] : null;
  const finished = Boolean(activeSet && index >= items.length);

  // Что звучит и что является правильным ответом — зависит от формата.
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
  // soundalike — всегда выбор; gap с источником «Новые» (choiceOnly) — тоже
  // только выбор (незнакомое слово не впишешь); прочий gap — ввод или выбор.
  const answerMode =
    current?.kind === "soundalike" || current?.choiceOnly
      ? "choice"
      : canChoose
        ? mode
        : "type";

  const takenCount = (takenWords || []).length;
  const noWords = takenCount === 0;
  const fewWords = takenCount > 0 && takenCount < ENOUGH_WORDS_FOR_READING;

  function updateSet(next) {
    setSet(next);
    saveSet(pairKey, next);
  }

  // ---------- Звук ----------
  // Трек текущего задания для плеера. autoPlay включён, поэтому смена задания
  // (handleNext/handleGenerate) и скорости (handleLevel меняет rate) озвучиваются
  // сразу — как раньше, но теперь с паузой/перемоткой/повтором. Источник прежний.
  const audioTracks = useMemo(
    () =>
      current && audioText
        ? [{ text: audioText, learnLang, rate: listeningLevel.rate }]
        : [],
    [current, audioText, learnLang, listeningLevel.rate],
  );

  // Смена скорости слышна сразу: rate трека меняется → плеер переиграет на новой
  // скорости (autoPlay). Длина фразы уровня применится к следующему подходу.
  function handleLevel(id) {
    onChangeLevel(id);
  }

  // ---------- Подход ----------
  async function handleGenerate() {
    if (loading || offline) return;
    // Оба формата строятся вокруг активных слов пользователя.
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
        // Источник работает в обоих форматах; стамп source на наборе — для
        // сверки с кэшем, чтобы наборы разных источников не путались.
        source: wordSource,
      });
      if (!next.items.length) {
        // Нечего показать: для gap не нашли активных слов в предложениях, для
        // soundalike не нашлось похоже звучащих пар — подсказываем, что делать.
        setError(
          formatId === "soundalike"
            ? t("listening.soundalikeEmpty")
            : t("listening.gapEmpty"),
        );
        return;
      }
      updateSet(next);
      // Первое задание озвучит плеер сам (autoPlay). Остальные заранее греем в
      // общем кэше, чтобы переход к ним был мгновенным.
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
    // Следующее задание озвучит плеер сам (autoPlay при смене трека). Если
    // заданий больше нет, практика скрывается и плеер размонтируется — звук стоп.
  }

  // Разбор грамматики предложения (только gap) — тот же кэшированный запрос, что
  // в чтении (6.1): повторный разбор той же фразы по API уже не бьёт.
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

  // Раскрытие предложения gap: подставляем ответ на место ___ и выделяем его.
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

  // ---------- Пикеры сложности и формата ----------
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
      <p className="listening__level-hint">{t("listening.levelHint")}</p>
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
        {current && (
          <span className="listening__progress">
            {t("listening.progress", { n: index + 1, total: items.length })}
          </span>
        )}
      </header>

      {/* Недельное расписание (фаза 4.5): задания строятся вокруг слов языка,
          который расписание назначило на сегодня, — говорим об этом прямо. */}
      {scheduleActive && (
        <p className="listening__schedule">
          {t("schedule.today", { lang: t(`lang.${learnLang}`) })}
        </p>
      )}

      {/* Без сети слушать нечего — формат недоступен целиком. Остальное
          приложение (карточки, повторение) работает как обычно. */}
      {offline && <p className="listening__notice">{t("listening.offline")}</p>}

      {error && <p className="listening__error">{error}</p>}

      {loading && (
        <div className="listening__center">
          <span className="listening__spinner" aria-hidden="true" />
          <p className="listening__notice">{t("listening.generating")}</p>
        </div>
      )}

      {/* Первый заход: объясняем формат, ничего не требуем. */}
      {!loading && !activeSet && !finished && !offline && (
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
            <p className="listening__tip">💡 {t("listening.tipNoWords")}</p>
          )}
        </div>
      )}

      {/* Подход пройден: сколько узнал и что дальше. */}
      {!loading && finished && !offline && (
        <div className="listening__center">
          <div className="listening__emoji" aria-hidden="true">
            🎉
          </div>
          <h2 className="listening__done-title">{t("listening.doneTitle")}</h2>
          <p className="listening__notice">
            {t("listening.doneHint", {
              n: activeSet.correctCount || 0,
              total: items.length,
            })}
          </p>
        </div>
      )}

      {!loading && current && !offline && (
        <div className="listening__practice">
          {fewWords && !result && (
            <p className="listening__tip">💡 {t("listening.tipFewWords")}</p>
          )}

          {/* Запись переслушивается сколько угодно — до ответа и после: плеер с
              паузой/перемоткой/повтором. Автостарт при новом задании и смене
              скорости. */}
          <div className="listening__player">
            <AudioPlayer
              tracks={audioTracks}
              autoPlay
              ariaLabel={t("listening.listen")}
            />
          </div>

          {/* Вопрос формата + для gap — предложение с пропуском */}
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
                        <span className="listening__blank" aria-hidden="true">
                          ▁▁▁
                        </span>
                      )}
                    </span>
                  ))}
            </p>
          )}

          {/* gap: переключатель «выбрать / вписать». Нет при choiceOnly
              (источник «Новые» — незнакомое слово только выбором) и в soundalike. */}
          {current.kind === "gap" && !current.choiceOnly && canChoose && !result && (
            <div className="listening__modes" role="group">
              <button
                type="button"
                className={
                  "listening__mode-chip" + (mode === "type" ? " is-active" : "")
                }
                aria-pressed={mode === "type"}
                onClick={() => setMode("type")}
              >
                {t("listening.modeType")}
              </button>
              <button
                type="button"
                className={
                  "listening__mode-chip" + (mode === "choice" ? " is-active" : "")
                }
                aria-pressed={mode === "choice"}
                onClick={() => setMode("choice")}
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

          {/* ---------- Проверка и разбор ---------- */}
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

              {/* Раскрытие: gap — предложение с подставленным словом + перевод;
                  soundalike — само слово и его перевод. */}
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

              {/* Что именно вписал пользователь, если ошибся (только ввод). */}
              {result.viaType && !result.correct && (
                <p className="listening__youwrote">
                  {t("listening.youWrote", { word: result.chosen.trim() || "—" })}
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
                    <ul className="listening__grammar-list" lang={nativeLang}>
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

      {/* ---------- Управление ---------- */}
      {!offline && (
        <div className="listening__controls">
          {formatPicker}
          {/* Источник слов — в ОБОИХ форматах (mine/mixed/new работают везде). */}
          <WordSourcePicker
            value={wordSource}
            onChange={onChangeWordSource}
            takenCount={takenCount}
          />
          {levelPicker}
          <button
            type="button"
            className="listening__generate"
            onClick={handleGenerate}
            disabled={loading}
          >
            {activeSet && !finished
              ? t("listening.restart", { n: PHRASES_PER_SET })
              : t("listening.start", { n: PHRASES_PER_SET })}
          </button>
        </div>
      )}
    </section>
  );
}
