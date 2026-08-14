import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Озвучка карточек (фаза 5.1): Google Cloud TTS + общий кэш в Supabase Storage.
// Аудио генерируется ОДИН раз на (язык + голос + скорость + текст) и дальше
// раздаётся как статический файл — кэш общий для всех пользователей.
//
// Ключи только на сервере:
//   GOOGLE_TTS_CREDENTIALS_B64 — base64 JSON сервисного аккаунта Google;
//   SUPABASE_SERVICE_ROLE_KEY     — для записи в Storage (обходит RLS,
//                                   во фронтенд НЕ попадает никогда).

const BUCKET = "tts-cache";

// Лимит длины текста на запрос — предохранитель от случайного сжигания квоты
// (слово ~10–30 символов, пример-предложение ~60–150; 300 хватает с запасом).
export const MAX_TTS_TEXT_LEN = 300;

// Скорости речи (фаза 6.2, аудирование): РОВНО три допустимых значения.
// Список закрытый намеренно — каждая скорость это отдельная запись в кэше,
// а произвольный rate снаружи размножил бы кэш и сжёг квоту Google.
// 1 — обычная озвучка карточек и чтения (фазы 5.1/6.1), путь в кэше прежний.
export const TTS_RATES = [0.7, 1, 1.15];
export const DEFAULT_TTS_RATE = 1;

// Приводит запрошенную скорость к ближайшей допустимой (мусор → обычная).
export function normalizeRate(rate) {
  const value = Number(rate);
  if (!Number.isFinite(value)) return DEFAULT_TTS_RATE;
  return TTS_RATES.reduce(
    (best, r) => (Math.abs(r - value) < Math.abs(best - value) ? r : best),
    DEFAULT_TTS_RATE,
  );
}

// ---------- Голоса ----------
// ДВА голоса на изучаемый язык, а не один. Первый («a») — основной: им звучит
// всё, что произносит один говорящий (слово, пример, текст чтения, первая
// сторона диалога). Второй («b») нужен ДИАЛОГАМ аудирования: пока голос был
// один, обе реплики читал один и тот же голос — «монолог одного робота».
//
// Первый голос НЕ МЕНЯЛСЯ намеренно: он лежит в общем кэше Storage под прежними
// путями (см. cachePath), и смена имени обесценила бы весь накопленный кэш —
// всё пришлось бы озвучивать заново за деньги и за суточную квоту пользователей.
//
// Почему второй голос именно такой (проверено запросами к Google, август 2026):
//   de: Neural2-H (муж.) — настоящий отдельный голос; основной de-DE-Wavenet-F
//       на стороне Google сегодня отдаёт байт-в-байт то же, что Neural2-G, то
//       есть немецкий и так звучит «нейронно»;
//   en: Neural2-D (муж.) — Wavenet-D/Standard-D отдают одинаковое аудио, а
//       Neural2-D отличается: берём именно его;
//   es: Neural2-F (муж.) — тот же приём, что и в английском;
//   ru: Wavenet-D (муж.) — Neural2 для русского у Google нет; берём мужской
//       голос той же линейки, он явно отличается от женского основного;
//   el: голос в греческом РОВНО ОДИН (Standard-B и Wavenet-B — он же), поэтому
//       второго говорящего разводим понижением тона (pitch): −4 полутона дают
//       слышимо другого собеседника, оставаясь тем же качеством и слушаясь
//       speakingRate. Chirp3-HD (единственная альтернатива в греческом) сюда не
//       годится: он почти игнорирует speakingRate и заметно дороже.
//
// pitch указывается ТОЛЬКО там, где он нужен: без поля запрос к Google остаётся
// в точности прежним, и уже накопленный кэш остаётся валидным.
const VOICES = {
  de: [
    { languageCode: "de-DE", name: "de-DE-Wavenet-F" },
    { languageCode: "de-DE", name: "de-DE-Neural2-H" },
  ],
  en: [
    { languageCode: "en-GB", name: "en-GB-Wavenet-A" },
    { languageCode: "en-GB", name: "en-GB-Neural2-D" },
  ],
  el: [
    { languageCode: "el-GR", name: "el-GR-Wavenet-A" },
    { languageCode: "el-GR", name: "el-GR-Wavenet-B", pitch: -4 },
  ],
  es: [
    { languageCode: "es-ES", name: "es-ES-Wavenet-C" },
    { languageCode: "es-ES", name: "es-ES-Neural2-F" },
  ],
  ru: [
    { languageCode: "ru-RU", name: "ru-RU-Wavenet-C" },
    { languageCode: "ru-RU", name: "ru-RU-Wavenet-D" },
  ],
};

