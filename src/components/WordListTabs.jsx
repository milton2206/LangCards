/**
 * Вкладки переключения между списками слов: «Мои слова» (в изучении) и
 * «Известные». Одна из них активна (текущий экран), вторая — переход. Живут в
 * закреплённой сверху шапке (см. .mywords__top), поэтому переключиться можно
 * из любой точки прокрутки, не докручивая длинный список до конца.
 *
 * active: "mine" | "known".
 */
export default function WordListTabs({
  active,
  takenCount,
  knownCount,
  onOpenMyWords,
  onOpenKnown,
}) {
  return (
    <div className="wordtabs" role="tablist" aria-label="Списки слов">
      <button
        type="button"
        role="tab"
        aria-selected={active === "mine"}
        className={"wordtabs__tab" + (active === "mine" ? " is-active" : "")}
        onClick={active === "mine" ? undefined : onOpenMyWords}
      >
        Мои слова
        <span className="wordtabs__count">{takenCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "known"}
        className={"wordtabs__tab" + (active === "known" ? " is-active" : "")}
        onClick={active === "known" ? undefined : onOpenKnown}
      >
        Известные
        <span className="wordtabs__count">{knownCount}</span>
      </button>
    </div>
  );
}
