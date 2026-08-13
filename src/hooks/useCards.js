import { useState, useEffect, useCallback } from "react";
import { prewarmTts } from "../lib/ttsClient.js";
import { apiFetch, parseApiError } from "../lib/apiClient.js";

// Порция карточек хранится по языковым парам: { "de-ru": [...], "el-ru": [...] }.
// При переключении языка показывается порция только текущей пары.
const STORE_KEY = "cardsByPair";
const LEGACY_KEY = "cardsBatch"; // старый общий ключ — для миграции

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function loadStore() {
  const existing = loadJSON(STORE_KEY, null);
  if (existing) return existing;

  // Миграция старой общей порции к текущей паре (иначе de-ru).
  const legacy = loadJSON(LEGACY_KEY, []);
  if (Array.isArray(legacy) && legacy.length) {
    const settings = loadJSON("settings", {});
    const key =
      settings.learnLang && settings.nativeLang
        ? `${settings.learnLang}-${settings.nativeLang}`
        : "de-ru";
    const store = { [key]: legacy };
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(store));
      localStorage.removeItem(LEGACY_KEY);
    } catch {
      // ignore
    }
    return store;
  }
  return {};
}

const EMPTY = [];

/**
 * Управляет текущей порцией карточек для конкретной языковой пары (pairKey).
 * Генерация — только по явному вызову generate().
 */
export function useCards(pairKey) {
  const [store, setStore] = useState(loadStore);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  // Пачка пришла меньше запрошенной: { got, asked }. Не ошибка — пояснение к
  // ТЕКУЩЕЙ пачке, поэтому живёт рядом с ней и гаснет при новой генерации.
  const [shortfall, setShortfall] = useState(null);

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }, [store]);

  // При смене пары сбрасываем транзиентные загрузку/ошибку/пометку недобора.
  useEffect(() => {
    setLoading(false);
    setError(null);
    setShortfall(null);
  }, [pairKey]);

  const cards = store[pairKey] || EMPTY;

  // Запрашивает новую порцию и заменяет текущую для этой пары.
  // Ошибку возвращаем структурой { code, params?, raw? } — текст локализуется в
  // UI (CardScreen). raw — это сообщение сервера (уже на языке сервера).
  const generate = useCallback(
    async (params) => {
      setLoading(true);
      setError(null);
      setShortfall(null);
      try {
        const res = await apiFetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          // Лимит/сессия/ошибка сервера → структура { code?, params?, raw? };
          // CardScreen сам локализует по code (или покажет raw).
          const info = await parseApiError(res);
          // Статус в консоль: по экрану таймаут (504) и сбой модели (502)
          // выглядят одинаково, и без этой строки диагностика шла вслепую.
          // eslint-disable-next-line no-console
          console.warn(
            `[cards] генерация не удалась: HTTP ${res.status}, code=${info.code ?? "—"}`,
            info.raw || "",
          );
          setError(info);
          return;
        }

        const data = await res.json();
        const batch = Array.isArray(data) ? data : data.cards;
        if (!Array.isArray(batch) || batch.length === 0) {
          // eslint-disable-next-line no-console
          console.warn("[cards] сервер вернул пустую пачку (HTTP 200)");
          setError({ code: "noCards" });
          return;
        }
        // Недобор — не молчаливая пропажа: экран честно скажет, сколько нашлось.
        // Сравниваем с тем, что РЕАЛЬНО просили (params.count уже ужат дневной
        // нормой в buildParams), иначе сообщение врало бы про норму.
        const asked = Number(params.count) || batch.length;
        setShortfall(batch.length < asked ? { got: batch.length, asked } : null);
        setStore((prev) => ({ ...prev, [pairKey]: batch }));
        // Озвучка создаётся в момент создания карточек (фаза 5.1): фоновый
        // прогрев кэша, чтобы кнопка play не ждала генерацию при тапе.
        prewarmTts(batch, params.learnLang);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[cards] запрос генерации сорвался:", e?.message || e);
        setError(
          e.message === "Failed to fetch"
            ? { code: "offline" }
            : { code: "generateFailed" },
        );
      } finally {
        setLoading(false);
      }
    },
    [pairKey],
  );

  const clearError = useCallback(() => setError(null), []);

  return { cards, loading, error, shortfall, generate, clearError };
}
