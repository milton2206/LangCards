import { apiFetch, makeApiError } from "./apiClient.js";

// Запрос на генерацию ОДНОЙ карточки по слову, введённому пользователем вручную.
// Использует тот же серверный эндпоинт /api/cards (флаг manual: true), поэтому
// ключ Claude API остаётся на сервере. Возвращает готовую карточку стандартного
// формата или бросает Error с .code — для локализованного сообщения в UI:
//   "offline"       — нет соединения с сервером;
//   "notRecognized" — ИИ не распознал слово (вернул пустой ответ);
//   "rateLimit"/"rateCooldown"/"sessionExpired" — лимит/сессия (фаза 7.1);
//   "server"        — иная ошибка сервера (.raw — текст ответа сервера, если есть).
export async function requestManualCard({ learnLang, nativeLang, word }) {
  let res;
  try {
    res = await apiFetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        learnLang,
        nativeLang,
        word: String(word).trim(),
        manual: true,
        count: 1,
      }),
    });
  } catch {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }

  if (!res.ok) {
    throw await makeApiError(res);
  }

  const data = await res.json();
  const card = Array.isArray(data && data.cards) ? data.cards[0] : null;
  if (!card || !card.word) {
    const err = new Error("notRecognized");
    err.code = "notRecognized";
    throw err;
  }
  return card;
}

/**
 * Карточки СРАЗУ НА НЕСКОЛЬКО слов — прогрев переводов для показанного текста
 * (см. lookupWarm.js). Тот же эндпоинт и тот же формат карточки, что у ручного
 * ввода: один вызов на текст вместо отдельного вызова на каждый тап.
 *
 * Ошибки НЕ разбираем по кодам: прогрев фоновый и молча ничего не делает при
 * любой неудаче — тап тогда сработает как раньше, через модель.
 */
export async function requestLookupCards({ learnLang, nativeLang, words }) {
  const list = (words || []).map((w) => String(w).trim()).filter(Boolean);
  if (list.length === 0) return [];

  const res = await apiFetch("/api/cards", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      learnLang,
      nativeLang,
      words: list,
      lookup: true,
      count: list.length,
    }),
  });
  if (!res.ok) throw await makeApiError(res);

  const data = await res.json();
  return Array.isArray(data && data.cards) ? data.cards : [];
}
