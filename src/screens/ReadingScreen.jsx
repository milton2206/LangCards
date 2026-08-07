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
  recentDialogueTitles,
} from "../lib/comprehensionClient.js";
import { stopCurrentAudio } from "../lib/ttsClient.js";
import { apiErrorText } from "../lib/apiClient.js";
import { ENOUGH_WORDS_FOR_READING } from "../hooks/useWordLists.js";
import { useWordLookup } from "../hooks/useWordLookup.js";
import WordLookupSheet from "../components/WordLookupSheet.jsx";
import AudioPlayer from "../components/AudioPlayer.jsx";
import ComprehensionQuestions from "../components/ComprehensionQuestions.jsx";
import Icon from "../components/icons/Icon.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./ReadingScreen.css";

// Единственное поведение генерации (выбор источника слов убран): «смешанно» —
// узнавание уже изучаемых слов + немного нового под тему и уровень. Служит и
// ключом кэша: старые записи «mine»/«new» просто не читаются (не ломают выдачу).
const WORD_SOURCE = "mixed";

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
  onAddWord,
  onBack,
  // Движок заданий (необязательно): объём блока «чтение» — сколько предложений
  // в тексте. Без него — обычная длина под уровень.
  plannedSentences = null,
  // Реальное завершение блока чтения: прочитал И ответил на вопросы.
  onQuestionsComplete = null,
}) {
  const { t } = useI18n();

  // Недавние тексты пары: [0] — самый свежий, он и на экране (один текст за раз,
  // «Новый текст» его ЗАМЕНЯЕТ). Историю храним не для листалки, а чтобы (1) при
  // перезаходе показать последний без запроса к API и (2) отдать модели
  // заголовки недавних сюжетов — тогда она не повторяет один и тот же сценарий.
  const [texts, setTexts] = useState(() => loadTexts(pairKey, WORD_SOURCE));
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

  // Смена пары — показываем её последний текст.
  useEffect(() => {
    setTexts(loadTexts(pairKey, WORD_SOURCE));
    setGrammar(null);
  }, [pairKey]);

  // Сменился показанный текст (сгенерировали новый) — прячем вопросы и разбор прошлого.
  useEffect(() => {
    setQuestions(null);
    setQError(null);
    setGrammar(null);
  }, [texts]);

  const lookup = useWordLookup({
    learnLang,
    nativeLang,
    level,
    onAdd: onAddWord,
    // Для проверки «такой оборот уже взят» (обычное взятие слова дубликат просто
    // молча проглотило бы).
    takenWords,
  });

  // Что сейчас выделено в тексте (слово или раздвинутый оборот) — чтобы было
  // видно, что именно переводится. Границы приходят из шторки просмотра.
  const span = lookup.lookup?.span || null;

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
      // Недавние диалоги аудирования этой темы — чтобы текст чтения не совпал с
      // диалогом (механизм генерации общий, но результаты должны расходиться).
      const otherTitles = recentDialogueTitles(pairKey, WORD_SOURCE, topic);

      const text = await requestReadingText({
        learnLang,
        nativeLang,
        topic,
        level,
        // Слова пользователя вплетаются в текст (поведение «смешанно»: узнавание
        // изучаемого + немного нового под тему и уровень).
        knownWords: takenWords || [],
        recentTitles,
        otherTitles,
        // Объём блока чтения из движка заданий (сервер зажимает 3–8).
        sentences: plannedSentences || undefined,
      });
      // Помечаем текст темой (для фильтра «недавних сюжетов» выше) и кладём в
      // кэш пары: новый текст становится текущим (заменяет прежний на экране),
      // прежние остаются в кэше только для разнообразия и перезахода.
      const list = saveText(pairKey, WORD_SOURCE, { ...text, topic });
      setTexts(list);
    } catch (err) {
      setError(apiErrorText(err, t, "reading.failed"));
    } finally {
      setLoading(false);
    }
  }

  // Грамматика ПО ОДНОМУ предложению (как до редизайна): лимит 300 символов
  // применяется к одному предложению, а не ко всему тексту. Тап по значку «¶»
  // у предложения разбирает ИМЕННО его; повторный тап по тому же — закрывает.
  // grammar хранит text открытого предложения — чтобы подсветить его значок и
  // показать разбор именно под текстом.
  async function handleGrammar(sentence) {
    if (grammar && grammar.sentence === sentence.text) {
      setGrammar(null);
      return;
    }
    if (offline) return;
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
        translation: sentence.translation || null,
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
        {(level || topic) && (
          <span className="reading__meta">
            {[level && level.toUpperCase(), topic].filter(Boolean).join(" · ")}
          </span>
        )}
      </header>

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
          <div className="reading__text-head">
            <div className="reading__text-titles">
              {current.title && (
                <h2 className="reading__text-title" lang={learnLang}>
                  {current.title}
                </h2>
              )}
              {current.titleTranslation && (
                <p className="reading__text-subtitle" lang={nativeLang}>
                  {current.titleTranslation}
                </p>
              )}
            </div>
            {/* Озвучка всего текста — терракотовый квадрат, разворачивается в
                плеер при запуске. Источник звука и плеер прежние. */}
            <AudioPlayer
              tracks={textTracks}
              compact
              appearance="ember"
              ariaLabel={t("reading.playAll")}
            />
          </div>

          {/* Текст по предложениям: слова тапабельны (перевод), у каждого
              предложения — значок «¶» для разбора грамматики ИМЕННО его.
              Предложения идут в поток (вид Ember сохранён). */}
          <p className="reading__body" lang={learnLang}>
            {current.sentences.map((sentence, si) => {
              const open = grammar && grammar.sentence === sentence.text;
              // Номер слова внутри предложения: по нему считаются границы
              // расширения и подсветка выбранного оборота.
              let wordIndex = -1;
              const inThis = span && span.sentence === sentence.text;
              return (
                <span key={si} className="reading__sentence">
                  {splitWords(sentence.text).map((seg, i) => {
                    if (!seg.isWord) return <span key={i}>{seg.text}</span>;
                    wordIndex += 1;
                    const wi = wordIndex;
                    const picked =
                      inThis && wi >= span.from && wi <= span.to;
                    return (
                      <button
                        key={i}
                        type="button"
                        className={
                          "reading__word" +
                          (knownSet.has(seg.text.toLowerCase())
                            ? " is-known"
                            : "") +
                          (picked ? " is-picked" : "")
                        }
                        onClick={() =>
                          lookup.open(seg.text, {
                            sentence: sentence.text,
                            // Перевод предложения уже есть в данных чтения:
                            // растянув выделение на всё предложение, покажем
                            // его без обращения к API.
                            sentenceTranslation: sentence.translation,
                            wordIndex: wi,
                          })
                        }
                      >
                        {seg.text}
                      </button>
                    );
                  })}
                  {/* Разбор грамматики этого предложения (лимит 300 символов —
                      к одному предложению, а не ко всему тексту). */}
                  <button
                    type="button"
                    className={
                      "reading__grammar-btn" + (open ? " is-open" : "")
                    }
                    onClick={() => handleGrammar(sentence)}
                    disabled={offline}
                    aria-label={t("reading.grammarAria")}
                    aria-expanded={Boolean(open)}
                  >
                    ¶
                  </button>
                  {si < current.sentences.length - 1 ? " " : ""}
                </span>
              );
            })}
          </p>

          <p className="reading__legend">
            <span className="reading__legend-dot" aria-hidden="true" />
            {t("reading.legend")}
          </p>
        </article>
      )}

      {/* Разбор грамматики выбранного предложения — под текстом. */}
      {grammar && (
        <div className="reading__grammar">
          {grammar.translation && (
            <p className="reading__grammar-translation" lang={nativeLang}>
              {grammar.translation}
            </p>
          )}
          {grammar.status === "loading" && (
            <p className="reading__notice">{t("reading.grammarLoading")}</p>
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

      {/* Новый текст (генерация заменяет текущий). */}
      {!loading && (current || !offline) && (
        <div className="reading__actions">
          <button
            type="button"
            className="reading__action"
            onClick={handleGenerate}
            disabled={loading || offline}
          >
            <Icon name="spark" size={18} className="reading__action-icon" />
            {t("reading.generate")}
          </button>
        </div>
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
              onFinished={onQuestionsComplete}
              appearance="ember"
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

      {/* Нижняя подсказка: без баллов и таймера — ошибка просто объясняется. */}
      {current && !loading && (
        <p className="reading__foot">{t("reading.noScore")}</p>
      )}

      <WordLookupSheet
        lookup={lookup.lookup}
        learnLang={learnLang}
        nativeLang={nativeLang}
        onAdd={lookup.add}
        onConfirmAdd={lookup.confirmAdd}
        onCancelAdd={lookup.cancelAdd}
        onExtend={lookup.extend}
        onReset={lookup.reset}
        onClose={lookup.close}
      />
    </section>
  );
}
