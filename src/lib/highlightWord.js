// Убирает распространённые артикли/детерминативы в начале слова, чтобы
// выделять именно смысловое ядро: "der Chef" -> "Chef", "η δουλειά" -> "δουλειά".
const ARTICLE_RE =
  /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|the|a|an|to|el|la|los|las|un|una|unos|unas|ο|η|το|οι|τα|των|του|της|τον|την)\s+/iu;

function coreWord(word) {
  return word.replace(ARTICLE_RE, "").trim();
}

const LETTER_RE = /[\p{L}\p{M}]/u;

// Разбивает текст на слова-токены с их позициями в исходной строке.
function tokenize(text) {
  const re = /[\p{L}\p{M}][\p{L}\p{M}'-]*/gu;
  const tokens = [];
  let m;
  while ((m = re.exec(text))) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

// Для однословного ядра ищем лучший по совпадению токен в предложении:
// точное совпадение — лучший вариант; иначе — словоформа с почти тем же
// префиксом (отличается максимум последней буквой), чтобы ловить и
// добавленные окончания (Kaffee -> Kaffees), и другие падежные формы
// (греч. καφές -> καφέ, где меняется сама концовка, а не только длина).
function findWordRange(example, core) {
  const lowerCore = core.toLowerCase();
  const tokens = tokenize(example);

  let best = null;
  for (const t of tokens) {
    const tw = t.text.toLowerCase();
    let score = 0;
    if (tw === lowerCore) {
      score = 1000;
    } else {
      const prefix = commonPrefixLen(tw, lowerCore);
      const minLen = Math.min(tw.length, lowerCore.length);
      if (minLen >= 3 && prefix >= 3 && prefix >= minLen - 1) {
        score = 500 + prefix;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { start: t.start, end: t.end, score };
    }
  }

  return best ? [best.start, best.end] : null;
}

// Для ядра из нескольких слов (фразовые глаголы вроде "to check in") ищем
// точное вхождение фразы как подстроки — падежных склонений тут не бывает.
function findPhraseRange(example, core) {
  const lowerExample = example.toLowerCase();
  const lowerCore = core.toLowerCase();

  let boundaryIdx = -1;
  let firstIdx = -1;
  let searchFrom = 0;
  for (;;) {
    const found = lowerExample.indexOf(lowerCore, searchFrom);
    if (found === -1) break;
    if (firstIdx === -1) firstIdx = found;
    const prevChar = found > 0 ? example[found - 1] : "";
    if (!prevChar || !LETTER_RE.test(prevChar)) {
      boundaryIdx = found;
      break;
    }
    searchFrom = found + 1;
  }

  const idx = boundaryIdx !== -1 ? boundaryIdx : firstIdx;
  if (idx === -1) return null;

  let end = idx + core.length;
  while (end < example.length && LETTER_RE.test(example[end])) {
    end += 1;
  }
  return [idx, end];
}

/**
 * Ищет в предложении диапазон [start, end), который стоит выделить как
 * «то самое слово». Возвращает null, если ничего похожего не нашли.
 */
function findHighlightRange(example, word) {
  const core = coreWord(word);
  if (!core) return null;
  return core.includes(" ")
    ? findPhraseRange(example, core)
    : findWordRange(example, core);
}

/**
 * Разбивает предложение на сегменты для рендера с выделением изучаемого
 * слова: [{ text, highlight }]. Если найти слово в примере не удалось,
 * возвращает предложение одним невыделенным сегментом (без выделения, но
 * без ошибок) — так и должно быть, если данные ИИ не совпали дословно.
 */
export function highlightWordInExample(example, word) {
  if (!example) return [];
  const range = word ? findHighlightRange(example, word) : null;
  if (!range) return [{ text: example, highlight: false }];

  const [start, end] = range;
  const segments = [];
  if (start > 0) {
    segments.push({ text: example.slice(0, start), highlight: false });
  }
  segments.push({ text: example.slice(start, end), highlight: true });
  if (end < example.length) {
    segments.push({ text: example.slice(end), highlight: false });
  }
  return segments;
}