// Идентификаторы голосов снаружи (в запросе и в клиенте): "a" — основной,
// "b" — второй. Список закрытый, как и TTS_RATES: каждый голос это отдельная
// запись в общем кэше, и произвольное значение снаружи размножило бы кэш.
export const TTS_VOICES = ["a", "b"];
export const DEFAULT_TTS_VOICE = "a";

// Мусор или неизвестный голос → основной (озвучка не должна падать из-за этого).
export function normalizeVoice(voice) {
  const id = String(voice ?? "").trim().toLowerCase();
  return TTS_VOICES.includes(id) ? id : DEFAULT_TTS_VOICE;
}

function voiceIndex(voiceId) {
  return Math.max(0, TTS_VOICES.indexOf(voiceId));
}

// ---------- OAuth сервисного аккаунта без внешних зависимостей ----------
// Стандартный flow: JWT (RS256) с client_email/private_key → access token.
// Токен живёт час — кэшируем в памяти инстанса функции.
let tokenCache = { token: null, expiresAt: 0 };

function readCredentials() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS_B64;
  if (!raw) {
    const err = new Error(
      "Сервер не настроен: не задан GOOGLE_TTS_CREDENTIALS_B64.",
    );
    err.status = 500;
    throw err;
  }
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    const err = new Error(
      "GOOGLE_TTS_CREDENTIALS_B64 повреждён: не удалось разобрать JSON.",
    );
    err.status = 500;
    throw err;
  }
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  // Запас 60 секунд, чтобы не поймать истёкший токен на длинном запросе.
  if (tokenCache.token && tokenCache.expiresAt - 60 > now) {
    return tokenCache.token;
  }

  const creds = readCredentials();
  const b64url = (obj) =>
    Buffer.from(JSON.stringify(obj)).toString("base64url");
  const header = b64url({ alg: "RS256", typ: "JWT" });
  const claims = b64url({
    iss: creds.client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  });
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = signer.sign(creds.private_key).toString("base64url");
  const assertion = `${header}.${claims}.${signature}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) {
    const err = new Error("Не удалось авторизоваться в Google Cloud.");
    err.status = 502;
    throw err;
  }
  const data = await res.json();
  tokenCache = { token: data.access_token, expiresAt: now + (data.expires_in || 3600) };
  return tokenCache.token;
}

// ---------- Ключ кэша ----------
// Общий для всех пользователей: язык + sha256 точного текста (текст берём как
// есть, только обрезаем краевые пробелы — ничего не переписываем).
// Скорость входит в путь отдельной папкой, потому что медленная речь — это
// другой mp3. Обычная скорость (1) сохраняет ПРЕЖНИЙ путь: всё, что уже
// нагенерировано фазами 5.1/6.1, остаётся в кэше и не переозвучивается.
//
// ГОЛОС — тоже часть пути, иначе одна и та же фраза, сказанная двумя голосами,
// перезаписывала бы сама себя (и человек слышал бы то одного, то другого
// говорящего в зависимости от того, кто озвучил первым). Основной голос своей
// папки НЕ получает: его путь обязан остаться прежним, чтобы весь накопленный
// кэш остался в силе. Второй уходит в подпапку v2 (третий — v3 и так далее).
function cachePath(learnLang, text, rate, voiceId) {
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  const index = voiceIndex(voiceId);
  const voiceFolder = index === 0 ? "" : `v${index + 1}/`;
  if (rate === DEFAULT_TTS_RATE) return `${learnLang}/${voiceFolder}${hash}.mp3`;
  const folder = `r${rate.toFixed(2).replace(".", "")}`; // 0.7 → r070
  return `${learnLang}/${voiceFolder}${folder}/${hash}.mp3`;
}

/**
 * Отдаёт URL озвучки: кэш в Storage → есть — сразу URL; нет — генерируем через
 * Google TTS, кладём в Storage, отдаём URL. Бросает Error с .status и понятным
 * message (как generateCards).
 *
 * rate — скорость речи (фаза 6.2): своя запись в кэше на каждую скорость,
 * поэтому повторное прослушивание той же фразы на той же скорости к Google
 * уже не ходит.
 *
 * voice — какой из голосов языка («a» основной, «b» второй; см. VOICES). Тоже
 * своя запись в кэше: одна и та же фраза разными голосами — разные mp3.
 *
 * onSynthesize (фаза 7.1) — необязательный хук, который вызывается РОВНО перед
 * реальным синтезом (после подтверждённого кэш-промаха). Через него списывается
 * суточный лимит tts: попадание в общий кэш квоту не тратит. Если хук бросит
 * (лимит исчерпан) — синтеза и расхода Google не будет.
 */
export async function getOrCreateSpeech({
  text,
  learnLang,
  rate,
  voice: voiceId,
  onSynthesize,
}) {
  const clean = String(text ?? "").trim();
  if (!clean) {
    const err = new Error("Пустой текст для озвучки.");
    err.status = 400;
    throw err;
  }
  if (clean.length > MAX_TTS_TEXT_LEN) {
    const err = new Error(
      `Текст для озвучки слишком длинный (максимум ${MAX_TTS_TEXT_LEN} символов).`,
    );
    err.status = 400;
    throw err;
  }
  const langVoices = VOICES[learnLang];
  if (!langVoices) {
    const err = new Error(`Озвучка для языка «${learnLang}» не поддерживается.`);
    err.status = 400;
    throw err;
  }
  // Если у языка второго голоса нет (список короче), спокойно берём основной —
  // диалог тогда звучит как раньше, а не падает с ошибкой.
  const requested = normalizeVoice(voiceId);
  const speechVoice = langVoices[voiceIndex(requested)] ? requested : DEFAULT_TTS_VOICE;
  // { languageCode, name, pitch? } — pitch есть не у всех (см. VOICES).
  const { pitch, ...voice } = langVoices[voiceIndex(speechVoice)];

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    const err = new Error(
      "Сервер не настроен: не задан SUPABASE_URL (или VITE_SUPABASE_URL).",
    );
    err.status = 500;
    throw err;
  }

  const speakingRate = normalizeRate(rate);
  const path = cachePath(learnLang, clean, speakingRate, speechVoice);
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;

  // 1) Кэш: bucket публичный, поэтому дешёвый HEAD по публичному URL.
  // Попадание в кэш не требует ни ключа Google, ни service_role.
  try {
    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) {
      return { url: publicUrl, cached: true, rate: speakingRate, voice: speechVoice };
    }
  } catch {
    // сеть до Storage моргнула — попробуем сгенерировать и записать заново
  }

  // Дальше — генерация и запись: тут уже нужен service_role.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    const err = new Error(
      "Сервер не настроен: не задан SUPABASE_SERVICE_ROLE_KEY (запись в кэш озвучки).",
    );
    err.status = 500;
    throw err;
  }

  // Кэш-промах подтверждён — вот теперь тратим единицу суточного лимита tts
  // (если хук передан). Бросит при исчерпании лимита → синтеза не будет.
  if (typeof onSynthesize === "function") await onSynthesize();

  // 2) Генерация через Google TTS (WaveNet, MP3).
  const token = await getAccessToken();
  const synthRes = await fetch(
    "https://texttospeech.googleapis.com/v1/text:synthesize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text: clean },
        voice,
        // speakingRate — родное замедление Google: тот же голос и интонация,
        // без «растянутого» звука, который даёт playbackRate в браузере.
        // pitch добавляем ТОЛЬКО у голосов, где он задан (греческий): без него
        // запрос остаётся в точности прежним и совпадает с накопленным кэшем.
        audioConfig: {
          audioEncoding: "MP3",
          speakingRate,
          ...(typeof pitch === "number" ? { pitch } : {}),
        },
      }),
    },
  );
  if (!synthRes.ok) {
    const err = new Error(`Google TTS ответил ошибкой (${synthRes.status}).`);
    err.status = 502;
    throw err;
  }
  const { audioContent } = await synthRes.json();
  const bytes = Buffer.from(audioContent, "base64");

  // 3) Сохраняем в общий кэш (service role; upsert — параллельные генерации
  // одного текста безвредно перезапишут друг друга тем же содержимым).
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: "audio/mpeg", upsert: true });
  if (error) {
    const err = new Error(`Не удалось сохранить аудио в кэш: ${error.message}`);
    err.status = 502;
    throw err;
  }

  return { url: publicUrl, cached: false, rate: speakingRate, voice: speechVoice };
}
