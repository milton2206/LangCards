// Клиент озвучки (фаза 5.1). Сервер (/api/tts) держит ключи и общий кэш в
// Supabase Storage; здесь — только URL-ы. Повторный запрос того же текста
// мгновенный: URL кэшируется в памяти, а сам mp3 — браузером (обычный статик).
//
// Фолбэки: нет сети / сервер не настроен / текст слишком длинный → null,
// кнопка play становится неактивной, карточки продолжают работать.

// Совпадает с серверным MAX_TTS_TEXT_LEN — не гоняем заведомо неудачные запросы.
import { apiFetch } from "./apiClient.js";

export const MAX_TTS_TEXT_LEN = 300;

// Обычная скорость (совпадает с DEFAULT_TTS_RATE на сервере): карточки и режим
// чтения ничего про скорость не знают и продолжают ходить за тем же аудио.
const DEFAULT_RATE = 1;

const urlCache = new Map(); // "lang|rate|text" → url

// ---------- Единый «активный» звук на всё приложение ----------
// Играть должно только что-то одно: простая кнопка озвучки слова (playUrl) и
// плеер длинного аудио (AudioPlayer) делят одну «шину». При старте любого
// источника предыдущий глушится. Держим функцию остановки текущего владельца.
let activeStop = null;

/** Забрать звук себе: остановить предыдущего владельца, стать текущим. */
export function claimAudio(stop) {
  if (activeStop && activeStop !== stop) {
    try {
      activeStop();
    } catch {
      // остановка предыдущего звука не должна ничего ронять
    }
  }
  activeStop = stop;
}

/** Освободить шину, если владелец — мы (при паузе/размонтировании плеера). */
export function releaseAudio(stop) {
  if (activeStop === stop) activeStop = null;
}

/** Глушит текущий звук (слово ИЛИ плеер) — вызывается при уходе с экрана. */
export function stopCurrentAudio() {
  if (activeStop) {
    try {
      activeStop();
    } catch {
      // тихо
    }
    activeStop = null;
  }
}

/**
 * Создаёт и возвращает <audio> для url, остановив предыдущий звук (простая
 * озвучка слова/примера — карточки, лупа слова в чтении). Плеер длинного аудио
 * этим НЕ пользуется, но делит ту же шину через claimAudio.
 */
export function playUrl(url) {
  const audio = new Audio(url);
  claimAudio(() => audio.pause());
  return audio;
}

export async function fetchTtsUrl({ text, learnLang, rate = DEFAULT_RATE }) {
  const clean = String(text ?? "").trim();
  if (!clean || !learnLang || clean.length > MAX_TTS_TEXT_LEN) return null;

  // Скорость — часть ключа: на сервере это отдельная запись в кэше (фаза 6.2).
  const key = `${learnLang}|${rate}|${clean}`;
  if (urlCache.has(key)) return urlCache.get(key);

  try {
    const res = await apiFetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, learnLang, rate }),
    });
    // Озвучка не критична: любой не-ok (в т.ч. 429-лимит) → null, кнопка play
    // просто становится неактивной, карточки продолжают работать.
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

/**
 * Прогрев набора фраз на конкретной скорости (фаза 6.2, аудирование): пока
 * пользователь слушает первую фразу, остальные уже готовятся. Тот же принцип,
 * что и prewarmTts: последовательно, без ожидания, ошибки глотаем.
 */
export function prewarmPhrases(texts, learnLang, rate = DEFAULT_RATE) {
  if (!Array.isArray(texts) || texts.length === 0 || !learnLang) return;
  (async () => {
    for (const text of texts) {
      if (text) await fetchTtsUrl({ text, learnLang, rate });
    }
  })().catch(() => {
    // тихо: прогрев не обязателен
  });
}
