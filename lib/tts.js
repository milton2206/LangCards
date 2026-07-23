import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

// Озвучка карточек (фаза 5.1): Google Cloud TTS (WaveNet) + общий кэш в
// Supabase Storage. Аудио генерируется ОДИН раз на (язык + текст) и дальше
// раздаётся как статический файл — кэш общий для всех пользователей.
//
// Ключи только на сервере:
//   GOOGLE_TTS_CREDENTIALS_BASE64 — base64 JSON сервисного аккаунта Google;
//   SUPABASE_SERVICE_ROLE_KEY     — для записи в Storage (обходит RLS,
//                                   во фронтенд НЕ попадает никогда).

const BUCKET = "tts-cache";

// Лимит длины текста на запрос — предохранитель от случайного сжигания квоты
// (слово ~10–30 символов, пример-предложение ~60–150; 300 хватает с запасом).
export const MAX_TTS_TEXT_LEN = 300;

// WaveNet-голоса по изучаемому языку. Один голос на язык — слово и пример
// звучат одинаково. Выбор:
//   de: de-DE-Wavenet-F — чёткий женский хохдойч, самый разборчивый из de-голосов;
//   en: en-GB-Wavenet-A — британский женский (в приложении английский с флагом 🇬🇧);
//   el: el-GR-Wavenet-A — единственный WaveNet-голос греческого;
//   es: es-ES-Wavenet-C — кастильский женский (флаг 🇪🇸 — Испания, не LatAm);
//   ru: ru-RU-Wavenet-C — женский, ровная дикция (русский тоже изучаемый).
const VOICES = {
  de: { languageCode: "de-DE", name: "de-DE-Wavenet-F" },
  en: { languageCode: "en-GB", name: "en-GB-Wavenet-A" },
  el: { languageCode: "el-GR", name: "el-GR-Wavenet-A" },
  es: { languageCode: "es-ES", name: "es-ES-Wavenet-C" },
  ru: { languageCode: "ru-RU", name: "ru-RU-Wavenet-C" },
};

// ---------- OAuth сервисного аккаунта без внешних зависимостей ----------
// Стандартный flow: JWT (RS256) с client_email/private_key → access token.
// Токен живёт час — кэшируем в памяти инстанса функции.
let tokenCache = { token: null, expiresAt: 0 };

function readCredentials() {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS_BASE64;
  if (!raw) {
    const err = new Error(
      "Сервер не настроен: не задан GOOGLE_TTS_CREDENTIALS_BASE64.",
    );
    err.status = 500;
    throw err;
  }
  try {
    return JSON.parse(Buffer.from(raw, "base64").toString("utf8"));
  } catch {
    const err = new Error(
      "GOOGLE_TTS_CREDENTIALS_BASE64 повреждён: не удалось разобрать JSON.",
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
function cachePath(learnLang, text) {
  const hash = crypto.createHash("sha256").update(text).digest("hex");
  return `${learnLang}/${hash}.mp3`;
}

/**
 * Отдаёт URL озвучки: кэш в Storage → есть — сразу URL; нет — генерируем через
 * Google TTS, кладём в Storage, отдаём URL. Бросает Error с .status и понятным
 * message (как generateCards).
 */
export async function getOrCreateSpeech({ text, learnLang }) {
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
  const voice = VOICES[learnLang];
  if (!voice) {
    const err = new Error(`Озвучка для языка «${learnLang}» не поддерживается.`);
    err.status = 400;
    throw err;
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) {
    const err = new Error(
      "Сервер не настроен: не задан SUPABASE_URL (или VITE_SUPABASE_URL).",
    );
    err.status = 500;
    throw err;
  }

  const path = cachePath(learnLang, clean);
  const publicUrl = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${path}`;

  // 1) Кэш: bucket публичный, поэтому дешёвый HEAD по публичному URL.
  // Попадание в кэш не требует ни ключа Google, ни service_role.
  try {
    const head = await fetch(publicUrl, { method: "HEAD" });
    if (head.ok) return { url: publicUrl, cached: true };
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
        audioConfig: { audioEncoding: "MP3" },
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

  return { url: publicUrl, cached: false };
}
