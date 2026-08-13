import { useEffect } from "react";
import { useWordSelection } from "../hooks/useWordSelection.js";
import { isMatureForKnown } from "../hooks/useWordLists.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import SelectBar from "../components/SelectBar.jsx";
import PromoteBar from "../components/PromoteBar.jsx";
import WordListTabs from "../components/WordListTabs.jsx";
import PlayButton from "../components/PlayButton.jsx";
import ConjugationPanel from "../components/ConjugationPanel.jsx";
import "./MyWordsScreen.css";

/**
 * Список слов, взятых на изучение (takenWords). Порядок — как добавляли.
 * Полные данные (перевод, транскрипция, пример) берём из wordInfo — там же,
 * где их сохраняет главный экран при показе карточек.
 *
 * Режим выбора («Выбрать») позволяет отметить слова чекбоксами и удалить
 * их совсем (из списков и хранилища) с подтверждением.
 *
 * РАЗБОР СОЗРЕВШИХ — второй, отдельный режим: показывает только слова, чей
 * интервал дорос до порога зрелости (isMatureForKnown — то же условие, что у
 * чек-пойнта в потоке повторения), и переносит отмеченные в известные пачкой.
 * Это главный способ разгрузить активные: чек-пойнт спрашивает про несколько
 * слов за занятие, а здесь очередь разбирается целиком и по своей воле.
 *
 * У глаголов строка раскрывается таблицей спряжения — ТОТ ЖЕ компонент и тот же
 * клиентский путь, что на карточке (ConjugationPanel → conjugationClient). Кэш
 * общий и работает по начальной форме, поэтому открытое на карточке спряжение
 * здесь показывается мгновенно и без обращения к API. Список при этом остаётся
 * списком: таблица разворачивается внутри строки, экран в карточку не
 * превращается, прочие действия строки не меняются.
 */
