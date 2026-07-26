import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Отправляет JSON-ошибку из dev-middleware в том же формате, что и прод-функции
// в api/*.js (включая code/retryAfter — по ним клиент показывает понятный текст
// про лимит). Держим формат единым, чтобы локально и на Vercel вело себя одинаково.
function sendApiError(res, err, fallback) {
  res.statusCode = err.status || 500;
  res.setHeader("Content-Type", "application/json");
  res.end(
    JSON.stringify({
      error: err.message || fallback,
      code: err.code,
      retryAfter: err.retryAfter,
    }),
  );
}

// Проверка сессии + суточного лимита в dev-режиме — тем же кодом, что и на
// Vercel (lib/serverAuth.js). Так лимит нельзя обойти локальным дев-сервером.
// Возвращает { userId } или null (тогда ответ с ошибкой уже отправлен).
async function guardDev(server, req, res, kind) {
  const { guard } = await server.ssrLoadModule("/lib/serverAuth.js");
  try {
    return await guard(req, kind);
  } catch (err) {
    sendApiError(res, err, "Доступ запрещён.");
    return null;
  }
}

// Dev-плагин: локально обслуживает POST /api/cards тем же кодом, что и
// serverless-функция на Vercel. Ключ берётся из окружения (напр. из .env.local).
// В проде этим занимается сама Vercel-функция в папке /api.
function devApiCards() {
  return {
    name: "dev-api-cards",
    async configureServer(server) {
      server.middlewares.use("/api/cards", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        try {
          // Вход + суточный лимит до генерации (тот же guard, что и на Vercel).
          if (!(await guardDev(server, req, res, "cards"))) return;
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          const params = raw ? JSON.parse(raw) : {};
          // Импортируем лениво, чтобы ошибка ключа не роняла запуск дев-сервера.
          const { generateCards } = await server.ssrLoadModule(
            "/lib/generateCards.js",
          );
          const cards = await generateCards(params);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ cards }));
        } catch (err) {
          sendApiError(res, err, "Ошибка генерации карточек");
        }
      });
    },
  };
}

// Dev-плагин: локально обслуживает POST /api/tts тем же кодом, что и
// serverless-функция на Vercel (озвучка, фаза 5.1). Ключи — из окружения.
function devApiTts() {
  return {
    name: "dev-api-tts",
    async configureServer(server) {
      server.middlewares.use("/api/tts", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          const params = raw ? JSON.parse(raw) : {};
          // Импортируем лениво, чтобы ошибка ключей не роняла запуск дев-сервера.
          const { getOrCreateSpeech } = await server.ssrLoadModule("/lib/tts.js");
          const { authenticateRequest, consumeQuota } =
            await server.ssrLoadModule("/lib/serverAuth.js");
          // Вход обязателен всегда; лимит tts тратится только при кэш-промахе.
          const { userId } = await authenticateRequest(req);
          const result = await getOrCreateSpeech({
            ...params,
            onSynthesize: () => consumeQuota(userId, "tts"),
          });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (err) {
          sendApiError(res, err, "Ошибка озвучки");
        }
      });
    },
  };
}

// Dev-плагин: локально обслуживает POST /api/reading тем же кодом, что и
// serverless-функция на Vercel (режим чтения, фаза 6.1).
function devApiReading() {
  return {
    name: "dev-api-reading",
    async configureServer(server) {
      server.middlewares.use("/api/reading", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          const params = raw ? JSON.parse(raw) : {};
          // Вид лимита зависит от действия: grammar дешевле и чаще — своя квота.
          const kind = params.action === "grammar" ? "grammar" : "texts";
          if (!(await guardDev(server, req, res, kind))) return;
          // Импортируем лениво, чтобы ошибка ключа не роняла запуск дев-сервера.
          const { generateReadingText, explainGrammar } =
            await server.ssrLoadModule("/lib/reading.js");
          const result =
            params.action === "grammar"
              ? await explainGrammar(params)
              : await generateReadingText(params);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (err) {
          sendApiError(res, err, "Ошибка режима чтения");
        }
      });
    },
  };
}

