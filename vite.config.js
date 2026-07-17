import { defineConfig } from "vite";
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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devApiCards()],
  server: {
    // Уважаем порт из окружения (PORT), иначе стандартный 5173
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
});
