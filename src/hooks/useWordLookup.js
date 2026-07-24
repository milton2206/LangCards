import { useState, useCallback } from "react";
import { requestManualCard } from "../lib/manualCard.js";
import { useI18n } from "../i18n/I18nContext.jsx";

/**
 * Просмотр слова по тапу: перевод/транскрипция/пример от ИИ + добавление в
 * изучение. Общая логика для примера на карточке (фаза 4) и для текста в
 * режиме чтения (фаза 6.1) — параллельной логики карточек не заводим:
 * карточку собирает существующий requestManualCard, а добавляет её в SRS
 * переданный onAdd (в App это handleAddManualCard → vocab.take +
 * rememberCards, вместе с лимитом MAX_ACTIVE_WORDS).
 *
 * lookup: { word, status, card?, errorText? }
 *   status: "loading" | "ready" | "error" | "added" | "limit"
 */
export function useWordLookup({ learnLang, nativeLang, onAdd }) {
  const { t } = useI18n();
  const [lookup, setLookup] = useState(null);

  const open = useCallback(
    async (word) => {
      setLookup({ word, status: "loading" });
      try {
        const card = await requestManualCard({ learnLang, nativeLang, word });
        // Не перетираем состояние, если шторку успели закрыть/сменить слово.
        setLookup((prev) =>
          prev && prev.word === word && prev.status === "loading"
            ? { word, status: "ready", card }
            : prev,
        );
      } catch (err) {
        const errorText =
          err.code === "notRecognized"
            ? t("addWord.notRecognized")
            : err.code === "offline"
              ? t("errors.offline")
              : err.raw || t("addWord.failed");
        setLookup((prev) =>
          prev && prev.word === word && prev.status === "loading"
            ? { word, status: "error", errorText }
            : prev,
        );
      }
    },
    [learnLang, nativeLang, t],
  );

  // Добавление в изучение: onAdd вернёт false при достижении лимита активных слов.
  // Важно: onAdd вызываем В ОБРАБОТЧИКЕ, а не внутри updater-а setLookup —
  // иначе он обновлял бы состояние App во время рендера (React ругается).
  const add = useCallback(() => {
    if (!lookup || !lookup.card) return;
    const ok = onAdd(lookup.card);
    setLookup((prev) =>
      prev ? { ...prev, status: ok ? "added" : "limit" } : prev,
    );
  }, [lookup, onAdd]);

  const close = useCallback(() => setLookup(null), []);

  return { lookup, open, add, close };
}
