import { useState, useEffect, useRef } from "react";
import {
  loadSet,
  saveSet,
  requestListeningSet,
  checkAnswer,
  PHRASES_PER_SET,
} from "../lib/listeningClient.js";
import { requestGrammar } from "../lib/readingClient.js";
import {
  fetchTtsUrl,
  playUrl,
  stopCurrentAudio,
  prewarmPhrases,
} from "../lib/ttsClient.js";
import {
  LISTENING_LEVELS,
  getListeningLevel,
} from "../lib/listeningLevels.js";
import { ENOUGH_WORDS_FOR_READING } from "../hooks/useWordLists.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./ListeningScreen.css";

/**
 * Аудирование (фаза 6.2): фраза звучит, пользователь выбирает услышанное из
 * вариантов или вписывает его, дальше — проверка, разбор ошибки и повтор
 * записи столько раз, сколько нужно.
 *
 * Ничего нового под капотом: фразы даёт генерация режима чтения (6.1) вокруг
 * активных слов пары, звук — общий TTS-кэш (5.1) со скоростью выбранного
 * уровня, разбор грамматики — то же кэшированное объяснение, что и в чтении.
 * Без сети формат недоступен (слушать нечего) — карточки и повторение работают.
 */
export default function ListeningScreen({
  pairKey,
  learnLang,
  nativeLang,
  topic,
  level,
  takenWords,
  levelId,
  onChangeLevel,
  scheduleActive,
  onBack,
}) {
  const { t } = useI18n();
  const listeningLevel = getListeningLevel(levelId);

  // Текущий подход пары: переживает уход с экрана и перезагрузку, чтобы
  // возврат не стоил ещё одного запроса к ИИ.
  const [set, setSet] = useState(() => loadSet(pairKey));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Ответ: "choice" — выбрать из вариантов, "type" — вписать услышанное.
  const [mode, setMode] = useState("choice");
  const [typed, setTyped] = useState("");
  // Результат проверки текущей фразы: { correct, ops, chosen? }
  const [result, setResult] = useState(null);
  // Разбор грамматики фразы (по кнопке) — та же логика, что в режиме чтения.
  const [grammar, setGrammar] = useState(null);
  const [audioState, setAudioState] = useState("idle"); // idle|loading|playing|error

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
  }, [pairKey]);

  const items = set?.items || [];
  const index = set?.index || 0;
  const current = index < items.length ? items[index] : null;
  const finished = Boolean(set && index >= items.length);
  // Вариантов может не хватить (короткий набор) — тогда остаётся только ввод.
  const canChoose = Boolean(current && current.options?.length > 1);
  const answerMode = canChoose ? mode : "type";

  const takenCount = (takenWords || []).length;
  const noWords = takenCount === 0;
  const fewWords = takenCount > 0 && takenCount < ENOUGH_WORDS_FOR_READING;

  function updateSet(next) {
    setSet(next);
    saveSet(pairKey, next);
  }

  // ---------- Звук ----------
  async function playPhrase(text, rate = listeningLevel.rate) {
    if (!text || offline) return;
    setAudioState("loading");
    const url = await fetchTtsUrl({ text, learnLang, rate });
    if (!url) {
      // Не получилось — побудем неактивной кнопкой и вернёмся: можно повторить.
      setAudioState("error");
      setTimeout(() => setAudioState("idle"), 2500);
      return;
    }
    try {
      const audio = playUrl(url);
      audio.onended = () => setAudioState("idle");
      audio.onerror = () => setAudioState("idle");
      await audio.play();
      setAudioState("playing");
    } catch {
      setAudioState("idle");
    }
  }

  // Смена скорости — сразу слышна: переигрываем текущую фразу на новой
  // скорости (клик по чипу и есть жест пользователя, автоплей разрешён).
  // Длина фразы уровня применится к следующему подходу — фразы уже написаны.
  function handleLevel(id) {
    onChangeLevel(id);
    if (current) playPhrase(current.text, getListeningLevel(id).rate);
  }

  // ---------- Подход ----------
  async function handleGenerate() {
    if (loading || offline) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setGrammar(null);
    setTyped("");
    stopCurrentAudio();
    try {
      const next = await requestListeningSet({
        learnLang,
        nativeLang,
        topic,
        level,
        takenWords: takenWords || [],
        sentenceLength: listeningLevel.length,
      });
      updateSet({ ...next, correctCount: 0 });
      // Пока слушается первая фраза, остальные уже готовятся в общем кэше.
      prewarmPhrases(
        next.items.map((it) => it.text),
        learnLang,
        listeningLevel.rate,
      );
      playPhrase(next.items[0].text);
    } catch (err) {
      setError(
        err.code === "offline"
          ? t("errors.offline")
          : err.raw || t("listening.failed"),
      );
    } finally {
      setLoading(false);
    }
  }

  function handleAnswer(answer) {
    if (!current || result) return;
    const checked = checkAnswer(answer, current.text);
    setResult({ ...checked, chosen: answer });
    if (checked.correct) {
      updateSet({ ...set, correctCount: (set.correctCount || 0) + 1 });
    }
  }

  function handleNext() {
    if (!set) return;
    const nextIndex = index + 1;
    setResult(null);
    setGrammar(null);
    setTyped("");
    updateSet({ ...set, index: nextIndex });
    const nextItem = items[nextIndex];
    if (nextItem) playPhrase(nextItem.text);
    else stopCurrentAudio();
  }

  // Разбор грамматики фразы — тот же кэшированный запрос, что в чтении (6.1):
  // повторный разбор той же фразы по API уже не бьёт.
  async function handleGrammar() {
    if (!current) return;
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
        errorText:
          err.code === "offline"
            ? t("errors.offline")
            : err.raw || t("reading.grammarFailed"),
      });
    }
  }

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
            {t("listening.progress", {
              n: index + 1,
              total: items.length,
            })}
          </span>
        )}
      </header>

      {/* Недельное расписание (фаза 4.5): фразы строятся вокруг слов языка,
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
      {!loading && !set && !offline && (
        <div className="listening__center">
          <div className="listening__emoji" aria-hidden="true">
            🎧
          </div>
          <p className="listening__notice">{t("listening.emptyHint")}</p>
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
              n: set.correctCount || 0,
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

          {/* Запись можно переслушивать сколько угодно — и до ответа, и после */}
          <button
            type="button"
            className={`listening__play is-${audioState}`}
            onClick={() => playPhrase(current.text)}
            disabled={audioState === "loading"}
            aria-label={t("listening.replay")}
          >
            <span className="listening__play-glyph" aria-hidden="true">
              {audioState === "loading" ? "…" : "🔊"}
            </span>
            <span className="listening__play-text">
              {result ? t("listening.replay") : t("listening.listen")}
            </span>
          </button>

          {audioState === "error" && (
            <p className="listening__notice">{t("listening.audioFailed")}</p>
          )}

          {/* Как отвечать — выбор пользователя, переключается в любой момент */}
          {canChoose && !result && (
            <div className="listening__modes" role="group">
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
            </div>
          )}

          {answerMode === "choice" && (
            <div className="listening__options">
              {current.options.map((option, i) => {
                // После ответа: правильный вариант подсвечен всегда, выбранный
                // неверный — отдельно, чтобы было видно, что именно послышалось.
                let mark = "";
                if (result) {
                  if (option === current.text) mark = " is-correct";
                  else if (option === result.chosen) mark = " is-wrong";
                }
                return (
                  <button
                    key={i}
                    type="button"
                    className={"listening__option" + mark}
                    lang={learnLang}
                    disabled={Boolean(result)}
                    onClick={() => handleAnswer(option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {answerMode === "type" && (
            <div className="listening__input-block">
              <textarea
                className="listening__input"
                lang={learnLang}
                rows={2}
                value={typed}
                readOnly={Boolean(result)}
                placeholder={t("listening.inputPlaceholder")}
                onChange={(e) => setTyped(e.target.value)}
              />
              {!result && (
                <button
                  type="button"
                  className="listening__check"
                  disabled={!typed.trim()}
                  onClick={() => handleAnswer(typed)}
                >
                  {t("listening.check")}
                </button>
              )}
            </div>
          )}

          {/* ---------- Проверка и разбор ошибки ---------- */}
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

              <p className="listening__phrase" lang={learnLang}>
                {current.text}
              </p>
              {current.translation && (
                <p className="listening__translation" lang={nativeLang}>
                  {current.translation}
                </p>
              )}

              {/* Пословный разбор написанного: что услышалось не так и что
                  пропущено. Для выбора из вариантов не нужен — там видно по
                  подсветке самих вариантов. */}
              {answerMode === "type" && !result.correct && (
                <>
                  <p className="listening__diff">
                    {result.ops.map((op, i) => (
                      <span
                        key={i}
                        className={`listening__diff-word is-${op.type}`}
                      >
                        {op.text}
                      </span>
                    ))}
                  </p>
                  <p className="listening__legend">
                    {t("listening.diffLegend")}
                  </p>
                </>
              )}

              <div className="listening__result-actions">
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
          {levelPicker}
          <button
            type="button"
            className="listening__generate"
            onClick={handleGenerate}
            disabled={loading}
          >
            {set && !finished
              ? t("listening.restart", { n: PHRASES_PER_SET })
              : t("listening.start", { n: PHRASES_PER_SET })}
          </button>
        </div>
      )}
    </section>
  );
}