export default function MyWordsScreen({
  takenWords,
  knownCount,
  wordInfo,
  srsByWord = {},
  todayKey,
  learnLang,
  nativeLang,
  onMarkKnown,
  onDelete,
  onBack,
  onOpenKnown,
  // Разбор созревших пачкой: (перенести[], оставить[]) — перенос делает тот же
  // markKnown, а по оставленным записывается отказ (как в чек-пойнте), чтобы
  // приложение не спросило про них тем же вопросом на следующем повторении.
  onPromoteMature = null,
}) {
  const { t } = useI18n();
  const items = takenWords.map((word) => ({
    word,
    ...wordInfo[word],
  }));

  // Созревшие: интервал дорос до порога. Условие ОДНО на приложение
  // (isMatureForKnown), второго определения «выучено» здесь не заводим. Память
  // об отказе в чек-пойнте тут не учитывается намеренно: человек сам открыл
  // разбор — значит хочет пересмотреть очередь целиком.
  const matureWords = takenWords.filter((w) => isMatureForKnown(srsByWord[w]));

  // Метка срока повторения из СУЩЕСТВУЮЩИХ SRS-данных (nextReviewDate) — только
  // отображение, планирование не трогаем. «today» — пора/просрочено (терракота),
  // близкий срок — оливковым, далёкий — приглушённо.
  function dueInfo(word) {
    const next = srsByWord?.[word]?.nextReviewDate;
    if (!next || !todayKey) return null;
    const days = Math.round(
      (Date.parse(next) - Date.parse(todayKey)) / 86400000,
    );
    if (days <= 0) return { label: t("words.dueToday"), state: "today" };
    return {
      label: t("words.dueInDays", { n: days }),
      state: days <= 3 ? "near" : "far",
    };
  }

  // Открываем список с начала: при переключении вкладок сверху не остаёмся
  // прокрученными в середину нового (другого по длине) списка.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const sel = useWordSelection();
  // Второй набор состояний — у разбора созревших свой список и своя панель.
  // Режимы взаимоисключающие: вход в каждый показывается, только когда другой
  // выключен, поэтому смешаться они не могут.
  const promote = useWordSelection();

  function handleConfirmDelete() {
    onDelete(Array.from(sel.selected));
    sel.cancel();
  }

  // Вход в разбор: сразу отмечаем всё созревшее — человек пришёл сюда именно
  // за этим, а снять лишнее проще, чем отметить всё вручную.
  function enterPromote() {
    promote.enter();
    promote.setAll(matureWords);
  }

  function handleConfirmPromote() {
    const chosen = Array.from(promote.selected);
    const chosenSet = new Set(chosen);
    // Оставленные — это ответ «пока оставить», такой же, как в чек-пойнте.
    const kept = matureWords.filter((w) => !chosenSet.has(w));
    onPromoteMature?.(chosen, kept);
    promote.cancel();
  }

  // Оба режима отмечают слова галочками, но списки и панели у них разные.
  // Активный набор выбираем один раз — дальше строка списка про режимы не знает.
  const picking = sel.selectMode || promote.selectMode;
  const activeSel = promote.selectMode ? promote : sel;
  const matureSet = new Set(matureWords);
  const visibleItems = promote.selectMode
    ? items.filter((i) => matureSet.has(i.word))
    : items;
  const allMatureChecked =
    matureWords.length > 0 && promote.selected.size >= matureWords.length;

  // Полоса разбора созревших: вход, а в самом разборе — «отметить/снять все».
  // Когда созревших нет, спокойно объясняем почему: перенести раньше времени —
  // значит тихо забыть слово, и это нормальное состояние, а не отставание.
  const promoteStrip =
    items.length > 0 && !sel.selectMode ? (
      <div className="mywords__promote">
        {promote.selectMode ? (
          <div className="mywords__promote-row">
            <p className="mywords__promote-title">
              {t("promote.pickTitle", { n: matureWords.length })}
            </p>
            <button
              type="button"
              className="mywords__promote-toggle"
              onClick={() =>
                allMatureChecked ? promote.clear() : promote.setAll(matureWords)
              }
            >
              {t(allMatureChecked ? "promote.clearAll" : "promote.selectAll")}
            </button>
          </div>
        ) : matureWords.length > 0 ? (
          <>
            <div className="mywords__promote-text">
              <p className="mywords__promote-title">
                {t("promote.readyTitle", { n: matureWords.length })}
              </p>
              <p className="mywords__promote-hint">{t("promote.readyHint")}</p>
            </div>
            <button
              type="button"
              className="mywords__promote-entry"
              onClick={enterPromote}
            >
              {t("promote.entry")}
            </button>
          </>
        ) : (
          <p className="mywords__promote-none">{t("promote.none")}</p>
        )}
      </div>
    ) : null;

  return (
    <section className="mywords">
      <div className="mywords__top">
        <header className="mywords__header">
          <button
            type="button"
            className="mywords__back"
            onClick={onBack}
            aria-label={t("common.back")}
          >
            ←
          </button>
          <h1 className="mywords__title">{t("words.mineTitle")}</h1>
          {items.length > 0 && !picking && (
            <button
              type="button"
              className="mywords__select"
              onClick={sel.enter}
            >
              {t("words.select")}
            </button>
          )}
        </header>

        <WordListTabs
          active="mine"
          takenCount={items.length}
          knownCount={knownCount}
          onOpenKnown={onOpenKnown}
        />
      </div>

      {onPromoteMature && promoteStrip}

      {items.length === 0 ? (
        <div className="mywords__empty">
          <div className="mywords__empty-icon" aria-hidden="true">
            📭
          </div>
          <p className="mywords__empty-title">{t("words.emptyTitle")}</p>
          <p className="mywords__empty-text">{t("words.mineEmpty")}</p>
        </div>
      ) : (
        <ul className="mywords__list">
          {visibleItems.map((item) => {
            const checked = activeSel.selected.has(item.word);
            return (
              <li
                key={item.word}
                className={
                  "mywords__item" +
                  (picking ? " mywords__item--selectable" : "") +
                  (checked ? " is-selected" : "")
                }
                onClick={
                  picking ? () => activeSel.toggle(item.word) : undefined
                }
              >
                <div className="mywords__item-row">
                  {picking && (
                    <span
                      className={
                        "mywords__checkbox" + (checked ? " is-checked" : "")
                      }
                      aria-hidden="true"
                    >
                      {checked ? "✓" : ""}
                    </span>
                  )}
                  <div className="mywords__item-text">
                    <span className="mywords__word" lang={learnLang}>
                      {item.word}
                    </span>
                    {item.translit && (
                      <span className="mywords__translit">
                        {item.translit}
                      </span>
                    )}
                    {item.translation && (
                      <span className="mywords__translation">
                        {item.translation}
                      </span>
                    )}
                  </div>
                  {/* Срок следующего повтора виден и в разборе созревших: по
                      нему человек и решает, правда ли слово улеглось. Скрыт он
                      только в режиме удаления — там решение о другом. */}
                  {!sel.selectMode &&
                    (() => {
                      const due = dueInfo(item.word);
                      return due ? (
                        <span
                          className={`mywords__due mywords__due--${due.state}`}
                        >
                          {due.label}
                        </span>
                      ) : null;
                    })()}
                  {!picking && (
                    <PlayButton
                      text={item.word}
                      learnLang={learnLang}
                      kind="word"
                      appearance="ember"
                    />
                  )}
                  {!picking && (
                    <button
                      type="button"
                      className="mywords__learned"
                      onClick={() => onMarkKnown(item.word)}
                    >
                      {t("words.learned")}
                    </button>
                  )}
                </div>

                {/* В разборе созревших примеры не показываем: список должен
                    просматриваться целиком, а не пролистываться экранами. */}
                {!promote.selectMode && item.example && (
                  <div className="mywords__example">
                    <div className="mywords__example-row">
                      <p className="mywords__example-text" lang={learnLang}>
                        {item.example}
                      </p>
                      {!sel.selectMode && (
                        <PlayButton
                          text={item.example}
                          learnLang={learnLang}
                          kind="example"
                          appearance="ember"
                        />
                      )}
                    </div>
                    {item.exampleTranslation && (
                      <p
                        className="mywords__example-translation"
                        lang={nativeLang}
                      >
                        {item.exampleTranslation}
                      </p>
                    )}
                  </div>
                )}

                {/* Глаголы: таблица форм по запросу. Признак тот же, что у
                    карточки (pos === "verb"); у слов без pos — старых записей и
                    не-глаголов — панели нет. В режиме выбора не показываем:
                    там строка целиком работает как чекбокс. */}
                {!picking && item.pos === "verb" && (
                  <ConjugationPanel
                    word={item.word}
                    // Подсвечиваем в таблице ту форму, под которой слово
                    // сохранено, — как на карточке подсвечивается тапнутая.
                    form={item.word}
                    learnLang={learnLang}
                    nativeLang={nativeLang}
                    variant="mywords"
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}

      {sel.selectMode && (
        <SelectBar
          count={sel.selected.size}
          confirmOpen={sel.confirmOpen}
          onCancel={sel.cancel}
          onRequestDelete={sel.openConfirm}
          onConfirmDelete={handleConfirmDelete}
          onCloseConfirm={sel.closeConfirm}
        />
      )}

      {promote.selectMode && (
        <PromoteBar
          count={promote.selected.size}
          confirmOpen={promote.confirmOpen}
          onCancel={promote.cancel}
          onRequestPromote={promote.openConfirm}
          onConfirmPromote={handleConfirmPromote}
          onCloseConfirm={promote.closeConfirm}
        />
      )}
    </section>
  );
}
