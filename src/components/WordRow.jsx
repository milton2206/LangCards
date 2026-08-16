import { useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import PlayButton from "./PlayButton.jsx";
import ConjugationPanel from "./ConjugationPanel.jsx";
import Icon from "./icons/Icon.jsx";

/**
 * СТРОКА СПИСКА СЛОВ — одна на оба списка: «На изучении» (MyWordsScreen) и
 * «Известные» (KnownWordsScreen). Разметка и оформление у них были одинаковые,
 * но лежали двумя копиями; раскрытие подробностей заводить дважды нельзя —
 * разъедется при первой же правке.
 *
 * СВЁРНУТО видно то, ради чего список открывают: слово, перевод, метка срока,
 * озвучка и действие («Выучил» / «Вернуть»). Под стрелкой справа — подробности:
 * транскрипция, пример с переводом (и его озвучка) и таблица спряжения. Раньше
 * всё это было развёрнуто всегда, и на экран помещалось три-четыре слова, хотя
 * заходят в список обычно окинуть слова взглядом.
 *
 * Раскрытие ПОШТУЧНОЕ и живёт здесь же, в состоянии строки: между заходами оно
 * не запоминается намеренно — список открывают ради обзора, и раскрытые с
 * прошлого раза строки только мешали бы.
 *
 * Таблица спряжения (ConjugationPanel) лежит ВНУТРИ раскрытия, поэтому список
 * не дёргает сеть за каждое слово: она и раньше ходила к API только по нажатию,
 * а теперь до этой кнопки надо ещё и строку раскрыть.
 *
 * item — запись из wordInfo + само слово; picking — включён режим выбора
 * (строка работает как чекбокс, раскрытия нет вовсе); due — метка срока
 * повторения { label, state } или null; speakWord/speakExample — показывать ли
 * озвучку слова (в свёрнутой строке) и примера (внутри раскрытия);
 * action — { label, onClick, disabled, className } для «Выучил» / «Вернуть»;
 * detailsEnabled — можно ли раскрывать вообще (в разборе созревших не нужно:
 * там список должен просматриваться целиком).
 */
export default function WordRow({
  item,
  learnLang,
  nativeLang,
  picking = false,
  checked = false,
  onToggle,
  due = null,
  speakWord = false,
  speakExample = false,
  action = null,
  detailsEnabled = true,
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const isVerb = item.pos === "verb";
  const hasDetails = Boolean(item.translit || item.example || isVerb);
  // В режиме выбора строка целиком — чекбокс: стрелку не показываем вовсе,
  // чтобы тап по ней не спорил с отметкой слова.
  const canExpand = detailsEnabled && hasDetails && !picking;
  const showDetails = canExpand && open;

  return (
    <li
      className={
        "mywords__item" +
        (picking ? " mywords__item--selectable" : "") +
        (checked ? " is-selected" : "")
      }
      onClick={picking ? onToggle : undefined}
    >
      <div className="mywords__item-row">
        {picking && (
          <span
            className={"mywords__checkbox" + (checked ? " is-checked" : "")}
            aria-hidden="true"
          >
            {checked ? "✓" : ""}
          </span>
        )}

        <div className="mywords__item-text">
          <span className="mywords__word" lang={learnLang}>
            {item.word}
          </span>
          {item.translation && (
            <span className="mywords__translation">{item.translation}</span>
          )}
        </div>

        {due && (
          <span className={`mywords__due mywords__due--${due.state}`}>
            {due.label}
          </span>
        )}

        {speakWord && !picking && (
          <PlayButton
            text={item.word}
            learnLang={learnLang}
            kind="word"
            appearance="ember"
          />
        )}

        {action && !picking && (
          <button
            type="button"
            className={action.className}
            onClick={action.onClick}
            disabled={action.disabled}
          >
            {action.label}
          </button>
        )}

        {/* Стрелка раскрытия — как «Ещё» на карточке: тот же шеврон, тот же
            поворот на 180°. Второго вида раскрытия в приложении не заводим. */}
        {canExpand && (
          <button
            type="button"
            className={"mywords__expand" + (open ? " is-open" : "")}
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t(open ? "words.collapseAria" : "words.expandAria", {
              word: item.word,
            })}
          >
            <Icon name="chevron" size={16} className="mywords__expand-chevron" />
          </button>
        )}
      </div>

      {showDetails && (
        <div className="mywords__details">
          {item.translit && (
            <span className="mywords__translit">{item.translit}</span>
          )}

          {item.example && (
            <div className="mywords__example">
              <div className="mywords__example-row">
                <p className="mywords__example-text" lang={learnLang}>
                  {item.example}
                </p>
                {speakExample && (
                  <PlayButton
                    text={item.example}
                    learnLang={learnLang}
                    kind="example"
                    appearance="ember"
                  />
                )}
              </div>
              {item.exampleTranslation && (
                <p className="mywords__example-translation" lang={nativeLang}>
                  {item.exampleTranslation}
                </p>
              )}
            </div>
          )}

          {/* Глаголы: таблица форм по запросу. Признак тот же, что у карточки
              (pos === "verb"); у слов без pos — старых записей и не-глаголов —
              панели нет. Сама панель ходит к API только по своей кнопке. */}
          {isVerb && (
            <ConjugationPanel
              word={item.word}
              // Подсвечиваем в таблице ту форму, под которой слово сохранено, —
              // как на карточке подсвечивается тапнутая.
              form={item.word}
              learnLang={learnLang}
              nativeLang={nativeLang}
              variant="mywords"
            />
          )}
        </div>
      )}
    </li>
  );
}
