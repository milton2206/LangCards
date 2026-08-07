import { MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import PlayButton from "./PlayButton.jsx";
import ConjugationPanel from "./ConjugationPanel.jsx";
import "./WordLookupSheet.css";

/**
 * Шторка просмотра слова: перевод, транскрипция, короткий пример, озвучка
 * (переиспользует PlayButton и общий TTS-кэш фазы 5.1) и кнопка «Взять».
 * Общая для примера на карточке и для текста в режиме чтения — см.
 * useWordLookup, который держит состояние и логику добавления в SRS.
 *
 * РАСШИРЕНИЕ ДО ОБОРОТА (общее для обоих мест, двух поведений не заводим):
 * стрелки присоединяют соседнее слово того же предложения, «↺» возвращает к
 * одному слову. У оборота показываем ТОЛЬКО перевод в контексте: транскрипция,
 * пример, таблица форм и «Взять в изучение» для него бессмысленны.
 * Стрелки появляются, если вызвавший экран дал контекст предложения (span).
 */
export default function WordLookupSheet({
  lookup,
  learnLang,
  nativeLang,
  onAdd,
  onExtend,
  onReset,
  onClose,
}) {
  const { t } = useI18n();
  if (!lookup) return null;

  const span = lookup.span || null;
  const isPhrase = Boolean(span && span.to > span.from);
  // У оборота заголовок — сама фраза; у одного слова, как и раньше, заголовочная
  // форма из карточки (может отличаться от тапнутой словоформы).
  const card = isPhrase ? null : lookup.card;
  const shownWord = card ? card.word : lookup.word;
  const canLeft = Boolean(span && span.from > 0 && onExtend);
  const canRight = Boolean(span && span.to < span.words.length - 1 && onExtend);
  const canReset = Boolean(isPhrase && onReset);

  return (
    // Тап по подложке закрывает; сама шторка клики не пропускает.
    <div className="lookup-overlay" onClick={onClose}>
      <div
        className="lookup"
        role="dialog"
        aria-label={shownWord}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="lookup__head">
          <span className="lookup__word" lang={learnLang}>
            {shownWord}
          </span>
          <div className="lookup__head-actions">
            {(card || isPhrase) && (
              <PlayButton
                text={card ? card.word : lookup.word}
                learnLang={learnLang}
                kind={isPhrase ? "example" : "word"}
                appearance="ember"
              />
            )}
            <button
              type="button"
              className="lookup__close"
              onClick={onClose}
              aria-label={t("common.close")}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Раздвинуть выделение на соседнее слово того же предложения. Стрелка
            гаснет, когда в эту сторону предложение кончилось. */}
        {span && onExtend && (
          <div className="lookup__span" role="group" aria-label={t("lookup.spanAria")}>
            <button
              type="button"
              className="lookup__span-btn"
              onClick={() => onExtend(-1)}
              disabled={!canLeft}
              aria-label={t("lookup.extendLeft")}
            >
              ←
            </button>
            <span className="lookup__span-hint">
              {isPhrase ? t("lookup.phrase") : t("lookup.extendHint")}
            </span>
            <button
              type="button"
              className="lookup__span-btn"
              onClick={() => onReset()}
              disabled={!canReset}
              aria-label={t("lookup.resetWord")}
            >
              ↺
            </button>
            <button
              type="button"
              className="lookup__span-btn"
              onClick={() => onExtend(1)}
              disabled={!canRight}
              aria-label={t("lookup.extendRight")}
            >
              →
            </button>
          </div>
        )}

        {lookup.status === "loading" && (
          <p className="lookup__hint">
            {isPhrase ? t("lookup.phraseLoading") : t("lookup.loading")}
          </p>
        )}

        {lookup.status === "error" && (
          <p className="lookup__error">{lookup.errorText}</p>
        )}

        {/* Оборот: только перевод в контексте — ни транскрипции, ни примера,
            ни таблицы форм, они для оборота ничего не значат. */}
        {isPhrase && lookup.translation && (
          <div className="lookup__body">
            <p className="lookup__translation" lang={nativeLang}>
              {lookup.translation}
            </p>
          </div>
        )}

        {card && (
          <div className="lookup__body">
            {card.translit && (
              <p className="lookup__translit">{card.translit}</p>
            )}
            <p className="lookup__translation" lang={nativeLang}>
              {card.translation}
            </p>
            {card.example && (
              <div className="lookup__example">
                <div className="lookup__example-row">
                  <p className="lookup__example-text" lang={learnLang}>
                    {card.example}
                  </p>
                  <PlayButton
                    text={card.example}
                    learnLang={learnLang}
                    kind="example"
                    appearance="ember"
                  />
                </div>
                {card.exampleTranslation && (
                  <p className="lookup__example-translation" lang={nativeLang}>
                    {card.exampleTranslation}
                  </p>
                )}
              </div>
            )}

            {/* Глагол → та же панель спряжения, что и на карточке (общий модуль,
                общий кэш по слову: слово из текста и из карточки не генерируется
                дважды). У не-глаголов кнопки нет. */}
            {card.pos === "verb" && (
              <ConjugationPanel
                word={card.word}
                // Подсвечиваем в таблице именно ту форму, по которой тапнули
                // в тексте (она может отличаться от заголовочного слова).
                form={lookup.word}
                learnLang={learnLang}
                nativeLang={nativeLang}
                variant="lookup"
              />
            )}
          </div>
        )}

        {lookup.status === "limit" && (
          <p className="lookup__error">
            {t("common.activeLimit", { max: MAX_ACTIVE_WORDS })}
          </p>
        )}

        {/* «Взять в изучение» — только для одного слова: оборот в SRS не кладём. */}
        {lookup.status === "ready" && card && (
          <button type="button" className="lookup__add" onClick={onAdd}>
            {t("addWord.add")}
          </button>
        )}

        {lookup.status === "added" && (
          <p className="lookup__added" role="status">
            ✓ {t("lookup.added")}
          </p>
        )}
      </div>
    </div>
  );
}
