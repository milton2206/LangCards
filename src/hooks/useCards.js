import { useState, useEffect, useCallback } from "react";
import { apiFetch, parseApiError } from "../lib/apiClient.js";

// Порция карточек хранится по языковым парам: { "de-ru": [...], "el-ru": [...] }.
// При переключении языка показывается порция только текущей пары.
const STORE_KEY = "cardsByPair";
const LEGACY_KEY = "cardsBatch"; // старый общий ключ — для миграции

// ЗАПАС. Сервер просит у модели больше, чем нужно отдать (часть пачки съедают
// исключения и проверки качества). Всё, что не поместилось в текущую порцию,
// не выбрасываем, а кладём сюда — и добираем из него в следующий раз, когда
// модель принесёт мало нового. Именно от этого «порция убывала»: 10, 5, 4, 2.
//
// Запас привязан не только к паре, но и к НАБОРУ ПАРАМЕТРОВ (тема, уровень,
// тип контента): карточки по «работе» уровня B1 нельзя подмешивать в порцию по
// «ресторану» A1. Не совпал набор — запас для этой генерации не используется.
const RESERVE_KEY = "cardsReserveByPair";
const RESERVE_MAX = 40; // потолок хранения, чтобы localStorage не пух

// Подпись набора параметров: карточки из запаса годятся только под такой же.
// «Удиви меня» (random) в запас не идёт вовсе — там тема и уровень случайны.
function reserveTag(params) {
  return params?.random
    ? null
    : [params?.topic || "", params?.level || "", params?.mode || "words"].join("|");
}

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
        const fresh = Array.isArray(data) ? data : data.cards;
        if (!Array.isArray(fresh) || fresh.length === 0) {
          // eslint-disable-next-line no-console
          console.warn("[cards] сервер вернул пустую пачку (HTTP 200)");
          setError({ code: "noCards" });
          return;
        }

        // Сколько РЕАЛЬНО просили (params.count уже ужат дневной нормой в
        // buildParams) — от этого числа считается и порция, и недобор.
        const asked = Number(params.count) || fresh.length;
        const tag = reserveTag(params);

        // Запас прошлых генераций: годится только с той же подписью и только
        // то, чего нет в свежей пачке и что человек ещё не разобрал.
        const store = loadJSON(RESERVE_KEY, {});
        const saved = store[pairKey];
        const excluded = new Set((params.exclude || []).map((w) => String(w)));
        const freshWords = new Set(fresh.map((c) => c.word));
        const usableReserve =
          tag && saved?.tag === tag && Array.isArray(saved.cards)
            ? saved.cards.filter(
                (c) => c?.word && !freshWords.has(c.word) && !excluded.has(c.word),
              )
            : [];

        // Порция: свежие карточки, а если их меньше запрошенного — добираем из
        // запаса. Человек просил 20 и получает 20, даже когда модель принесла 9.
        const batch = fresh.slice(0, asked);
        const fromReserve = usableReserve.slice(0, Math.max(0, asked - batch.length));
        const finalBatch = [...batch, ...fromReserve];

        // Лишнее не выбрасываем: остаток свежих + неиспользованный запас.
        if (tag) {
          const rest = [
            ...fresh.slice(asked),
            ...usableReserve.slice(fromReserve.length),
          ].slice(0, RESERVE_MAX);
          const next = { ...store, [pairKey]: { tag, cards: rest } };
          try {
            localStorage.setItem(RESERVE_KEY, JSON.stringify(next));
          } catch {
            // переполнение хранилища — запас не критичен, молча пропускаем
          }
        }

        // Недобор — не молчаливая пропажа: экран честно скажет, сколько нашлось.
        // Считаем ПОСЛЕ добора из запаса: если запас закрыл разницу, недобора
        // для человека и не было.
        setShortfall(
          finalBatch.length < asked
            ? { got: finalBatch.length, asked }
            : null,
        );
        setStore((prev) => ({ ...prev, [pairKey]: finalBatch }));
        // Прогрева озвучки здесь БОЛЬШЕ НЕТ: греет экран карточек — окном
        // вокруг текущей карточки, по мере листания (см. CardScreen). Греть всю
        // пачку отсюда значило тратить общую суточную квоту на карточки, до
        // которых человек в этот заход не дойдёт; а два прогрева сразу (здесь и
        // на экране) успевали запросить один и тот же текст дважды, пока первый
        // ответ ещё не вернулся, — и это списывало квоту дважды.
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
