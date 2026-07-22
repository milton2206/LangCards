// Запрос на генерацию ОДНОЙ карточки по слову, введённому пользователем вручную.
// Использует тот же серверный эндпоинт /api/cards (флаг manual: true), поэтому
// ключ Claude API остаётся на сервере. Возвращает готовую карточку стандартного
// формата или бросает Error с .code — для локализованного сообщения в UI:
//   "offline"       — нет соединения с сервером;
//   "notRecognized" — ИИ не распознал слово (вернул пустой ответ);
//   "server"        — иная ошибка сервера (.raw — текст ответа сервера, если есть).
export async function requestManualCard({ learnLang, nativeLang, word }) {
  let res;
  try {
    res = await fetch("/api/cards", {
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
    let serverMsg = null;
    try {
      const data = await res.json();
      if (data && data.error) serverMsg = data.error;
    } catch {
      // тело не JSON — покажем общий текст
    }
    const err = new Error(serverMsg || "server");
    err.code = "server";
    err.raw = serverMsg || null;
    throw err;
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
