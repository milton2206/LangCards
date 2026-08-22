// ============================================================================
// ПРОВЕРКА УДАРЕНИЯ В ГРЕЧЕСКОЙ ТРАНСКРИПЦИИ — ОТБРАКОВКА.
//
// Тонос в греческом слове однозначно указывает ударный слог, а транскрипция
// отмечает ударение ЗАГЛАВНЫМИ. Значит, две пометки можно сверить механически:
// «πρόβλημα» → [prov-LEE-ma] — тонос на первом слоге, заглавные на втором,
// то есть приложение учит неверному ударению.
//
// КАРТОЧКА С РАСХОЖДЕНИЕМ БРАКУЕТСЯ и к пользователю не попадает. Основание:
// на 700 карточках бэкапа проверка дала НОЛЬ ложных срабатываний, то есть
// здоровых карточек не теряем. Покрытие около 19% греческих карточек (нужны и
// тонос, и слоговая разбивка) — это не «мало пользы», а пятая часть случаев
// даром; остальное держит правило чтения в промпте.
//
// ЧЕГО ПРОВЕРКА НЕ ВИДИТ, и это надо знать: фразы (у них несколько ударений —
// сравнивать первое с последним бессмысленно, поэтому берём только однословные
// записи), транскрипции без разбивки на слоги и без заглавных, а также сам
// ВЫБОР ЗВУКА: [KO-ta] вместо [KEE-ta] по ударению безупречно. Против
// побуквенного чтения работает правило промпта (GREEK_READING).
// ============================================================================

// Диграфы читаются ОДНИМ звуком, в том числе с тоносом на второй букве
// (ού, αύ, εί). Диерезис (ϊ ΐ ϋ ΰ) диграф РАЗБИВАЕТ и сюда не попадает.
const DIGRAPH = /(?:[αά][ιί]|[εέ][ιί]|[οό][ιί]|[οό][υύ]|[αά][υύ]|[εέ][υύ]|[ηή][υύ]|[υύ][ιί])/g;
const GREEK_VOWEL = /[αάεέηήιίϊΐοόυύϋΰωώ]/;
const TONOS = /[άέήίΐόύΰώ]/;
// Гласные транскрипции, включая латиницу с диакритикой: без неё «políː» и
// «áːvrio» считались бы односложными.
const TR_VOWELS = /[aeiouáéíóúàèìòùâêîôûäëïöüāēīōū]+/gi;

const clean = (v) => String(v ?? "").trim().replace(/^\[|\]$/g, "").trim();

/** Слогов в греческом слове и номер ударного (по тоносу); 0 — тоноса нет. */
export function greekSyllables(word) {
  const marked = String(word)
    .toLowerCase()
    .replace(/[^\u0370-\u03FF\u1F00-\u1FFF]/g, "")
    .replace(DIGRAPH, (m) => (TONOS.test(m) ? "\u0001" : "\u0002"));
  let count = 0;
  let stress = 0;
  for (const ch of marked) {
    if (ch === "\u0001" || ch === "\u0002" || GREEK_VOWEL.test(ch)) {
      count += 1;
      if (ch === "\u0001" || TONOS.test(ch)) stress = count;
    }
  }
  return { count, stress };
}

/** Слогов в транскрипции и номер слога, записанного ЗАГЛАВНЫМИ; 0 — таких нет. */
export function translitSyllables(value) {
  let count = 0;
  let stress = 0;
  for (const part of clean(value).split(/[\s·-]+/)) {
    const groups = part.match(TR_VOWELS) || [];
    if (groups.length === 0) continue;
    const letters = part.replace(/[^\p{L}]/gu, "");
    const isUpper =
      letters && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
    if (isUpper && stress === 0) stress = count + 1;
    count += groups.length;
  }
  return { count, stress };
}

/**
 * Расходится ли ударение в транскрипции с тоносом. Возвращает null, если
 * судить не о чем (не греческий, фраза, нет тоноса, нет заглавных или слоги
 * посчитались по-разному — тогда сравнивать номера бессмысленно).
 */
export function stressMismatch(learnLang, word, translit) {
  if (learnLang !== "el") return null;
  const w = String(word ?? "").trim();
  // Только однословные: у фразы ударений несколько.
  if (!w || /\s/.test(w.replace(/[;·?]+$/, ""))) return null;
  const a = greekSyllables(w);
  const b = translitSyllables(translit);
  if (!a.count || !b.count || a.count !== b.count) return null;
  if (!a.stress || !b.stress || a.stress === b.stress) return null;
  return { word: w, translit: clean(translit), tonos: a.stress, caps: b.stress, syllables: a.count };
}