// Dev-плагин: локально обслуживает POST /api/placement тем же кодом, что и
// serverless-функция на Vercel (банк заданий теста на уровень, фаза 6.3).
function devApiPlacement() {
  return {
    name: "dev-api-placement",
    async configureServer(server) {
      server.middlewares.use("/api/placement", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          const params = raw ? JSON.parse(raw) : {};
          const { authenticateRequest, consumeQuota } =
            await server.ssrLoadModule("/lib/serverAuth.js");
          // "count" — дешёвое чтение (без квоты); "ensure" может генерировать банк.
          const { userId } = await authenticateRequest(req);
          if (params.action !== "count") await consumeQuota(userId, "placement");
          // Импортируем лениво, чтобы ошибка ключей не роняла запуск дев-сервера.
          const { ensurePlacementBank, countBank } =
            await server.ssrLoadModule("/lib/placement.js");
          // force НАМЕРЕННО не берём из тела — клиент пере-генерацию не запускает.
          const result =
            params.action === "count"
              ? await countBank(params.learnLang)
              : await ensurePlacementBank({
                  learnLang: params.learnLang,
                  force: false,
                });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (err) {
          sendApiError(res, err, "Ошибка банка заданий");
        }
      });
    },
  };
}

// Dev-плагин: локально обслуживает POST /api/listening тем же кодом, что и
// serverless-функция на Vercel (подбор похоже звучащих вариантов, фаза 6.2).
function devApiListening() {
  return {
    name: "dev-api-listening",
    async configureServer(server) {
      server.middlewares.use("/api/listening", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        try {
          if (!(await guardDev(server, req, res, "listening"))) return;
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          const params = raw ? JSON.parse(raw) : {};
          // Импортируем лениво, чтобы ошибка ключа не роняла запуск дев-сервера.
          const { generateSoundAlikes } =
            await server.ssrLoadModule("/lib/listening.js");
          const items = await generateSoundAlikes({
            learnLang: params.learnLang,
            nativeLang: params.nativeLang,
            level: params.level,
            words: params.words,
            source: params.source,
            count: params.count,
          });
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ items }));
        } catch (err) {
          sendApiError(res, err, "Ошибка аудирования");
        }
      });
    },
  };
}

// Dev-плагин: локально обслуживает POST /api/account тем же кодом, что и
// serverless-функция на Vercel (удаление аккаунта, фаза 7.1).
function devApiAccount() {
  return {
    name: "dev-api-account",
    async configureServer(server) {
      server.middlewares.use("/api/account", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("Method Not Allowed");
          return;
        }
        try {
          const chunks = [];
          for await (const chunk of req) chunks.push(chunk);
          const raw = Buffer.concat(chunks).toString("utf8");
          const params = raw ? JSON.parse(raw) : {};
          const { authenticateRequest } =
            await server.ssrLoadModule("/lib/serverAuth.js");
          const { deleteAccount } =
            await server.ssrLoadModule("/lib/deleteAccount.js");
          // id — только из проверенной сессии, не из тела.
          const { userId } = await authenticateRequest(req);
          if (params.action !== "delete") {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Неизвестное действие." }));
            return;
          }
          await deleteAccount(userId);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ ok: true }));
        } catch (err) {
          sendApiError(res, err, "Не удалось удалить аккаунт");
        }
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Vite сам НЕ кладёт .env/.env.local в process.env — а dev-middleware
  // (/api/cards, /api/tts) читают ключи именно оттуда, как на Vercel.
  // Подтягиваем все переменные (prefix "" = включая без VITE_), не затирая
  // реальное окружение процесса.
  const env = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(env)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  return {
    plugins: [
      react(),
      devApiCards(),
      devApiTts(),
      devApiReading(),
      devApiPlacement(),
      devApiListening(),
      devApiAccount(),
    ],
    server: {
      // Уважаем порт из окружения (PORT), иначе стандартный 5173
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
    },
  };
});
