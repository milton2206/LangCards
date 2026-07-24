import { useState, useEffect, useMemo, useRef } from "react";
import { splitWords, coreWord } from "../lib/highlightWord.js";
import {
  loadTexts,
  saveText,
  requestReadingText,
  requestGrammar,
} from "../lib/readingClient.js";
import { fetchTtsUrl, playUrl, stopCurrentAudio } from "../lib/ttsClient.js";
import { useWordLookup } from "../hooks/useWordLookup.js";
import WordLookupSheet from "../components/WordLookupSheet.jsx";
import PlayButton from "../components/PlayButton.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./ReadingScreen.css";

// Доля новых (незнакомых) слов — регулируется пользователем.
const SHARE_OPTIONS = [0.1, 0.2, 0.3];

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
}) {
  const { t } = useI18n();

  // История текстов пары: [0] — самый свежий.
  const [texts, setTexts] = useState(() => loadTexts(pairKey));
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [share, setShare] = useState(0.2);

  // Разбор грамматики: { sentence, status, points?, errorText? }
  const [grammar, setGrammar] = useState(null);
  // Последовательное чтение всего текста.
  const [playingAll, setPlayingAll] = useState(false);
  const playAllRef = useRef(false);

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

  // Уходим с экрана — глушим звук и останавливаем чтение вслух.
  useEffect(() => {
    return () => {
      playAllRef.current = false;
      stopCurrentAudio();
    };
  }, []);

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

  const current = texts[index] || null;

  async function handleGenerate() {
    if (loading || offline) return;
    setLoading(true);
    setError(null);
    setGrammar(null);
    try {
      const text = await requestReadingText({
        learnLang,
        nativeLang,
        topic,
        level,
        // Слова пользователя — их и просим вплести в текст.
        knownWords: takenWords || [],
        newWordShare: share,
      });
      const list = saveText(pairKey, text);
      setTexts(list);
      setIndex(0);
    } catch (err) {
      setError(
        err.code === "offline"
          ? t("errors.offline")
          : err.raw || t("reading.failed"),
      );
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
        errorText:
          err.code === "offline"
            ? t("errors.offline")
            : err.raw || t("reading.grammarFailed"),
      });
    }
  }

  // Чтение всего текста: последовательно по предложениям через тот же TTS-кэш
  // (не упираемся в лимит длины одного запроса и переиспользуем кэш фраз).
  async function handlePlayAll() {
    if (playingAll) {
      playAllRef.current = false;
      stopCurrentAudio();
      setPlayingAll(false);
      return;
    }
    if (!current || offline) return;
    playAllRef.current = true;
    setPlayingAll(true);
    try {
      for (const sentence of current.sentences) {
        if (!playAllRef.current) break;
        const url = await fetchTtsUrl({ text: sentence.text, learnLang });
        if (!url || !playAllRef.current) continue;
        await new Promise((resolve) => {
          const audio = playUrl(url);
          audio.onended = resolve;
          audio.onerror = resolve;
          audio.play().catch(resolve);
        });
      }
    } catch {
      // звук — не критичная часть: молча выходим, текст остаётся читаемым
    } finally {
      playAllRef.current = false;
      setPlayingAll(false);
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
        {current && (
          <button
            type="button"
            className={
              "reading__playall" + (playingAll ? " is-playing" : "")
            }
            onClick={handlePlayAll}
            disabled={offline}
            aria-label={t("reading.playAll")}
          >
            {playingAll ? "⏹" : "▶"}
          </button>
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
                  )}{" "}
                  <span className="reading__tools">
                    <PlayButton
                      text={sentence.text}
                      learnLang={learnLang}
                      kind="example"
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
                  </span>
                </p>

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

      {/* Управление: доля новых слов, новый текст, история сохранённых текстов */}
      <div className="reading__controls">
        <div className="reading__share">
          <span className="reading__share-label">{t("reading.newShare")}</span>
          <div className="reading__share-chips">
            {SHARE_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                className={
                  "reading__share-chip" + (share === s ? " is-active" : "")
                }
                aria-pressed={share === s}
                onClick={() => setShare(s)}
              >
                {Math.round(s * 100)}%
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="reading__generate"
          onClick={handleGenerate}
          disabled={loading || offline}
        >
          {t("reading.generate")}
        </button>

        {texts.length > 1 && (
          <div className="reading__history">
            <button
              type="button"
              className="reading__history-btn"
              onClick={() => {
                setGrammar(null);
                setIndex((i) => Math.min(texts.length - 1, i + 1));
              }}
              disabled={index >= texts.length - 1}
              aria-label={t("reading.older")}
            >
              ←
            </button>
            <span className="reading__history-label">
              {t("reading.saved", { n: index + 1, total: texts.length })}
            </span>
            <button
              type="button"
              className="reading__history-btn"
              onClick={() => {
                setGrammar(null);
                setIndex((i) => Math.max(0, i - 1));
              }}
              disabled={index === 0}
              aria-label={t("reading.newer")}
            >
              →
            </button>
          </div>
        )}
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
