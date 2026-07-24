import { MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import PlayButton from "./PlayButton.jsx";
import "./WordLookupSheet.css";

/**
 * Шторка просмотра слова: перевод, транскрипция, короткий пример, озвучка
 * (переиспользует PlayButton и общий TTS-кэш фазы 5.1) и кнопка «Взять».
 * Общая для примера на карточке и для текста в режиме чтения — см.
 * useWordLookup, который держит состояние и логику добавления в SRS.
 */
export default function WordLookupSheet({
  lookup,
  learnLang,
  nativeLang,
  onAdd,
  onClose,
}) {
  const { t } = useI18n();
  if (!lookup) return null;

  const card = lookup.card;
  const shownWord = card ? card.word : lookup.word;

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
            {card && (
              <PlayButton text={card.word} learnLang={learnLang} kind="word" />
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

        {lookup.status === "loading" && (
          <p className="lookup__hint">{t("lookup.loading")}</p>
        )}

        {lookup.status === "error" && (
          <p className="lookup__error">{lookup.errorText}</p>
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
                  />
                </div>
                {card.exampleTranslation && (
                  <p className="lookup__example-translation" lang={nativeLang}>
                    {card.exampleTranslation}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {lookup.status === "limit" && (
          <p className="lookup__error">
            {t("common.activeLimit", { max: MAX_ACTIVE_WORDS })}
          </p>
        )}

        {lookup.status === "ready" && (
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
