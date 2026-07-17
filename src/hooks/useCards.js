import { useState, useCallback } from "react";

/**
 * Загружает порцию карточек с серверной функции /api/cards.
 * Кэширует порцию в состоянии — новые карточки не дёргают API на каждый показ,
 * запрос идёт только при первичной загрузке и по кнопке «Загрузить ещё».
 */
export function useCards() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async (params) => {
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
      setCards(batch);
    } catch (e) {
      setCards([]);
      setError(
        e.message === "Failed to fetch"
          ? "Нет соединения с сервером. Проверьте интернет и попробуйте снова."
          : e.message || "Не удалось загрузить карточки.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  return { cards, loading, error, load };
}
