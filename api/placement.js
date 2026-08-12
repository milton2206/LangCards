import { ensurePlacementBank, countBank } from "../lib/placement.js";
import { authenticateRequest, consumeQuota } from "../lib/serverAuth.js";

// Читает JSON-тело запроса (Vercel обычно уже парсит req.body, но подстрахуемся).
async function readBody(req) {
  if (req.body) {
    return typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

/**
 * Серверная функция теста на уровень (фаза 6.3). Один эндпоинт на два действия:
 *   { action: "ensure", learnLang, level? } — наполнить банк, если он пуст;
 *   { action: "count",  learnLang }         — сколько заданий уже есть.
 *
 * Банк собирает СИЛЬНАЯ модель (ANTHROPIC_MODEL_PLACEMENT, по умолчанию Sonnet),
 * а она заметно медленнее Haiku. Поэтому за один вызов наполняется столько
 * уровней, сколько влезает в бюджет времени функции; недобранные приходят в
 * remaining, и их доберёт следующий вызов — запись идемпотентна, дублей нет.
 * level позволяет наполнить ровно один уровень (ручной запуск).
 *
 * Сами задания клиент читает НЕ отсюда, а прямо из placement_items (RLS даёт
 * select всем авторизованным) — эндпоинт нужен только для разовой генерации.
 * Ключи Claude и service_role Supabase остаются в переменных окружения сервера.
 *
 * "ensure" вызывается редко: клиент дёргает его только когда банк языка пуст,
 * а сама функция ещё раз проверяет наполненность и при достаточном банке
 * возвращает { created: 0, cached: true } без единого обращения к модели.
 *
 * В ответе "ensure" приходит и отчёт по качеству: quality — по уровням
 * (сколько модель выдала, сколько отсеяно и по какой причине, сколько попыток
 * добора, сколько записано), qualityTotals — сводка с долей отсева. По ней
 * видно, работают ли фильтры и насколько плоха исходная выдача модели.
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Метод не поддерживается." });
    return;
  }

  try {
    const { action, learnLang, level } = await readBody(req);
    // "count" — дешёвое чтение, лимитом не облагаем; "ensure" может запустить
    // генерацию (5 уровней) — тратим единицу квоты placement.
    const { userId } = await authenticateRequest(req);
    if (action !== "count") await consumeQuota(userId, "placement");
    // force НАМЕРЕННО не берём из тела: пере-генерацию банка с нуля клиент
    // запускать не может (это дорого). Наполнение идёт только когда банк пуст.
    const result =
      action === "count"
        ? await countBank(learnLang)
        : // level (необязателен) — наполнить ровно один уровень. Без него
          // берутся все недостающие, сколько влезет в бюджет времени функции.
          await ensurePlacementBank({ learnLang, force: false, level });
    res.status(200).json(result);
  } catch (err) {
    const status = err.status || 500;
    res.status(status).json({
      error: err.message || "Не удалось подготовить банк заданий.",
      code: err.code,
      retryAfter: err.retryAfter,
    });
  }
}
