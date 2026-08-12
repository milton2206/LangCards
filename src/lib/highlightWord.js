// Модуль намеренно БЕЗ зависимостей: это чистая работа с текстом, её зовут на
// каждый рендер. Начальную форму (её знает только кэш спряжений) вызывающий
// передаёт функцией lemmaOf — тянуть сюда клиент Supabase ради подсветки нельзя.

// Убирает распространённые артикли/детерминативы в начале слова, чтобы
// выделять именно смысловое ядро: "der Chef" -> "Chef", "η δουλειά" -> "δουλειά".
const ARTICLE_RE =
  /^(der|die|das|den|dem|des|ein|eine|einen|einem|einer|the|a|an|to|el|la|los|las|un|una|unos|unas|ο|η|το|οι|τα|των|του|της|τον|την)\s+/iu;

// Смысловое ядро слова (без артикля). Экспортируется — режим чтения (фаза 6.1)
// помечает им уже знакомые слова в тексте.
export function coreWord(word) {
  return String(word).replace(ARTICLE_RE, "").trim();
}

/**
 * Разбивает текст на сегменты для рендера с тапабельными словами:
 * [{ text, isWord }]. Слова (isWord: true) — токены из букв/апострофов/дефисов,
 * остальное (пробелы, знаки препинания) — обычные сегменты между ними.
 */
