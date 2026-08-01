import { splitWords } from "../lib/highlightWord.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import PlayButton from "./PlayButton.jsx";
import ConjugationPanel from "./ConjugationPanel.jsx";

/**
 * Карточка слова (лицо: слово + перевод + пример в контексте) — РЕАЛЬНЫЙ
 * компонент, вынесенный из CardScreen, чтобы один и тот же вид использовался
 * и в потоке новых слов, и в туториале (демо-режим). Только представление:
 * ни свайпов, ни SRS здесь нет — это делает вызывающий экран.
 *
 * card — { word, register?, plural?, translit?, translation, example,
 *          exampleTranslation, note?, pos? }.
 * onWordTap(word) — тап по слову примера (перевод/добавление); на карточке это
 *   lookup.open, в туториале — демо-просмотр. Если не передан — слова не
 *   тапабельны (обычный текст).
 * innerRef / style / className — прокидываются на <article> для свайпа и анимаций.
 */
export default function WordCard({
  card,
  learnLang,
  nativeLang,
  onWordTap,
  innerRef,
  style,
  className = "",
}) {
  const { t } = useI18n();

  return (
    <article
      className={"cards__card" + (className ? " " + className : "")}
      ref={innerRef}
      style={style}
    >
      <div className="cards__word-block">
        {/* «Контекст носителей»: короткий ярлык стиля/регистра над выражением
            (сленг / вежливо / устарело …). У обычных слов поле пустое. */}
        {card.register && (
          <span className="cards__register">{card.register}</span>
        )}
        {/* Слово + кнопка озвучки (фаза 5.1): без аудио карточка работает
            как раньше — кнопка просто неактивна. */}
        <div className="cards__word-row">
          <h1 id="card-word" className="cards__word" lang={learnLang}>
            {card.word}
          </h1>
          <PlayButton
            text={card.word}
            learnLang={learnLang}
            kind="word"
            appearance="ember"
          />
        </div>
        {/* Множественное число (существительные): показываем компактной строкой
            рядом с основной формой. У слов без мн. числа (глаголы, выражения,
            старые карточки без поля) — не показываем, без пустого места. */}
        {card.plural && (
          <p className="cards__plural">
            <span className="cards__plural-label">{t("cards.plural")}</span>
            <span className="cards__plural-form" lang={learnLang}>
              {card.plural}
            </span>
          </p>
        )}
        {card.translit && <p className="cards__translit">{card.translit}</p>}
        <p className="cards__translation">{card.translation}</p>
      </div>

      <div className="cards__divider" />

      <div className="cards__example">
        <div className="cards__example-label-row">
          <span className="cards__example-label">{t("cards.example")}</span>
          <PlayButton
            text={card.example}
            learnLang={learnLang}
            kind="example"
            appearance="ember"
          />
        </div>
        {/* Каждое слово примера тапабельно: перевод + добавление в изучение
            прямо из контекста (лёгкий пунктир снизу — намёк на тап). */}
        <p className="cards__example-text" lang={learnLang}>
          {splitWords(card.example).map((seg, i) =>
            seg.isWord && onWordTap ? (
              <button
                key={i}
                type="button"
                className="cards__example-word"
                onClick={() => onWordTap(seg.text)}
              >
                {seg.text}
              </button>
            ) : (
              <span key={i}>{seg.text}</span>
            ),
          )}
        </p>
        <p className="cards__example-translation">{card.exampleTranslation}</p>
      </div>

      {/* «Контекст носителей»: пометка об уместности/регистре выражения.
          У обычных слов поле пустое — блок не показывается. */}
      {card.note && (
        <div className="cards__note">
          <span className="cards__note-label">{t("cards.usageNote")}</span>
          <p className="cards__note-text">{card.note}</p>
        </div>
      )}

      {/* Спряжение — только у глаголов (по данным карточки card.pos). Общая
          панель (та же в тексте чтения): таблица строится ПО ЗАПРОСУ и
          кэшируется по НАЧАЛЬНОЙ форме. У существительных/старых карточек без
          pos её нет. Подсвечиваем форму с карточки — видно, где она в таблице. */}
      {card.pos === "verb" && (
        <ConjugationPanel
          word={card.word}
          form={card.word}
          learnLang={learnLang}
          nativeLang={nativeLang}
        />
      )}
    </article>
  );
}
