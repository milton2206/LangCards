import { useState, useEffect, useMemo, useRef } from "react";
import {
  fetchPlacementBank,
  groupByLevel,
} from "../lib/placementClient.js";
import {
  PLACEMENT_LEVELS,
  START_LEVEL_INDEX,
  nextLevelIndex,
  shouldStop,
  MAX_ITEMS,
  estimateLevel,
  pickItem,
} from "../lib/placementAlgorithm.js";
import { LANG_EMOJI } from "../data/onboarding.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./PlacementScreen.css";

/**
 * Тест на определение уровня (фаза 6.3). Заменяет самооценку в онбординге —
 * но не отменяет её: тест необязателен, а его результат всегда можно поправить
 * вручную на финальном экране.
 *
 * Задания берутся из ОБЩЕГО банка (placement_items) — под пользователя ничего
 * не генерируется. Адаптивность и подсчёт живут в placementAlgorithm.js, здесь
 * только состояние прохождения и экран.
 *
 * Без сети тест недоступен — карточки, повторение и настройки работают.
 */
export default function PlacementScreen({
  learnLang,
  nativeLang,
  onApply,
  onCancel,
}) {
  const { t } = useI18n();

  const [bank, setBank] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Текущее задание и история ответов: [{ levelIndex, correct }].
  const [item, setItem] = useState(null);
  const [history, setHistory] = useState([]);
  const [finished, setFinished] = useState(false);
  // Ручная правка результата на финальном экране.
  const [manualOpen, setManualOpen] = useState(false);
  const [manualLevel, setManualLevel] = useState(null);

  // Показанные задания не повторяем в рамках одного прохождения.
  const usedIds = useRef(new Set());

  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );
  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Загрузка банка: кэш устройства → общая таблица → (если пуст) разовая
  // генерация на сервере. Повторный тест сюда обычно даже не доходит.
  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const items = await fetchPlacementBank(learnLang);
        if (!active) return;
        const byLevel = groupByLevel(items);
        setBank(byLevel);
        usedIds.current = new Set();
        setHistory([]);
        setFinished(false);
        setItem(pickItem(byLevel, START_LEVEL_INDEX, usedIds.current));
      } catch (err) {
        if (!active) return;
        setError(errorText(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnLang]);

  function errorText(err) {
    if (err.code === "offline") return t("placement.offline");
    if (err.code === "missing-table") return t("placement.noTable");
    if (err.code === "not-configured") return t("placement.noAccount");
    if (err.code === "empty") return t("placement.empty");
    return err.raw || t("placement.failed");
  }

  const result = useMemo(
    () => (finished ? estimateLevel(history) : null),
    [finished, history],
  );

  function handleAnswer(option) {
    if (!item) return;
    const correct = option === item.correctAnswer;
    const nextHistory = [...history, { levelIndex: item.levelIndex, correct }];
    usedIds.current.add(item.id);
    setHistory(nextHistory);

    if (shouldStop(nextHistory)) {
      setItem(null);
      setFinished(true);
      return;
    }

    const target = nextLevelIndex(item.levelIndex, correct);
    const next = pickItem(bank, target, usedIds.current);
    if (!next) {
      // Банк неожиданно кончился — честно заканчиваем на том, что есть.
      setItem(null);
      setFinished(true);
      return;
    }
    setItem(next);
  }

  // Знаменатель прогресса — всегда максимум теста. Показывать «из 15», а потом
  // переобуться на 18, нельзя: полоса поехала бы назад. Устоявшаяся лестница
  // просто заканчивает тест раньше, чем полоса дойдёт до конца.
  const total = MAX_ITEMS;
  const current = history.length + 1;

  // ---------- Состояния экрана ----------
  const header = (
    <header className="placement__header">
      <button
        type="button"
        className="placement__back"
        onClick={onCancel}
        aria-label={t("common.back")}
      >
        ←
      </button>
      <h1 className="placement__title">{t("placement.title")}</h1>
      <span className="placement__lang" aria-hidden="true">
        {LANG_EMOJI[learnLang] || "🌐"}
      </span>
    </header>
  );

  if (offline || error) {
    return (
      <section className="placement">
        {header}
        <div className="placement__center">
          <div className="placement__emoji" aria-hidden="true">
            📡
          </div>
          <p className="placement__notice">
            {offline ? t("placement.offline") : error}
          </p>
          <button
            type="button"
            className="placement__ghost"
            onClick={onCancel}
          >
            {t("placement.chooseManually")}
          </button>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <section className="placement">
        {header}
        <div className="placement__center">
          <span className="placement__spinner" aria-hidden="true" />
          <p className="placement__notice">{t("placement.preparing")}</p>
          <p className="placement__hint">{t("placement.preparingHint")}</p>
        </div>
      </section>
    );
  }

  // ---------- Финал: результат + возможность поправить ----------
  if (finished && result) {
    const suggested = manualLevel || result.levelId;
    return (
      <section className="placement">
        {header}
        <div className="placement__center">
          <div className="placement__emoji" aria-hidden="true">
            🎯
          </div>
          <h2 className="placement__result">
            {t("placement.resultTitle", {
              level: result.levelId.toUpperCase(),
            })}
          </h2>
          <p className="placement__hint">
            {t("placement.resultHint", {
              n: result.correctCount,
              total: history.length,
            })}
          </p>

          {manualOpen && (
            <div className="placement__manual">
              <p className="placement__manual-title">
                {t("placement.manualTitle")}
              </p>
              <div className="placement__manual-chips">
                {PLACEMENT_LEVELS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className={
                      "placement__manual-chip" +
                      (suggested === id ? " is-active" : "")
                    }
                    aria-pressed={suggested === id}
                    onClick={() => setManualLevel(id)}
                  >
                    {id.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="placement__actions">
            <button
              type="button"
              className="placement__primary"
              onClick={() => onApply(suggested)}
            >
              {t("placement.startWith", { level: suggested.toUpperCase() })}
            </button>
            {!manualOpen && (
              <button
                type="button"
                className="placement__ghost"
                onClick={() => {
                  setManualLevel(result.levelId);
                  setManualOpen(true);
                }}
              >
                {t("placement.chooseOther")}
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }

  // ---------- Прохождение: одно задание на экране, без таймера ----------
  return (
    <section className="placement">
      {header}

      <div className="placement__progress">
        <div className="placement__progress-bar" aria-hidden="true">
          <span
            className="placement__progress-fill"
            style={{ width: `${(history.length / total) * 100}%` }}
          />
        </div>
        <span className="placement__progress-label">
          {t("placement.progress", { n: current, total })}
        </span>
      </div>

      {item && (
        <div className="placement__question">
          {/* Что делать — на родном языке; сам материал — на изучаемом. */}
          <p className="placement__prompt">
            {item.type === "cloze"
              ? t("placement.promptCloze")
              : t("placement.promptVocab")}
          </p>
          <p className="placement__text" lang={learnLang}>
            {item.question}
          </p>

          <div className="placement__options">
            {item.options.map((option, i) => (
              <button
                key={i}
                type="button"
                className="placement__option"
                lang={learnLang}
                onClick={() => handleAnswer(option)}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Не знаю — тоже ответ: засчитывается как ошибка, но человек не
              вынужден гадать и застревать на задании. */}
          <button
            type="button"
            className="placement__skip"
            onClick={() => handleAnswer(null)}
          >
            {t("placement.dontKnow")}
          </button>
        </div>
      )}

      <p className="placement__footnote" lang={nativeLang}>
        {t("placement.noTimer")}
      </p>
    </section>
  );
}
