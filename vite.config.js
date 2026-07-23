import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

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
          res.statusCode = err.status || 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              error: err.message || "Ошибка генерации карточек",
            }),
          );
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
          const result = await getOrCreateSpeech(params);
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(result));
        } catch (err) {
          res.statusCode = err.status || 500;
          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({ error: err.message || "Ошибка озвучки" }),
          );
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
    plugins: [react(), devApiCards(), devApiTts()],
    server: {
      // Уважаем порт из окружения (PORT), иначе стандартный 5173
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
    },
  };
});
