/**
 * Вкладки переключения между списками слов: «Мои слова» (в изучении) и
 * «Известные». Одна из них активна (текущий экран), вторая — переход. Живут в
 * закреплённой сверху шапке (см. .mywords__top), поэтому переключиться можно
 * из любой точки прокрутки, не докручивая длинный список до конца.
 *
 * active: "mine" | "known".
 */
import { useI18n } from "../i18n/I18nContext.jsx";

export default function WordListTabs({
  active,
  takenCount,
  knownCount,
  onOpenMyWords,
  onOpenKnown,
}) {
  const { t } = useI18n();
  return (
    <div className="wordtabs" role="tablist" aria-label={t("words.mineTitle")}>
      <button
        type="button"
        role="tab"
        aria-selected={active === "mine"}
        className={"wordtabs__tab" + (active === "mine" ? " is-active" : "")}
        onClick={active === "mine" ? undefined : onOpenMyWords}
      >
        {t("tabs.mine")}
        <span className="wordtabs__count">{takenCount}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === "known"}
        className={"wordtabs__tab" + (active === "known" ? " is-active" : "")}
        onClick={active === "known" ? undefined : onOpenKnown}
      >
        {t("tabs.known")}
        <span className="wordtabs__count">{knownCount}</span>
      </button>
    </div>
  );
}
