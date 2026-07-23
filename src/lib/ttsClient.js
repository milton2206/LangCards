// Клиент озвучки (фаза 5.1). Сервер (/api/tts) держит ключи и общий кэш в
// Supabase Storage; здесь — только URL-ы. Повторный запрос того же текста
// мгновенный: URL кэшируется в памяти, а сам mp3 — браузером (обычный статик).
//
// Фолбэки: нет сети / сервер не настроен / текст слишком длинный → null,
// кнопка play становится неактивной, карточки продолжают работать.

// Совпадает с серверным MAX_TTS_TEXT_LEN — не гоняем заведомо неудачные запросы.
export const MAX_TTS_TEXT_LEN = 300;

const urlCache = new Map(); // "lang|text" → url

export async function fetchTtsUrl({ text, learnLang }) {
  const clean = String(text ?? "").trim();
  if (!clean || !learnLang || clean.length > MAX_TTS_TEXT_LEN) return null;

  const key = `${learnLang}|${clean}`;
  if (urlCache.has(key)) return urlCache.get(key);

  try {
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, learnLang }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (data && data.url) {
      urlCache.set(key, data.url);
      return data.url;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Фоновый прогрев озвучки в момент создания карточек: слово + пример каждой.
 * Последовательно и без ожидания результата — кнопка play к моменту тапа уже
 * не ждёт генерацию. Ошибки глотаем: прогрев — оптимизация, не обязанность.
 */
export function prewarmTts(cards, learnLang) {
  if (!Array.isArray(cards) || cards.length === 0 || !learnLang) return;
  (async () => {
    for (const card of cards) {
      if (card?.word) await fetchTtsUrl({ text: card.word, learnLang });
      if (card?.example) await fetchTtsUrl({ text: card.example, learnLang });
    }
  })().catch(() => {
    // тихо: прогрев не должен ничего ломать
  });
}
