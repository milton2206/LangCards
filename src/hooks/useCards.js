import { useState, useEffect, useCallback } from "react";

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

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  }, [store]);

  // При смене пары сбрасываем транзиентные загрузку/ошибку.
  useEffect(() => {
    setLoading(false);
    setError(null);
  }, [pairKey]);

  const cards = store[pairKey] || EMPTY;

  // Запрашивает новую порцию и заменяет текущую для этой пары.
  // Ошибку возвращаем структурой { code, params?, raw? } — текст локализуется в
  // UI (CardScreen). raw — это сообщение сервера (уже на языке сервера).
  const generate = useCallback(
    async (params) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/cards", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        if (!res.ok) {
          let serverMsg = null;
          try {
            const data = await res.json();
            if (data && data.error) serverMsg = data.error;
          } catch {
            // тело не JSON — покажем общий текст по статусу
          }
          setError(
            serverMsg
              ? { raw: serverMsg }
              : { code: "server", params: { status: res.status } },
          );
          return;
        }

        const data = await res.json();
        const batch = Array.isArray(data) ? data : data.cards;
        if (!Array.isArray(batch) || batch.length === 0) {
          setError({ code: "noCards" });
          return;
        }
        setStore((prev) => ({ ...prev, [pairKey]: batch }));
      } catch (e) {
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

  return { cards, loading, error, generate, clearError };
}
