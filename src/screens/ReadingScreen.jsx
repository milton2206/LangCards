import { useState, useEffect, useMemo } from "react";
import { splitWords, coreWord } from "../lib/highlightWord.js";
import {
  loadTexts,
  saveText,
  requestReadingText,
  requestGrammar,
} from "../lib/readingClient.js";
import {
  requestTextQuestions,
  loadTextQuestions,
  saveTextQuestions,
  questionsKeyFor,
} from "../lib/comprehensionClient.js";
import { stopCurrentAudio } from "../lib/ttsClient.js";
import { apiErrorText } from "../lib/apiClient.js";
import { ENOUGH_WORDS_FOR_READING } from "../hooks/useWordLists.js";
import { useWordLookup } from "../hooks/useWordLookup.js";
import WordLookupSheet from "../components/WordLookupSheet.jsx";
import WordSourcePicker from "../components/WordSourcePicker.jsx";
import AudioPlayer from "../components/AudioPlayer.jsx";
import ComprehensionQuestions from "../components/ComprehensionQuestions.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./ReadingScreen.css";

/**
 * Режим чтения (фаза 6.1): короткий текст под уровень и тему, где каждое слово
 * тапабельно (перевод/озвучка/«Взять»), а каждое предложение можно озвучить и
 * разобрать по грамматике.
 *
 * Ничего параллельного существующему не заводим: слова добавляются в SRS через
 * onAddWord (в App это handleAddManualCard, вместе с лимитом MAX_ACTIVE_WORDS),
 * озвучка идёт через общий TTS-кэш фазы 5.1, тексты и разборы кэшируются в
 * readingClient — перечитать вчерашний текст можно без запроса к API.
 */
