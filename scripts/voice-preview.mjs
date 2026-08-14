// ============================================================================
// Прослушивание голосов Google TTS: озвучивает одну фразу ВСЕМИ подходящими
// голосами языка и складывает mp3 в папку. Диагностика, не часть приложения.
// ----------------------------------------------------------------------------
// ЗАЧЕМ. Голоса в VOICES (lib/tts.js) выбираются на слух, а послушать их иначе
// негде: имена вроде «de-DE-Neural2-H» ничего не говорят о том, как это звучит.
// Скрипт даёт разложить кандидатов по файлам, прослушать подряд и уже потом
// вписать выбранное в VOICES.
//
// Берутся ТОЛЬКО WaveNet и Neural2 — то, из чего мы реально выбираем. Standard
// заметно механичнее, Studio дороже в сорок раз ($160 против $4 за млн знаков),
// а Chirp3-HD почти не слушается speakingRate (замедление в аудировании на нём
// не работает) — они в выборку не идут.
//
// ЗАПУСК (ключ Google берётся из .env.local, как у остальных скриптов):
//   node scripts/voice-preview.mjs de
//   node scripts/voice-preview.mjs el "Καλημέρα, τι κάνεις σήμερα;"
// Язык — как в приложении (de/en/el/es/ru); фраза необязательна, без неё берётся
// готовая. Файлы: voice-preview/<язык>/<имя голоса>.mp3 (папка в .gitignore).
//
// ВАЖНО: идёт НАПРЯМУЮ к Google, мимо /api/tts. Поэтому суточная квота озвучки
// не тратится и пробные файлы не попадают в общий кэш в Storage. Авторизация —
// тот же сервисный аккаунт, что у приложения (getAccessToken из lib/tts.js).
//
// РАСХОД: длина фразы × число голосов языка (сейчас de 4, en 14, el 1, es 9,
// ru 5). Одна фраза ≈ 40 знаков, то есть сотни знаков за прогон — при цене
// $4–16 за миллион это доли цента.
// ============================================================================

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadLocalEnv, projectRoot } from "./_env.mjs";
import {
  getAccessToken,
  ttsVoiceTable,
  MAX_TTS_TEXT_LEN,
} from "../lib/tts.js";

loadLocalEnv();

// Что берём в выборку: типы голосов, из которых выбираем основной и второй.
const TIERS = ["Wavenet", "Neural2"];
// Скорость — обычная: сравниваем сами голоса, а не замедление.
const SPEAKING_RATE = 1;

// Фраза по умолчанию на каждый язык: обычное разговорное предложение с вопросом
// (по нему слышно интонацию) — примерно то, что бывает репликой диалога.
const SAMPLES = {
  de: "Guten Morgen! Wie geht es dir heute?",
  en: "Good morning! How are you doing today?",
  el: "Καλημέρα! Τι κάνεις σήμερα;",
  es: "¡Buenos días! ¿Cómo estás hoy?",
  ru: "Доброе утро! Как твои дела сегодня?",
};

const GENDERS = { FEMALE: "женский", MALE: "мужской", NEUTRAL: "нейтральный" };

const table = ttsVoiceTable();
const [lang, ...rest] = process.argv.slice(2);

if (!lang || !table[lang]) {
  console.error(
    `Язык не указан или не поддерживается. Доступны: ${Object.keys(table).join(", ")}\n` +
      "Запуск: node scripts/voice-preview.mjs de [фраза]",
  );
  process.exit(1);
}

const text = (rest.join(" ").trim() || SAMPLES[lang] || "").trim();
if (!text) {
  console.error(`Нет фразы для языка «${lang}» — передайте её вторым аргументом.`);
  process.exit(1);
}
if (text.length > MAX_TTS_TEXT_LEN) {
  console.error(
    `Фраза длиннее ${MAX_TTS_TEXT_LEN} знаков — столько не озвучивает и само приложение.`,
  );
  process.exit(1);
}

// Код языка у Google (de-DE, en-GB, …) и то, что стоит в VOICES сейчас, — из
// одной таблицы приложения, чтобы скрипт не разошёлся с ним при смене варианта
// языка (например en-GB → en-US).
const languageCode = table[lang][0].languageCode;
// Метки «сейчас» по имени голоса. Копим списком, а не перезаписываем: в
// греческом оба слота — это ОДИН голос (второй ниже тоном), и строка должна
// показать оба, а не только последний.
const current = new Map();
for (const [i, v] of table[lang].entries()) {
  const label =
    (i === 0 ? "основной" : `голос ${i + 1}`) + (v.pitch ? ` (тон ${v.pitch})` : "");
  current.set(v.name, [current.get(v.name), label].filter(Boolean).join(" + "));
}

let token;
try {
  token = await getAccessToken();
} catch (err) {
  console.error(
    `${err.message}\nКлюч сервисного аккаунта Google задаётся в .env.local ` +
      "(GOOGLE_TTS_CREDENTIALS_B64) — см. .env.example.",
  );
  process.exit(1);
}

