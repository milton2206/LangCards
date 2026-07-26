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

/**
 * Запрашивает у модели JSON с надёжным разбором и ОДНИМ повтором при неудаче
 * разбора. makeText — async-функция: делает запрос к модели и возвращает текст
 * ответа. Ошибку самого запроса (сеть/ключ/квота) НЕ глушим и не повторяем — у
 * неё свой смысл и часто свой .status. При провале разбора после повтора бросаем
 * Error с человеческим message и .status (по умолчанию 502).
 */
export async function requestModelJson(makeText, options = {}) {
  const { errorMessage, status = 502, retries = 1 } = options;
  let lastErr = null;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const text = await makeText();
    try {
      return parseModelJson(text);
    } catch (err) {
      lastErr = err;
      // Осталась попытка — перезапросим модель (частый фикс «грязного» ответа).
    }
  }
  const err = new Error(
    errorMessage || "Не удалось разобрать ответ модели. Попробуйте ещё раз.",
  );
  err.status = status;
  err.cause = lastErr;
  throw err;
}