export default function ReadingScreen({
  pairKey,
  learnLang,
  nativeLang,
  topic,
  level,
  takenWords,
  knownWords,
  wordSource,
  onChangeWordSource,
  onAddWord,
  onBack,
}) {
  const { t } = useI18n();

  // Недавние тексты пары И источника: [0] — самый свежий, он и на экране (один
  // текст за раз, «Новый текст» его ЗАМЕНЯЕТ). Историю храним не для листалки, а
  // чтобы (1) при перезаходе показать последний без запроса к API и (2) отдать
  // модели заголовки недавних сюжетов — тогда она не повторяет один и тот же
  // сценарий. Ключ кэша включает источник (mine/mixed/new), чтобы тексты разных
  // источников не смешивались.
  const [texts, setTexts] = useState(() => loadTexts(pairKey, wordSource));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Разбор грамматики: { sentence, status, points?, errorText? }
  const [grammar, setGrammar] = useState(null);

  // Вопросы на понимание текста (отзыв Игоря): тот же механизм, что в
  // аудировании, только источник — текст. Кэшируются по хешу текста: перепройти
  // тот же текст можно без запроса к API.
  const [questions, setQuestions] = useState(null); // массив вопросов | null
  const [qLoading, setQLoading] = useState(false);
  const [qError, setQError] = useState(null);

  // Мягкое предложение взять ещё слов (состояние «мало слов») можно закрыть —
  // это предложение, а не условие: закрыли и читаем дальше.
  const [fewHintClosed, setFewHintClosed] = useState(false);

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

  // Смена источника (или пары) — показываем последний текст ИМЕННО этого
  // источника: «только мои» и «только новые» тексты не смешиваются.
  useEffect(() => {
    setTexts(loadTexts(pairKey, wordSource));
    setGrammar(null);
  }, [pairKey, wordSource]);

  // Сменился показанный текст (сгенерировали новый) — прячем вопросы прошлого.
  useEffect(() => {
    setQuestions(null);
    setQError(null);
  }, [texts]);

  const lookup = useWordLookup({ learnLang, nativeLang, onAdd: onAddWord });

  // Уже знакомые слова помечаем неброско. Сопоставляем по нижнему регистру и
  // по ядру без артикля; словоформы (падежи/времена) не ловим — это подсказка
  // прогресса, а не точный разбор.
  const knownSet = useMemo(() => {
    const set = new Set();
    for (const w of [...(takenWords || []), ...(knownWords || [])]) {
      set.add(String(w).toLowerCase());
      set.add(coreWord(w).toLowerCase());
    }
    return set;
  }, [takenWords, knownWords]);

  // На экране всегда самый свежий текст (один за раз).
  const current = texts[0] || null;

  // Три состояния по числу взятых слов пары. Режим доступен ВСЕГДА — при нуле
  // слов текст просто целиком новый (это обычный адаптированный текст под
  // уровень), а подсказки лишь объясняют, как набирать слова.
  const takenCount = (takenWords || []).length;
  const noWords = takenCount === 0;
  const fewWords = takenCount > 0 && takenCount < ENOUGH_WORDS_FOR_READING;

  async function handleGenerate() {
    if (loading || offline) return;
    setLoading(true);
    setError(null);
    setGrammar(null);
    try {
      // Заголовки недавних текстов ЭТОЙ темы — чтобы модель не повторяла сюжет.
      // Фильтруем по теме: тексты хранятся с полем topic (см. ниже), сравниваем
      // с текущей темой; у старых записей topic мог не сохраниться — их пропустим.
      const recentTitles = texts
        .filter((tx) => tx && tx.title && tx.topic === topic)
        .map((tx) => tx.title);

      const text = await requestReadingText({
        learnLang,
        nativeLang,
        topic,
        level,
        // Слова пользователя всегда уходят в промпт; сервер по source решает,
        // вплетать их (mine/mixed) или избегать (new). При нуле слов «Мои» на
        // сервере трактуется как «Смешанно» (уровень-онли).
        knownWords: takenWords || [],
        source: wordSource,
        recentTitles,
      });
      // Помечаем текст темой (для фильтра «недавних сюжетов» выше) и кладём в
      // кэш ЭТОГО источника: новый текст становится текущим (заменяет прежний на
      // экране), прежние остаются в кэше только для разнообразия и перезахода.
      const list = saveText(pairKey, wordSource, { ...text, topic });
      setTexts(list);
    } catch (err) {
      setError(apiErrorText(err, t, "reading.failed"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGrammar(sentence) {
    // Повторный тап по тому же предложению просто закрывает разбор.
    if (grammar && grammar.sentence === sentence.text) {
      setGrammar(null);
      return;
    }
    setGrammar({ sentence: sentence.text, status: "loading" });
    try {
      const res = await requestGrammar({
        sentence: sentence.text,
        learnLang,
        nativeLang,
        level,
      });
      setGrammar({
        sentence: sentence.text,
        status: "ready",
        points: res.points,
      });
    } catch (err) {
      setGrammar({
        sentence: sentence.text,
        status: "error",
        errorText: apiErrorText(err, t, "reading.grammarFailed"),
      });
    }
  }

  // Треки для плеера «весь текст»: предложения по порядку. Весь текст — это
  // несколько mp3 (по предложению), плеер склеивает их в одну шкалу времени и
  // умеет паузу/перемотку. Источник звука прежний (общий TTS-кэш).
  const textTracks = useMemo(
    () =>
      current ? current.sentences.map((s) => ({ text: s.text, learnLang })) : [],
    [current, learnLang],
  );

  // Ключ кэша вопросов текущего текста и то, есть ли уже сохранённые вопросы
  // (тогда «проверить понимание» работает и офлайн, без запроса к API).
  const questionsKey = useMemo(
    () => (current ? questionsKeyFor(learnLang, current.sentences) : null),
    [current, learnLang],
  );
  const cachedQuestions = useMemo(
    () => (questionsKey ? loadTextQuestions(questionsKey) : null),
    [questionsKey],
  );

  async function handleCheckComprehension() {
    if (!current || qLoading) return;
    // Из кэша — без запроса к API (перепройти тот же текст даром).
    if (questionsKey) {
      const cached = loadTextQuestions(questionsKey);
      if (cached) {
        setQuestions(cached);
        return;
      }
    }
    if (offline) return; // без кэша и без сети показать нечего
    setQLoading(true);
    setQError(null);
    try {
      const qs = await requestTextQuestions({
        learnLang,
        nativeLang,
        level,
        sentences: current.sentences,
      });
      if (questionsKey) saveTextQuestions(questionsKey, qs);
      setQuestions(qs);
    } catch (err) {
      setQError(apiErrorText(err, t, "reading.questionsFailed"));
    } finally {
      setQLoading(false);
    }
  }

  return (
    <section className="reading">
      <header className="reading__header">
        <button
          type="button"
          className="reading__back"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <h1 className="reading__title">{t("reading.title")}</h1>
      </header>

      {/* Плеер всего текста: пауза/продолжить, перемотка, время, повтор. */}
      {current && !loading && (
        <div className="reading__player">
          <AudioPlayer tracks={textTracks} ariaLabel={t("reading.playAll")} />
        </div>
      )}

      {/* Офлайн и нечего перечитать — режим недоступен, остальное приложение
          (карточки, повторение) работает как обычно. */}
      {offline && !current && (
        <p className="reading__notice">{t("reading.offline")}</p>
      )}

      {error && <p className="reading__error">{error}</p>}

      {loading && (
        <div className="reading__loading">
          <span className="reading__spinner" aria-hidden="true" />
          <p className="reading__notice">{t("reading.generating")}</p>
        </div>
      )}

      {!loading && !current && !offline && (
        <div className="reading__empty">
          <div className="reading__empty-emoji" aria-hidden="true">
            📖
          </div>
          <p className="reading__notice">{t("reading.emptyHint")}</p>
        </div>
      )}

      {/* Ноль взятых слов: не предупреждение, а объяснение входа — тапайте
          по незнакомым словам, так и набирается словарь. */}
      {current && !loading && noWords && (
        <p className="reading__tip">💡 {t("reading.tipNoWords")}</p>
      )}

      {current && !loading && (
        <article className="reading__text">
          {current.title && (
            <header className="reading__text-head">
              <h2 className="reading__text-title" lang={learnLang}>
                {current.title}
              </h2>
              {current.titleTranslation && (
                <p className="reading__text-subtitle" lang={nativeLang}>
                  {current.titleTranslation}
                </p>
              )}
            </header>
          )}

          {current.sentences.map((sentence, si) => {
            const open = grammar && grammar.sentence === sentence.text;
            return (
              <div className="reading__sentence" key={si}>
                <p className="reading__sentence-text" lang={learnLang}>
                  {splitWords(sentence.text).map((seg, i) =>
                    seg.isWord ? (
                      <button
                        key={i}
                        type="button"
                        className={
                          "reading__word" +
                          (knownSet.has(seg.text.toLowerCase())
                            ? " is-known"
                            : "")
                        }
                        onClick={() => lookup.open(seg.text)}
                      >
                        {seg.text}
                      </button>
                    ) : (
                      <span key={i}>{seg.text}</span>
                    ),
                  )}
                </p>

                {/* Озвучка отдельного предложения — тот же плеер (компактный до
                    запуска). Рядом — разбор грамматики. */}
                <div className="reading__tools">
                  <AudioPlayer
                    tracks={[{ text: sentence.text, learnLang }]}
                    compact
                    ariaLabel={t("tts.playExample")}
                  />
                  <button
                    type="button"
                    className={
                      "reading__grammar-btn" + (open ? " is-open" : "")
                    }
                    onClick={() => handleGrammar(sentence)}
                    disabled={offline}
                    aria-label={t("reading.grammarAria")}
                  >
                    ¶
                  </button>
                </div>

                {open && (
                  <div className="reading__grammar">
                    {sentence.translation && (
                      <p
                        className="reading__grammar-translation"
                        lang={nativeLang}
                      >
                        {sentence.translation}
                      </p>
                    )}
                    {grammar.status === "loading" && (
                      <p className="reading__notice">
                        {t("reading.grammarLoading")}
                      </p>
                    )}
                    {grammar.status === "error" && (
                      <p className="reading__error">{grammar.errorText}</p>
                    )}
                    {grammar.status === "ready" && (
                      <ul className="reading__grammar-list" lang={nativeLang}>
                        {grammar.points.map((p, pi) => (
                          <li key={pi}>{p}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </article>
      )}

      {/* Проверка понимания содержания (отзыв Игоря): те же вопросы «верно/
          неверно» + объяснение ошибки, что и в аудировании. Вопросы к тексту
          кэшируются — перепройти тот же текст можно без нового запроса к API. */}
      {current && !loading && (
        <section className="reading__comprehension">
          {!questions && (
            <>
              <button
                type="button"
                className="reading__check"
                onClick={handleCheckComprehension}
                disabled={qLoading || (offline && !cachedQuestions)}
              >
                {qLoading
                  ? t("reading.generatingQuestions")
                  : t("reading.checkBtn")}
              </button>
              <p className="reading__check-hint">{t("reading.checkHint")}</p>
              {qError && <p className="reading__error">{qError}</p>}
            </>
          )}
          {questions && (
            <ComprehensionQuestions
              questions={questions}
              learnLang={learnLang}
              nativeLang={nativeLang}
            />
          )}
        </section>
      )}

      {/* Мало слов: мягкое предложение (не условие) — взять ещё и вернуться.
          Закрывается и больше не мешает; кнопка ведёт на существующий экран
          карточек (onBack), новых экранов не заводим. */}
      {current && !loading && fewWords && !fewHintClosed && (
        <div className="reading__few" role="status">
          <p className="reading__few-text">{t("reading.tipFewWords")}</p>
          <div className="reading__few-actions">
            <button type="button" className="reading__few-cta" onClick={onBack}>
              {t("reading.toCards")}
            </button>
            <button
              type="button"
              className="reading__few-close"
              onClick={() => setFewHintClosed(true)}
              aria-label={t("common.close")}
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Управление: источник слов, новый текст. Листалки нет — «Новый текст»
          ЗАМЕНЯЕТ текущий (один текст на экране); недавние живут в кэше только
          ради разнообразия сюжетов и показа последнего при перезаходе. */}
      <div className="reading__controls">
        <WordSourcePicker
          value={wordSource}
          onChange={onChangeWordSource}
          takenCount={takenCount}
        />

        <button
          type="button"
          className="reading__generate"
          onClick={handleGenerate}
          disabled={loading || offline}
        >
          {t("reading.generate")}
        </button>
      </div>

      <WordLookupSheet
        lookup={lookup.lookup}
        learnLang={learnLang}
        nativeLang={nativeLang}
        onAdd={lookup.add}
        onClose={lookup.close}
      />
    </section>
  );
}
