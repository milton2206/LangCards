import { useState, useEffect } from "react";
import { splitWords } from "../lib/highlightWord.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import PlayButton from "./PlayButton.jsx";
import ConjugationPanel from "./ConjugationPanel.jsx";
import Icon from "./icons/Icon.jsx";

/**
 * Пример в контексте — ОБЩИЙ блок карточки и туториала (демо-шаг «слова живут в
 * примерах»), чтобы вид и поведение в двух местах не разъезжались.
 *
 * Перевод примера скрыт за тапом: так экран не растёт, и это полезнее — сначала
 * попытка понять самому. Состояние сбрасывается при смене примера, иначе перевод
 * «прилипал» бы к следующему слову.
 */
export function ExampleBlock({
  example,
  exampleTranslation,
  learnLang,
  onWordTap,
}) {
  const { t } = useI18n();
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setRevealed(false);
  }, [example]);

  return (
    <div className="cards__example">
      {/* Заголовка «ПРИМЕР» нет: левая терракотовая полоса и так читается как
          отдельный блок. Кнопка озвучки — в одной строке с текстом. */}
      <div className="cards__example-row">
        {/* Каждое слово примера тапабельно: перевод + добавление в изучение
            прямо из контекста (лёгкий пунктир снизу — намёк на тап). */}
        <p className="cards__example-text" lang={learnLang}>
          {splitWords(example).map((seg, i) =>
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
        <PlayButton
          text={example}
          learnLang={learnLang}
          kind="example"
          appearance="ember"
        />
      </div>

      {/* Кнопки нет, если переводить нечего (старые карточки без поля). */}
      {exampleTranslation &&
        (revealed ? (
          <p className="cards__example-translation">{exampleTranslation}</p>
        ) : (
          <button
            type="button"
            className="cards__reveal"
            onClick={() => setRevealed(true)}
          >
            {t("cards.showTranslation")}
          </button>
        ))}
    </div>
  );
}

/**
 * Карточка слова (лицо: слово + перевод + пример в контексте) — РЕАЛЬНЫЙ
 * компонент, вынесенный из CardScreen, чтобы один и тот же вид использовался
 * и в потоке новых слов, и в туториале (демо-режим). Только представление:
 * ни свайпов, ни SRS здесь нет — это делает вызывающий экран.
 *
 * На виду ровно то, что нужно для решения «знаю / беру»: слово, перевод, пример.
 * Транскрипция и множественное число — в свёрнутых «Деталях», перевод примера —
 * по тапу. Так карточка помещается в экран телефона целиком и после свайпа не
 * приходится возвращать прокрутку наверх.
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

  // «Детали» сбрасываем при смене слова — открытая панель не должна переезжать
  // на следующую карточку.
  const [detailsOpen, setDetailsOpen] = useState(false);
  useEffect(() => {
    setDetailsOpen(false);
  }, [card.word]);

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
        <p className="cards__translation">{card.translation}</p>

        {/* «Детали» — транскрипция и множественное число. Строка есть ВСЕГДА,
            независимо от языковой пары и от того, дал ли генератор мн. число:
            одно предсказуемое место, где лежит всё второстепенное, вместо
            блоков, которые то появляются, то нет. */}
        <div className="cards__details">
          <button
            type="button"
            className={
              "cards__details-btn" + (detailsOpen ? " is-open" : "")
            }
            onClick={() => setDetailsOpen((v) => !v)}
            aria-expanded={detailsOpen}
          >
            {t("cards.details")}
            <Icon name="chevron" size={16} className="cards__details-chevron" />
          </button>
          {detailsOpen && (
            <div className="cards__details-body">
              {/* Транскрипция показывается всегда; прочерк — если генератор её
                  не дал (идиомы, старые карточки), чтобы панель не была пустой. */}
              <p className="cards__translit">{card.translit || "—"}</p>
              {card.plural && (
                <p className="cards__plural">
                  <span className="cards__plural-label">
                    {t("cards.plural")} —
                  </span>{" "}
                  <span className="cards__plural-form" lang={learnLang}>
                    {card.plural}
                  </span>
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="cards__divider" />

      <ExampleBlock
        example={card.example}
        exampleTranslation={card.exampleTranslation}
        learnLang={learnLang}
        onWordTap={onWordTap}
      />

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
