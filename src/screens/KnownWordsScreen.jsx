import { useEffect, useState } from "react";
import { MAX_ACTIVE_WORDS } from "../hooks/useWordLists.js";
import { useWordSelection } from "../hooks/useWordSelection.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import SelectBar from "../components/SelectBar.jsx";
import WordListTabs from "../components/WordListTabs.jsx";
import WordRow from "../components/WordRow.jsx";
import Icon from "../components/icons/Icon.jsx";
import "./MyWordsScreen.css";

/**
 * Список известных слов (knownWords, отмеченных «Знаю»).
 * У каждого — кнопка «Вернуть»: слово уходит из известных обратно в изучение.
 * Оформление — по образцу экрана «Мои слова». Полные данные (перевод,
 * транскрипция, пример) — из wordInfo.
 *
 * Режим выбора («Выбрать») позволяет отметить слова чекбоксами и удалить
 * их совсем (из списков и хранилища) с подтверждением.
 *
 * Строка — тот же общий WordRow, что и в «На изучении»: свёрнуто слово с
 * переводом и «Вернуть», а транскрипция, пример и таблица спряжения (у глаголов)
 * открываются стрелкой справа. Отличия только в наполнении: здесь нет метки
 * срока повторения и озвучки — списку известных слов они не нужны.
 */
export default function KnownWordsScreen({
  knownWords,
  takenCount,
  wordInfo,
  learnLang,
  nativeLang,
  onRestore,
  onDelete,
  onBack,
  onOpenMyWords,
  onOpenKnownReview,
  // Мест под активные слова нет — «Вернуть» недоступно (та же проверка, что и
  // на карточке: слово из известных занимает такой же слот).
  atLimit = false,
}) {
  const { t } = useI18n();
  const items = knownWords.map((word) => ({
    word,
    ...wordInfo[word],
  }));

  // Открываем список с начала: при переключении вкладок сверху не остаёмся
  // прокрученными в середину нового (другого по длине) списка.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Мягкое сообщение, если «Вернуть» упирается в лимит активных слов.
  const [limitNotice, setLimitNotice] = useState(false);
  useEffect(() => {
    if (!limitNotice) return;
    const timer = setTimeout(() => setLimitNotice(false), 4000);
    return () => clearTimeout(timer);
  }, [limitNotice]);

  function handleRestore(word) {
    const ok = onRestore(word);
    if (!ok) setLimitNotice(true);
  }

  const sel = useWordSelection();

  function handleConfirmDelete() {
    onDelete(Array.from(sel.selected));
    sel.cancel();
  }

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
          <h1 className="mywords__title">{t("words.knownTitle")}</h1>
          {items.length > 0 && !sel.selectMode && (
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
          active="known"
          takenCount={takenCount}
          knownCount={items.length}
          onOpenMyWords={onOpenMyWords}
        />

        {/* Повтор известных (идея Димы Еремы): необязательная самопроверка по
            желанию — никакого расписания, только когда пользователь сам хочет. */}
        {items.length > 0 && !sel.selectMode && (
          <button
            type="button"
            className="mywords__review-known"
            onClick={onOpenKnownReview}
          >
            <Icon name="review" size={18} className="mywords__review-icon" />
            {t("knownReview.entry")}
          </button>
        )}

        {/* При полном лимите объясняем ПОСТОЯННО, а не по тапу: кнопки «Вернуть»
            неактивны, и без строки было бы непонятно почему. */}
        {(limitNotice || atLimit) && (
          <p className="mywords__limit-notice" role="status">
            {t("common.activeLimit", { max: MAX_ACTIVE_WORDS })}
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="mywords__empty">
          <div className="mywords__empty-icon" aria-hidden="true">
            🧠
          </div>
          <p className="mywords__empty-title">{t("words.emptyTitle")}</p>
          <p className="mywords__empty-text">{t("words.knownEmpty")}</p>
        </div>
      ) : (
        <ul className="mywords__list">
          {items.map((item) => (
            <WordRow
              key={item.word}
              item={item}
              learnLang={learnLang}
              nativeLang={nativeLang}
              picking={sel.selectMode}
              checked={sel.selected.has(item.word)}
              onToggle={() => sel.toggle(item.word)}
              action={{
                label: t("words.restore"),
                className: "mywords__restore",
                onClick: () => handleRestore(item.word),
                disabled: atLimit,
              }}
            />
          ))}
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
    </section>
  );
}
