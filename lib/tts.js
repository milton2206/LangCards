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

// Насколько понижаем тон ВТОРОМУ говорящему там, где второго голоса у языка
// нет (греческий). Значение в ПОЛУТОНАХ — так его считает Google; −4 полутона
// это ровно пара тонов вниз: собеседник слышимо другой, но голос не звучит
// карикатурно. Тон входит в ключ кэша, поэтому подкрутить значение можно прямо
// здесь — реплики второго говорящего просто озвучатся заново по новому пути.
export const SECOND_SPEAKER_PITCH = -4;

// ---------- Голоса ----------
// ДВА голоса на изучаемый язык, а не один. Первый («a») — основной: им звучит
// всё, что произносит один говорящий (слово, пример, текст чтения, первая
// сторона диалога). Второй («b») нужен ДИАЛОГАМ аудирования: пока голос был
// один, обе реплики читал один и тот же голос — «монолог одного робота».
//
// Все голоса — линейка WaveNet, и это осознанно: $4 за миллион знаков и 4 млн
// бесплатно в месяц. Neural2 при том же качестве стоил бы вчетверо дороже при
// вчетверо меньшем бесплатном лимите, Studio — в сорок раз дороже, а Chirp3-HD
// почти не слушается speakingRate, то есть ломает замедление в аудировании.
//
// Греческий особый: голосов у языка ровно два, и на слух они не различаются.
// Поэтому второго говорящего там разводим не голосом, а ТОНОМ — тот же голос
// ниже на SECOND_SPEAKER_PITCH. Механика для диалога одна и та же: слот «b».
//
// pitch задан ТОЛЬКО у греческого второго голоса. У остальных поля нет, и в
// запрос к Google оно не попадает вовсе: обычная озвучка карточек и чтения
// звучит ровно так же, как раньше.
//
// folder — сегмент пути в общем кэше (см. cachePath). Пустая строка означает
// «прежний путь без сегмента»: её ставим ТОЛЬКО тем основным голосам, которые
// не менялись (de, el, es), — их накопленный кэш остаётся действительным. У
// остальных сегмент выводится из имени голоса автоматически, поэтому смена
// имени сама уводит озвучку на новый путь и старое аудио не подмешивается.
const VOICES = {
  de: [
    { languageCode: "de-DE", name: "de-DE-Wavenet-F", folder: "" },
    { languageCode: "de-DE", name: "de-DE-Wavenet-H" },
  ],
  en: [
    { languageCode: "en-GB", name: "en-GB-Wavenet-N" },
    { languageCode: "en-GB", name: "en-GB-Wavenet-O" },
  ],
  el: [
    { languageCode: "el-GR", name: "el-GR-Wavenet-A", folder: "" },
    {
      languageCode: "el-GR",
      name: "el-GR-Wavenet-A",
      pitch: SECOND_SPEAKER_PITCH,
    },
  ],
  es: [
    { languageCode: "es-ES", name: "es-ES-Wavenet-C", folder: "" },
    { languageCode: "es-ES", name: "es-ES-Wavenet-G" },
  ],
  ru: [
    { languageCode: "ru-RU", name: "ru-RU-Wavenet-D" },
    { languageCode: "ru-RU", name: "ru-RU-Wavenet-A" },
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

/**
 * КОПИЯ таблицы голосов — для диагностики (scripts/voice-preview.mjs): из неё
 * видно и список поддерживаемых языков, и код языка у Google, и что сейчас
 * стоит в основном/втором голосе. Именно копия, а не сама таблица, чтобы её
 * нельзя было поменять снаружи.
 */
export function ttsVoiceTable() {
  return Object.fromEntries(
    Object.entries(VOICES).map(([lang, list]) => [
      lang,
      list.map((v) => ({ ...v })),
    ]),
  );
}

function voiceIndex(voiceId) {
  return Math.max(0, TTS_VOICES.indexOf(voiceId));
}

/**
 * Сегмент пути в кэше, отвечающий за ГОЛОС И ТОН. Явно заданный folder (в т.ч.
 * пустая строка — «прежний путь») главнее; иначе выводим из имени голоса, и
 * тон, если он есть, дописываем к нему: en-GB-Wavenet-O → «wavenet-o»,
 * el-GR-Wavenet-A с тоном −4 → «wavenet-a_p-4».
 *
 * Смысл автоматического вывода: имя голоса — часть ключа, поэтому смена голоса
 * в VOICES сама уводит озвучку на новый путь. Иначе после замены основного
 * голоса из кэша годами возвращалось бы аудио прежнего — тем же путём.
 */
function voiceFolder(voice) {
  if (typeof voice.folder === "string") return voice.folder;
  const slug = voice.name.replace(`${voice.languageCode}-`, "").toLowerCase();
  return voice.pitch ? `${slug}_p${voice.pitch}` : slug;
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

// Экспортируется, чтобы диагностические скрипты (scripts/voice-preview.mjs)
// ходили к Google под ТЕМ ЖЕ сервисным аккаунтом, а не заводили свою авторизацию.
export async function getAccessToken() {
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
// Общий для всех пользователей и складывается из ЧЕТЫРЁХ вещей:
//   язык / голос и тон / скорость / sha256 точного текста.
// Текст берём как есть, только обрезаем краевые пробелы — ничего не переписываем.
//
// Голос и тон обязаны быть в ключе: без них одна и та же фраза, сказанная двумя
// голосами (или тем же голосом ниже тоном), перезаписывала бы сама себя, и
// человек слышал бы то одного, то другого собеседника — смотря кто озвучил
// первым. Скорость по той же причине: медленная речь — это другой mp3.
//
// Схема пути:
//   <язык>/[<голос_тон>/][r<скорость>/]<хеш>.mp3
// Сегменты в квадратных скобках появляются, только если нужны. У основных
// голосов, которые НЕ менялись (de, el, es — им проставлен folder: ""), сегмента
// голоса нет, поэтому их прежние пути совпадают с накопленным кэшем до байта:
//   de/<хеш>.mp3, de/r070/<хеш>.mp3 — как и раньше.
// У остальных сегмент есть, и смена имени голоса в VOICES автоматически уводит
// озвучку на новый путь: en/wavenet-n/<хеш>.mp3, el/wavenet-a_p-4/<хеш>.mp3.
function cachePath(learnLang, text, rate, voice) {
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  const parts = [learnLang];
  const folder = voiceFolder(voice);
  if (folder) parts.push(folder);
  if (rate !== DEFAULT_TTS_RATE) {
    parts.push(`r${rate.toFixed(2).replace(".", "")}`); // 0.7 → r070
  }
  return `${parts.join("/")}/${hash}.mp3`;
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
 * voice — какой из голосов языка («a» основной, «b» второй; см. VOICES). Слот
 * задаёт и голос, и тон, и путь в кэше: одна и та же фраза разными голосами
 * (или тем же голосом ниже тоном) — разные mp3.
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
  const entry = langVoices[voiceIndex(speechVoice)];
  // В запрос к Google уходят ТОЛЬКО languageCode и name; pitch едет отдельным
  // полем audioConfig, а folder — вообще наше служебное (путь в кэше).
  const { languageCode, name, pitch } = entry;

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
  const path = cachePath(learnLang, clean, speakingRate, entry);
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
        voice: { languageCode, name },
        // speakingRate — родное замедление Google: тот же голос и интонация,
        // без «растянутого» звука, который даёт playbackRate в браузере.
        // pitch добавляем ТОЛЬКО там, где он задан (второй говорящий в
        // греческом): у обычной озвучки карточек и чтения поля в запросе нет
        // вовсе, поэтому она звучит ровно как прежде.
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
