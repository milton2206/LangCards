// Клиент озвучки (фаза 5.1). Сервер (/api/tts) держит ключи и общий кэш в
// Supabase Storage; здесь — только URL-ы. Повторный запрос того же текста
// мгновенный: URL кэшируется в памяти, а сам mp3 — браузером (обычный статик).
//
// Фолбэки: нет сети / сервер не настроен / текст слишком длинный → null,
// кнопка play становится неактивной, карточки продолжают работать.

// Совпадает с серверным MAX_TTS_TEXT_LEN — не гоняем заведомо неудачные запросы.
import { apiFetch, parseApiError } from "./apiClient.js";

export const MAX_TTS_TEXT_LEN = 300;

// Обычная скорость (совпадает с DEFAULT_TTS_RATE на сервере): карточки и режим
// чтения ничего про скорость не знают и продолжают ходить за тем же аудио.
const DEFAULT_RATE = 1;

const urlCache = new Map(); // "lang|rate|text" → url
// Запросы В ПУТИ по тому же ключу. Кэш URL наполняется только ПОСЛЕ ответа,
// поэтому без этого два одновременных запроса одного текста (быстрый свайп по
// карточкам, повторный тап, прогрев вдогонку) уходили на сервер оба — а промах
// общего кэша списывает квоту каждый раз. Теперь второй ждёт первый.
const inflight = new Map(); // "lang|rate|text" → Promise<{ url, reason? }>

// ---------- Суточная квота озвучки: одно состояние на всё приложение ----------
// Лимит считает СЕРВЕР (RATE_LIMITS.tts), и он общий на пользователя, а не на
// кнопку. Поэтому первый же ответ 429 запоминаем здесь: остальные кнопки гаснут
// сразу и не ходят на сервер за очередным отказом, а экран может спокойно
// сказать, что озвучка вернётся завтра. Раньше кнопка просто переставала
// работать без единого слова.
//
// Живёт до конца суток (UTC — как и серверный счётчик) или до перезагрузки.
let quotaExhaustedDay = null;
const quotaListeners = new Set();

function utcDayKey() {
  return new Date().toISOString().slice(0, 10);
}

/** Исчерпана ли суточная квота озвучки (по последнему ответу сервера). */
export function isTtsQuotaExhausted() {
  return quotaExhaustedDay === utcDayKey();
}

/** Подписка на смену этого состояния; возвращает функцию отписки. */
export function subscribeTtsQuota(listener) {
  quotaListeners.add(listener);
  return () => quotaListeners.delete(listener);
}

// Сервер ответил про лимит — запоминаем и будим подписчиков. Любой другой
// исход снимает флаг: значит, квота снова есть (например, наступили новые сутки).
function noteQuotaReason(reason) {
  const next = reason === "rateLimit" ? utcDayKey() : null;
  if (next === quotaExhaustedDay) return;
  quotaExhaustedDay = next;
  for (const listener of quotaListeners) {
    try {
      listener(isTtsQuotaExhausted());
    } catch {
      // подписчик не должен ломать озвучку
    }
  }
}

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
 *
 * ВАЖНО: шина освобождается САМА, чем бы ни закончилось воспроизведение —
 * конец, ошибка загрузки или пауза (в т.ч. когда звук перехватил другой плеер).
 * Раньше playUrl только занимал шину и не отпускал её никогда: activeStop
 * навсегда оставался закрытым на уже отыгравший <audio>, и состояние «занято»
 * жило до перезагрузки страницы.
 */
export function playUrl(url) {
  const audio = new Audio(url);
  const stop = () => {
    try {
      audio.pause();
    } catch {
      // элемент уже мёртв — ничего страшного
    }
  };
  claimAudio(stop);

  const free = () => releaseAudio(stop);
  audio.addEventListener("ended", free, { once: true });
  audio.addEventListener("error", free, { once: true });
  // pause прилетает и когда нас глушит другой плеер, и в конце дорожки:
  // releaseAudio снимает владение только если владелец — мы, так что безопасно.
  audio.addEventListener("pause", free);

  return audio;
}

/**
 * Забыть закэшированный URL озвучки. Нужен для ПОВТОРА при сбое загрузки: если
 * файл не проигрался (сеть моргнула или объект ещё не доехал в хранилище),
 * следующая попытка должна сходить на сервер заново, а не подсунуть тот же
 * битый URL из памяти.
 */
export function forgetTtsUrl({ text, learnLang, rate = DEFAULT_RATE }) {
  const clean = String(text ?? "").trim();
  if (!clean || !learnLang) return;
  urlCache.delete(`${learnLang}|${rate}|${clean}`);
}

/**
 * То же, что fetchTtsUrl, но с ПРИЧИНОЙ неудачи: { url } либо { url: null, reason }.
 *
 * Зачем отдельно: раньше любая неудача сворачивалась в null, и плеер показывал
 * одно «Нет аудио» — что бы ни случилось. Человеку это ничего не объясняет и не
 * подсказывает, поможет ли повтор. Причины (их различает плеер):
 *   offline      — нет сети или сервер недоступен;
 *   rateLimit    — суточный лимит озвучки исчерпан (RATE_LIMITS.tts). Считает и
 *                  решает СЕРВЕР — клиент только показывает его ответ;
 *   rateCooldown — слишком часто, надо подождать пару секунд;
 *   sessionExpired — сессия истекла;
 *   unavailable  — текст пустой или длиннее лимита (повтор не поможет);
 *   failed       — синтез не удался (ошибка сервера, пустой ответ).
 */