// ---------- 1) Какие голоса есть у языка ----------
const listRes = await fetch(
  `https://texttospeech.googleapis.com/v1/voices?languageCode=${languageCode}`,
  { headers: { Authorization: `Bearer ${token}` } },
);
if (!listRes.ok) {
  console.error(`Google не отдал список голосов (${listRes.status}).`);
  process.exit(1);
}
const { voices = [] } = await listRes.json();

// Тип голоса — часть его имени: de-DE-Neural2-H → Neural2.
function tierOf(name) {
  return TIERS.find((tier) => name.includes(`-${tier}-`)) || null;
}

const listed = voices.filter((v) => tierOf(v.name));

// Голоса, которые стоят в VOICES сейчас, добавляем ОБЯЗАТЕЛЬНО — даже если
// Google их больше не показывает в списке. Часть старых имён (de-DE-Wavenet-F,
// el-GR-Wavenet-A, es-ES-Wavenet-C) из выдачи voices.list пропала, но
// синтезируются они по-прежнему — а сравнивать кандидатов надо именно с тем,
// как приложение звучит сегодня.
const known = new Set(listed.map((v) => v.name));
const unlisted = [];
for (const v of table[lang]) {
  // Дедуп по имени: в греческом оба слота — один и тот же голос, и озвучивать
  // его дважды незачем (тон в предпрослушивание не подмешиваем — сравниваем
  // сами голоса).
  if (known.has(v.name) || !tierOf(v.name)) continue;
  known.add(v.name);
  unlisted.push({ name: v.name, ssmlGender: null });
}

const picked = [...listed, ...unlisted].sort((a, b) =>
  a.name.localeCompare(b.name),
);

if (picked.length === 0) {
  console.error(
    `У языка ${languageCode} нет голосов WaveNet или Neural2 — выбирать не из чего.`,
  );
  process.exit(1);
}

// ---------- 2) Озвучиваем фразу каждым ----------
const outDir = resolve(projectRoot, "voice-preview", lang);
mkdirSync(outDir, { recursive: true });

console.log(`Язык: ${languageCode}, голосов в выборке: ${picked.length}`);
console.log(`Фраза: «${text}»\nПапка: ${outDir}\n`);

const rows = [];
for (const voice of picked) {
  const res = await fetch(
    "https://texttospeech.googleapis.com/v1/text:synthesize",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode, name: voice.name },
        audioConfig: { audioEncoding: "MP3", speakingRate: SPEAKING_RATE },
      }),
    },
  );
  if (!res.ok) {
    // Один сбойный голос не должен ронять прогон: остальные всё равно нужны.
    console.log(`✗ ${voice.name} — Google ответил ошибкой (${res.status})`);
    rows.push({ voice, failed: true });
    continue;
  }
  const { audioContent } = await res.json();
  const file = resolve(outDir, `${voice.name}.mp3`);
  writeFileSync(file, Buffer.from(audioContent, "base64"));
  console.log(`✓ ${voice.name}.mp3`);
  rows.push({ voice });
}

// ---------- 3) Что с чем сопоставлять ----------
// Итоговая таблица под то, что потом вписывается в VOICES: имя файла = имя
// голоса, поэтому прослушанное сразу переносится в lib/tts.js.
const width = Math.max(...rows.map((r) => r.voice.name.length), 10);
console.log("\n" + "имя голоса".padEnd(width + 2) + "пол".padEnd(14) + "тип".padEnd(10) + "сейчас");
for (const { voice, failed } of rows) {
  // Пол Google даёт только для голосов из списка; у пропавших из выдачи его нет.
  const gender = GENDERS[voice.ssmlGender] || "—";
  const used = current.get(voice.name) || "";
  console.log(
    voice.name.padEnd(width + 2) +
      gender.padEnd(14) +
      String(tierOf(voice.name)).padEnd(10) +
      (failed ? "не озвучен" : used) +
      (voice.ssmlGender ? "" : " (нет в списке Google)"),
  );
}
console.log(
  `\nВ VOICES (lib/tts.js) сейчас: ${table[lang]
    .map(
      (v, i) =>
        `${i === 0 ? "основной" : `голос ${i + 1}`} — ${v.name}, ${GENDERS[String(v.gender).toUpperCase()] || v.gender || "пол не указан"}${v.pitch ? ` (pitch ${v.pitch})` : ""}`,
    )
    .join("; ")}.`,
);

// Голос выбирается ПО ПОЛУ говорящего, поэтому расхождение нашей пометки с тем,
// что о голосе говорит Google, — это прямо ошибка озвучки: женская реплика
// прозвучала бы мужским голосом. Проверяем и говорим вслух.
const byName = new Map(listed.map((v) => [v.name, v.ssmlGender]));
for (const v of table[lang]) {
  const real = byName.get(v.name);
  if (!real || !v.gender) continue;
  if (real.toLowerCase() !== String(v.gender).toLowerCase()) {
    console.log(
      `⚠ ${v.name}: в VOICES помечен как ${v.gender}, а у Google он ${real.toLowerCase()}.`,
    );
  }
}
