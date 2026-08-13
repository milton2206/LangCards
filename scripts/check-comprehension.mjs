// ============================================================================
// Пробная генерация вопросов на понимание: сколько утверждений отсеивает фильтр
// дословности (lib/comprehension.js). Диагностика, не часть приложения.
// ----------------------------------------------------------------------------
// ЗАЧЕМ. Требование «перефразируй, не списывай» живёт в промпте, но одних
// инструкций модели мало — поэтому есть механический фильтр copiesSource. Этот
// скрипт показывает, сколько он реально ловит на живой модели:
//   около нуля       — фильтр не срабатывает, проверь порог MAX_COPIED_RUN;
//   больше половины  — порог слишком строгий, модель не может составить вопрос.
//
// ЗАПУСК (нужен рабочий ANTHROPIC_API_KEY — в .env.local он пустой):
//   ANTHROPIC_API_KEY=sk-... node scripts/check-comprehension.mjs
// Ключ берётся из окружения или из .env.local. Идёт мимо HTTP-эндпоинтов,
// поэтому серверная авторизация и суточные лимиты не задействованы; расход —
// 5 запросов к Claude (3 текста + 2 диалога).
// ============================================================================

import Anthropic from "@anthropic-ai/sdk";
import { loadLocalEnv } from "./_env.mjs";
import {
  buildTextQuestionsPrompt,
  buildDialoguePrompt,
  normalizeQuestions,
  MAX_COPIED_RUN,
} from "../lib/comprehension.js";
import { parseModelJson, JSON_ONLY_INSTRUCTION } from "../lib/modelJson.js";

loadLocalEnv();

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error(
    "Нет ANTHROPIC_API_KEY. Запуск: ANTHROPIC_API_KEY=sk-... node scripts/check-comprehension.mjs",
  );
  process.exit(1);
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-4-5";
const QUESTIONS = 4; // просим по максимуму — больше материала для замера
const anthropic = new Anthropic({ apiKey });

// Тексты — как в режиме чтения: 5–6 предложений, разные языки и уровни.
const PASSAGES = [
  {
    learnLang: "de",
    level: "a2",
    text: "Anna wollte am Montag mit dem Zug nach Hamburg fahren. Sie hat den Zug verpasst, weil ihr Wecker nicht geklingelt hat. Am Bahnhof hat sie eine Freundin getroffen, die auch auf den nächsten Zug wartete. Die beiden haben zusammen einen Kaffee getrunken und über die Arbeit gesprochen. Der nächste Zug kam erst zwei Stunden später. Trotzdem war Anna am Ende zufrieden mit dem Tag.",
  },
  {
    learnLang: "de",
    level: "b1",
    text: "Herr Weber sucht seit drei Monaten eine neue Wohnung in Köln. Die Mieten im Zentrum sind für sein Gehalt zu hoch, deshalb schaut er jetzt in den Vororten. Gestern hat er eine Wohnung besichtigt, die hell und ruhig war. Der Vermieter wollte allerdings eine Kaution von drei Monatsmieten. Herr Weber überlegt noch, ob er das Angebot annimmt.",
  },
  {
    learnLang: "en",
    level: "a2",
    text: "Maria works in a small bakery near the station. She starts at five in the morning, so she goes to bed early. On Saturdays the bakery is very busy and her sister comes to help. Last week the oven broke and they had to close for a day. The owner promised to buy a new one before the winter.",
  },
];

// Диалоги модель придумывает целиком — вместе с вопросами к ним.
const DIALOGUES = [
  {
    learnLang: "de",
    nativeLang: "ru",
    topic: "doctor",
    level: "a2",
    knownWords: ["Termin", "Schmerzen", "Rezept"],
  },
  {
    learnLang: "en",
    nativeLang: "ru",
    topic: "restaurant",
    level: "b1",
    knownWords: ["order", "bill", "recommend"],
  },
];

async function ask(system, prompt, maxTokens) {
  const message = await anthropic.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  return parseModelJson(
    message.content
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join(""),
  );
}

// Доля отсева = «что вернула модель» минус «что прошло фильтр»: тот же
// normalizeQuestions, только один раз без источника, другой — с ним.
function measure(rawQuestions, source, label, acc) {
  const all = normalizeQuestions(rawQuestions, 99);
  const kept = normalizeQuestions(rawQuestions, 99, source);
  const keptSet = new Set(kept.map((q) => q.statement));
  acc.total += all.length;
  acc.dropped += all.length - kept.length;
  for (const q of all) {
    if (!keptSet.has(q.statement)) acc.rejects.push(`[${label}] ${q.statement}`);
  }
  console.log(`${label}: модель дала ${all.length}, прошло ${kept.length}`);
}

const acc = { total: 0, dropped: 0, rejects: [] };

for (const p of PASSAGES) {
  const raw = await ask(
    "Ты — преподаватель, который составляет вопросы на понимание содержания текста " +
      "(верно/неверно) с коротким объяснением ответа. Проверяешь понимание смысла, а не грамматику. " +
      JSON_ONLY_INSTRUCTION,
    buildTextQuestionsPrompt({
      passage: p.text,
      learnLang: p.learnLang,
      nativeLang: "ru",
      level: p.level,
      questions: QUESTIONS,
    }),
    900,
  );
  measure(raw?.questions, p.text, `чтение ${p.learnLang}/${p.level}`, acc);
}

for (const d of DIALOGUES) {
  const raw = await ask(
    "Ты — автор коротких диалогов для изучающих язык и вопросов на понимание к ним. " +
      JSON_ONLY_INSTRUCTION,
    buildDialoguePrompt({ ...d, lines: 4, questions: QUESTIONS }),
    1300,
  );
  const source = (raw?.dialogue || []).map((l) => l?.text || "").join(" ");
  measure(raw?.questions, source, `диалог ${d.learnLang}/${d.level}`, acc);
}

const percent = acc.total ? Math.round((acc.dropped / acc.total) * 100) : 0;
console.log(`\nпорог ${MAX_COPIED_RUN} слов подряд`);
console.log(`всего вопросов: ${acc.total}, отсеяно: ${acc.dropped} (${percent}%)`);
if (acc.rejects.length) console.log("\nотсеянные утверждения:\n" + acc.rejects.join("\n"));
