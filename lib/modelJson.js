// Надёжный разбор JSON из ответа модели. Общий для всех серверных генераций
// (карточки, тексты 6.1, тест уровня, аудирование) — раньше каждая парсила
// «от первой скобки до последней», и это ломалось, когда модель добавляла
// пояснение ПОСЛЕ JSON: если в пояснении встречалась скобка `]`/`}`,
// lastIndexOf цеплялся за неё и в JSON.parse попадал мусор
// («Unexpected non-whitespace character after JSON»). Здесь берём ПЕРВЫЙ
// сбалансированный объект/массив (с учётом строк), поэтому любой текст и до, и
// после JSON игнорируется. Плюс снимаем markdown-забор ```json … ```.

// Жёсткая инструкция для системного промпта: только JSON, без обёрток и текста.
// Ставится во все генерации, чтобы правило не разъезжалось.
export const JSON_ONLY_INSTRUCTION =
  "Верни ТОЛЬКО валидный JSON и больше ничего: без пояснений и комментариев, " +
  "без markdown-ограждений ```json и ```, без какого-либо текста до или после JSON. " +
  "Первый символ ответа — { или [, последний — } или ].";

// Находит сбалансированную пару скобок от startIdx, учитывая строки и
// экранирование (скобка внутри строки не считается). Возвращает подстроку
// [startIdx … закрывающая] или null, если закрывающая не найдена.
function balancedFrom(text, startIdx, open, close) {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = startIdx; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === open) depth += 1;
    else if (ch === close) {
      depth -= 1;
      if (depth === 0) return text.slice(startIdx, i + 1);
    }
  }
  return null;
}

/**
 * Достаёт и парсит JSON из «грязного» ответа модели. Пробует каждую открывающую
 * скобку по очереди и берёт первый сбалансированный блок, который валидно
 * парсится, — так отсекается текст и до, и после JSON. Бросает, если ни один
 * блок не распарсился.
 */
export function parseModelJson(raw) {
  let text = String(raw ?? "").trim();
  if (!text) throw new Error("Пустой ответ модели.");

  // Снимаем markdown-забор ```json … ``` (берём содержимое первого блока).
  const fence = text.match(/```(?:json|javascript)?\s*([\s\S]*?)```/i);
  if (fence && fence[1].trim()) text = fence[1].trim();

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== "{" && ch !== "[") continue;
    const block = balancedFrom(text, i, ch, ch === "{" ? "}" : "]");
    if (!block) continue;
    try {
      return JSON.parse(block);
    } catch {
      // Не этот блок (скобка была в прозе) — пробуем следующую.
    }
  }

  // Ничего сбалансированного не подошло — последняя попытка «как есть»,
  // чтобы бросить осмысленную ошибку разбора.
  return JSON.parse(text);
}

// Временные сбои со стороны модели/сети: их лечит простой повтор. 529 —
// «overloaded» у Anthropic, встречается регулярно и почти всегда проходит со
// второго раза. Постоянные ошибки (400 — кривой запрос, 401/403 — ключ) в этот
// список НЕ входят: повторять их бессмысленно, отдаём сразу.
const TRANSIENT_STATUSES = new Set([408, 409, 425, 429, 500, 502, 503, 504, 529]);

function isTransient(err) {
  if (!err) return false;
  const status = Number(err.status ?? err.statusCode);
  if (TRANSIENT_STATUSES.has(status)) return true;
  const label = [
    err.name,
    err.type,
    err.error?.type,
    err.code,
    err.message,
  ].join(" ");
  return /overloaded|rate.?limit|timeout|timed out|ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up/i.test(
    label,
  );
}

/**
 * Запрашивает у модели JSON с надёжным разбором и ОДНИМ повтором. Повторяем ТРИ
 * класса неудач — именно из-за них «первый раз ошибка, второй раз работает»:
 *   1) не разобрался JSON (модель добавила прозу/обрезала ответ);
 *   2) временный сбой API (529 overloaded, 429, 5xx, таймаут сети);
 *   3) ответ разобрался, но оказался ПУСТЫМ/негодным — это решает validate.
 * Постоянные ошибки (400/401/403) отдаём сразу: повтор их не исправит, а время
 * и деньги потратит.
 *
 * makeText — async-функция: делает запрос к модели и возвращает текст ответа.
 * validate(parsed) — необязательная проверка содержимого: вернула false →
 *   попытка считается неудачной и (если остались) делается повтор.
 *
 * Если и повтор не помог — бросаем Error с человеческим message, .status
 * (по умолчанию 502) и .code = "generationFailed": по этому коду клиент
 * показывает СВОЙ локализованный текст, а не серверную строку.
 */
export async function requestModelJson(makeText, options = {}) {
  const { errorMessage, status = 502, retries = 1, validate } = options;
  let lastErr = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const parsed = parseModelJson(await makeText());
      if (validate && !validate(parsed)) {
        lastErr = new Error("Модель вернула пустой или негодный ответ.");
        continue; // пустой результат — та же неудача, пробуем ещё раз
      }
      return parsed;
    } catch (err) {
      lastErr = err;
      // Ошибка разбора — без .status (её бросает parseModelJson): повторяем.
      // Ошибка запроса — с .status: повторяем только временные.
      const isParseFailure = err?.status === undefined;
      if (!isParseFailure && !isTransient(err)) throw err;
    }
  }

  const err = new Error(
    errorMessage || "Не удалось разобрать ответ модели. Попробуйте ещё раз.",
  );
  err.status = status;
  err.code = "generationFailed";
  err.cause = lastErr;
  throw err;
}
