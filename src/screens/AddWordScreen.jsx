import { useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { requestManualCard } from "../lib/manualCard.js";
import { MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import "./AddWordScreen.css";

// Локализованный текст ошибки по коду из requestManualCard.
function errorMessage(error, t) {
  if (!error) return null;
  if (error.code === "notRecognized") return t("addWord.notRecognized");
  if (error.code === "offline") return t("errors.offline");
  return error.raw || t("addWord.failed");
}

/**
 * Ручное добавление своего слова. Пользователь вводит слово/выражение (на
 * изучаемом ИЛИ родном языке), ИИ по нему собирает полную карточку (перевод,
 * транскрипция, пример + перевод примера) — тот же формат, что у обычных карточек.
 * После подтверждения карточка добавляется в изучение текущей языковой пары
 * (takenWords) и участвует в повторении/синхронизации как обычная.
 */
export default function AddWordScreen({
  learnLang,
  nativeLang,
  onAdd,
  onOpenMyWords,
  onBack,
}) {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | preview | added
  const [card, setCard] = useState(null);
  const [error, setError] = useState(null); // { code, raw }
  const [limitHit, setLimitHit] = useState(false);

  async function handleGenerate(e) {
    e.preventDefault();
    const word = text.trim();
    if (!word || status === "loading") return;
    setStatus("loading");
    setError(null);
    setLimitHit(false);
    try {
      const c = await requestManualCard({ learnLang, nativeLang, word });
      setCard(c);
      setStatus("preview");
    } catch (err) {
      setError({ code: err.code, raw: err.raw });
      setStatus("idle");
    }
  }

  // Добавляем готовую карточку в изучение. onAdd возвращает false, если достигнут
  // лимит активных слов — тогда показываем мягкую подсказку, карточку не теряем.
  function handleAdd() {
    const ok = onAdd(card);
    if (ok) setStatus("added");
    else setLimitHit(true);
  }

  function reset() {
    setText("");
    setCard(null);
    setStatus("idle");
    setError(null);
    setLimitHit(false);
  }

  const errText = errorMessage(error, t);

  return (
    <section className="addword">
      <header className="addword__header">
        <button
          type="button"
          className="addword__back"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <h1 className="addword__title">{t("addWord.title")}</h1>
      </header>

      {status === "added" ? (
        <div className="addword__result">
          <div className="addword__result-emoji" aria-hidden="true">
            ✅
          </div>
          <h2 className="addword__result-title">{t("addWord.addedTitle")}</h2>
          <p className="addword__result-hint">{t("addWord.addedHint")}</p>
          <div className="addword__result-actions">
            <button type="button" className="addword__primary" onClick={reset}>
              {t("addWord.addMore")}
            </button>
            <button
              type="button"
              className="addword__ghost"
              onClick={onOpenMyWords}
            >
              {t("addWord.openMyWords")}
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Форма ввода видна, пока нет готового предпросмотра: в предпросмотре
              единственное основное действие — «Добавить в изучение». */}
          {status !== "preview" && (
            <>
              <p className="addword__hint">{t("addWord.hint")}</p>

              <form className="addword__form" onSubmit={handleGenerate}>
                <input
                  className="addword__input"
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={t("addWord.placeholder")}
                  autoFocus
                  disabled={status === "loading"}
                  enterKeyHint="go"
                />
                <button
                  type="submit"
                  className="addword__primary"
                  disabled={!text.trim() || status === "loading"}
                >
                  {status === "loading"
                    ? t("addWord.generating")
                    : t("addWord.generate")}
                </button>
              </form>
            </>
          )}

          {errText && (
            <p className="addword__error" role="status">
              {errText}
            </p>
          )}

          {status === "loading" && (
            <div className="addword__loading" aria-hidden="true">
              <span className="addword__spinner" />
            </div>
          )}

          {status === "preview" && card && (
            <div className="addword__preview">
              <article className="addword__card">
                <div className="addword__word-block">
                  <h2 className="addword__word" lang={learnLang}>
                    {card.word}
                  </h2>
                  {card.translit && (
                    <p className="addword__translit">{card.translit}</p>
                  )}
                  <p className="addword__translation">{card.translation}</p>
                </div>
                {card.example && (
                  <div className="addword__example">
                    <span className="addword__example-label">
                      {t("cards.example")}
                    </span>
                    <p className="addword__example-text" lang={learnLang}>
                      {card.example}
                    </p>
                    {card.exampleTranslation && (
                      <p
                        className="addword__example-translation"
                        lang={nativeLang}
                      >
                        {card.exampleTranslation}
                      </p>
                    )}
                  </div>
                )}
              </article>

              {limitHit && (
                <p className="addword__error" role="status">
                  {t("common.activeLimit", { max: MAX_ACTIVE_WORDS })}
                </p>
              )}

              <div className="addword__preview-actions">
                <button
                  type="button"
                  className="addword__primary"
                  onClick={handleAdd}
                >
                  {t("addWord.add")}
                </button>
                <button
                  type="button"
                  className="addword__ghost"
                  onClick={reset}
                >
                  {t("addWord.another")}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