export function splitWords(text) {
  const re = /[\p{L}\p{M}][\p{L}\p{M}'-]*/gu;
  const segments = [];
  let last = 0;
  let m;
  while ((m = re.exec(text))) {
    if (m.index > last) {
      segments.push({ text: text.slice(last, m.index), isWord: false });
    }
    segments.push({ text: m[0], isWord: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    segments.push({ text: text.slice(last), isWord: false });
  }
  return segments;
}

// Разбивает текст на слова-токены с их позициями в исходной строке.
// Экспортируется как sentenceWords: расширение просмотра слова до оборота
// считает границы по НОМЕРАМ слов предложения (см. useWordLookup).
export function tokenize(text) {
  const re = /[\p{L}\p{M}][\p{L}\p{M}'-]*/gu;
  const tokens = [];
  let m;
  while ((m = re.exec(String(text ?? "")))) {
    tokens.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return tokens;
}

export { tokenize as sentenceWords };

/**
 * Кусок предложения от слова from до слова to ВКЛЮЧИТЕЛЬНО — как в оригинале,
 * вместе со знаками и пробелами внутри («putting it off», «не всё, что»).
 * Индексы за границами прижимаются к краям: расширять дальше предложения нельзя.
 */
export function sliceByWords(text, from, to) {
  const src = String(text ?? "");
  const words = tokenize(src);
  if (words.length === 0) return "";
  const clamp = (i) => Math.max(0, Math.min(i, words.length - 1));
  return src.slice(words[clamp(from)].start, words[clamp(to)].end);
}

function commonPrefixLen(a, b) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i += 1;
  return i;
}

const lower = (value) => String(value ?? "").trim().toLowerCase();

// Служебные слова, которые есть в заголовочной фразе, но в живом предложении
// стоят иначе или отсутствуют вовсе: «to put SOMETHING off» → «putting it off».
// Их пропускаем при сопоставлении, иначе фраза не найдётся никогда.
const FILLER_RE =
  /^(to|the|a|an|sich|jemanden|jemandem|jemand|etwas|something|someone|somebody|sth|smb|se|lo|la|el|los|las|ο|η|το|οι|τα)$/iu;

/**
 * Одна ли это словоформа. Точной морфологии тут нет и не нужно: сравниваем по
 * общей основе, чтобы ловить «feel → feeling», «Kaffee → Kaffees», «καφές →
 * καφέ». Требуем заметное совпадение начала и не даём словам разъезжаться
 * хвостом, иначе «morning» начнёт совпадать с «morgen».
 */
function sameForm(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const prefix = commonPrefixLen(a, b);
  const minLen = Math.min(a.length, b.length);
  const maxLen = Math.max(a.length, b.length);
  if (minLen < 3 || prefix < 3) return false;
  return prefix >= Math.ceil(minLen * 0.7) && maxLen - prefix <= 4;
}

/**
 * Совпадают ли слова ПО НАЧАЛЬНОЙ ФОРМЕ. lemmaOf — функция вызывающего; сейчас
 * это уже накопленный индекс спряжений (кнопка «Формы»), сети за ней нет.
 * Это единственный способ связать формы с разной основой: ging ↔ gehen.
 */
function sameLemma(lemmaOf, a, b) {
  if (typeof lemmaOf !== "function") return false;
  // "" (точно не глагол) и null (ничего не знаем) одинаково бесполезны.
  const la = lower(lemmaOf(a));
  if (!la) return false;
  const lb = lower(lemmaOf(b));
  return Boolean(lb) && la === lb;
}

// Насколько хорошо токен предложения соответствует искомому слову.
// Точное совпадение важнее совпадения по лемме, лемма — важнее общей основы:
// так при нескольких кандидатах подсветится самый очевидный.
function scoreToken(tokenText, target, lemmaOf) {
  const a = lower(tokenText);
  const b = lower(target);
  if (a === b) return 1000;
  if (sameLemma(lemmaOf, a, b)) return 800;
  if (sameForm(a, b)) return 500 + commonPrefixLen(a, b);
  return 0;
}

// Однословное ядро: берём лучший по соответствию токен предложения.
function findWordRange(example, core, lemmaOf) {
  let best = null;
  for (const t of tokenize(example)) {
    const score = scoreToken(t.text, core, lemmaOf);
    if (score > 0 && (!best || score > best.score)) {
      best = { start: t.start, end: t.end, score };
    }
  }
  return best ? [best.start, best.end] : null;
}

// Между словами фразы в живом предложении может вклиниться пара чужих слов:
// «put it off», «feeling really sick». Больше двух — уже не та фраза.
const MAX_PHRASE_GAP = 2;

/**
 * Ядро из нескольких слов (фразовые глаголы, устойчивые обороты). Ищем не
 * подстроку, а ПОСЛЕДОВАТЕЛЬНОСТЬ словоформ: слова фразы должны встретиться
 * по порядку, каждое — в любой своей форме, с небольшими промежутками.
 * Подсвечиваем найденный фрагмент целиком, от первого слова до последнего.
 */
function findPhraseRange(example, core, lemmaOf) {
  const wanted = tokenize(core)
    .map((t) => lower(t.text))
    .filter((w) => w && !FILLER_RE.test(w));
  if (wanted.length === 0) return null;
  if (wanted.length === 1) return findWordRange(example, wanted[0], lemmaOf);

  const tokens = tokenize(example);
  for (let start = 0; start < tokens.length; start += 1) {
    if (!scoreToken(tokens[start].text, wanted[0], lemmaOf)) continue;

    let matched = 1;
    let lastIdx = start;
    for (
      let i = start + 1;
      i < tokens.length && matched < wanted.length && i - lastIdx - 1 <= MAX_PHRASE_GAP;
      i += 1
    ) {
      if (scoreToken(tokens[i].text, wanted[matched], lemmaOf)) {
        lastIdx = i;
        matched += 1;
      }
    }
    if (matched === wanted.length) {
      return [tokens[start].start, tokens[lastIdx].end];
    }
  }
  return null;
}

/**
 * Ищет в предложении диапазон [start, end), который стоит выделить как
 * «то самое слово». Возвращает null, если ничего похожего не нашли.
 */
function findHighlightRange(example, word, lemmaOf) {
  const core = coreWord(word);
  if (!core) return null;
  return core.includes(" ")
    ? findPhraseRange(example, core, lemmaOf)
    : findWordRange(example, core, lemmaOf);
}

/**
 * Разбивает предложение на сегменты для рендера с выделением изучаемого
 * слова: [{ text, highlight }].
 *
 * Слово ищется ПО ФОРМЕ, а не по строке: артикль у заголовочного слова
 * отбрасывается, словоформы сопоставляются по основе, многословная фраза
 * ищется как последовательность форм и подсвечивается целиком.
 *
 * lemmaOf (необязателен) — функция (форма) → начальная форма | "" | null.
 * Включает сверку по начальной форме: только ею ловятся формы с другой основой
 * (ging ↔ gehen). Сейчас это уже накопленный индекс спряжений.
 *
 * Не нашли ВООБЩЕ — возвращаем предложение одним невыделенным сегментом:
 * карточка работает как обычно, просто без подсветки. Это последняя линия, а
 * не нормальный путь.
 */
export function highlightWordInExample(example, word, lemmaOf = null) {
  if (!example) return [];
  const range = word ? findHighlightRange(example, word, lemmaOf) : null;
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
