import { useState, useEffect, useCallback } from "react";

// Порция карточек хранится в localStorage: при возврате на экран и после
// перезагрузки показывается та же порция (позиция задаётся списками
// taken/known/skipped, которые тоже персистятся).
const KEY = "cardsBatch";

function loadBatch() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Управляет текущей порцией карточек. Генерация происходит ТОЛЬКО по явному
 * вызову generate() — автоматически ничего не запрашивается.
 */
export function useCards() {
  const [cards, setCards] = useState(loadBatch);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(cards));
  }, [cards]);

  // Запрашивает полностью новую порцию и заменяет текущую.
  const generate = useCallback(async (params) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!res.ok) {
        let message = `Ошибка сервера (${res.status})`;
        try {
          const data = await res.json();
          if (data && data.error) message = data.error;
        } catch {
          // тело не JSON — оставляем общее сообщение
        }
        throw new Error(message);
      }

      const data = await res.json();
      const batch = Array.isArray(data) ? data : data.cards;
      if (!Array.isArray(batch) || batch.length === 0) {
        throw new Error("Сервер не вернул карточек. Попробуйте ещё раз.");
      }
      setCards(batch); // заменяем порцию; старую при ошибке НЕ трогаем
    } catch (e) {
      setError(
        e.message === "Failed to fetch"
          ? "Нет соединения с сервером. Проверьте интернет и попробуйте снова."
          : e.message || "Не удалось сгенерировать карточки.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { cards, loading, error, generate, clearError };
}