export async function fetchTtsUrlResult({
  text,
  learnLang,
  rate = DEFAULT_RATE,
}) {
  const clean = String(text ?? "").trim();
  if (!clean || !learnLang || clean.length > MAX_TTS_TEXT_LEN) {
    return { url: null, reason: "unavailable" };
  }

  // Скорость — часть ключа: на сервере это отдельная запись в кэше (фаза 6.2).
  const key = `${learnLang}|${rate}|${clean}`;
  if (urlCache.has(key)) return { url: urlCache.get(key) };

  // Заведомо офлайн — не ходим на сервер и сразу называем причину.
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { url: null, reason: "offline" };
  }

  // Тот же текст уже запрошен — ждём тот же ответ, второго запроса не шлём.
  const pending = inflight.get(key);
  if (pending) return pending;

  const request = requestTts(key, clean, learnLang, rate);
  inflight.set(key, request);
  try {
    return await request;
  } finally {
    inflight.delete(key);
  }
}

// Сам поход на сервер (вынесен, чтобы обёртка выше умела склеивать одинаковые
// запросы в один). Возвращает { url } либо { url: null, reason, params? }.
async function requestTts(key, clean, learnLang, rate) {
  try {
    const res = await apiFetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: clean, learnLang, rate }),
    });
    if (!res.ok) {
      const info = await parseApiError(res);
      const known = ["rateLimit", "rateCooldown", "sessionExpired"];
      const reason = known.includes(info.code) ? info.code : "failed";
      // Отказ по суточному лимиту касается ВСЕХ кнопок сразу — запоминаем.
      noteQuotaReason(reason);
      return { url: null, reason, params: info.params };
    }
    const data = await res.json();
    if (data && data.url) {
      urlCache.set(key, data.url);
      noteQuotaReason(null); // озвучка работает — снимаем флаг, если он был
      return { url: data.url };
    }
    // Ответ без ссылки — синтез не состоялся.
    return { url: null, reason: "failed" };
  } catch {
    // fetch не дошёл: сеть или сервер. Кэш не трогаем — повтор сходит заново.
    return { url: null, reason: "offline" };
  }
}

/**
 * URL озвучки или null. Прежний контракт: неудача любой природы — просто null
 * (кнопка play становится неактивной, карточки продолжают работать). Там, где
 * причина важна для UI, зовите fetchTtsUrlResult.
 */
export async function fetchTtsUrl(params) {
  const { url } = await fetchTtsUrlResult(params);
  return url;
}

// Сколько карточек греем за раз — окно, а не вся порция. Разбирают порцию редко
// за один заход, поэтому греть все 10 было тратой квоты впустую: экран сам
// подогревает следующие по мере того, как человек долистывает.
export const PREWARM_CARDS = 3;
// Сколько фраз подхода греем вперёд: текущая уже играет, следующая должна быть
// готова к моменту перехода — этого достаточно.
export const PREWARM_PHRASES = 2;

/**
 * Фоновый прогрев озвучки карточек: ТОЛЬКО заголовочные слова и только первые
 * PREWARM_CARDS штук (окно сдвигает экран по мере листания).
 *
 * Примеры заранее НЕ греем намеренно. Квота тратится лишь при промахе общего
 * кэша в Storage, а слова часто уже озвучены другими пользователями и приходят
 * даром. Примеры же уникальны для каждой карточки, промахиваются почти всегда —
 * и съедали почти всю суточную квоту ради озвучки, которую слушают редко.
 * По тапу пример озвучивается как и раньше, просто без предзагрузки.
 *
 * Последовательно и без ожидания результата, ошибки глотаем: прогрев —
 * оптимизация, а не обязанность.
 */
export function prewarmTts(cards, learnLang, limit = PREWARM_CARDS) {
  if (!Array.isArray(cards) || cards.length === 0 || !learnLang) return;
  const window = limit > 0 ? cards.slice(0, limit) : cards;
  (async () => {
    for (const card of window) {
      // Квота кончилась — дальше греть бессмысленно, только копить отказы.
      if (isTtsQuotaExhausted()) return;
      if (card?.word) await fetchTtsUrl({ text: card.word, learnLang });
    }
  })().catch(() => {
    // тихо: прогрев не должен ничего ломать
  });
}

/**
 * Прогрев фраз подхода (фаза 6.2, аудирование) на конкретной скорости: пока
 * человек слушает текущую фразу, следующая уже готовится. Греем окном в
 * PREWARM_PHRASES штук, а не весь подход: до последних фраз доходят не всегда,
 * а квота у озвучки общая с карточками.
 */
export function prewarmPhrases(
  texts,
  learnLang,
  rate = DEFAULT_RATE,
  limit = PREWARM_PHRASES,
) {
  if (!Array.isArray(texts) || texts.length === 0 || !learnLang) return;
  const window = limit > 0 ? texts.slice(0, limit) : texts;
  (async () => {
    for (const text of window) {
      if (isTtsQuotaExhausted()) return;
      if (text) await fetchTtsUrl({ text, learnLang, rate });
    }
  })().catch(() => {
    // тихо: прогрев не обязателен
  });
}
