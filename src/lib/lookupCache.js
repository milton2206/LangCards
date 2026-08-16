import { sameWordEntry } from "../../lib/highlightWord.js";

// ============================================================================
// Карточки слов, полученные за ЭТУ сессию (тап по слову + прогрев текста).
// ----------------------------------------------------------------------------
// Живёт в памяти, в localStorage НЕ пишем: данные временные, а хранилище и так
// нагружено словами, текстами и снимками занятия. Модуль общий, поэтому кэш
// один на всё приложение: прогретое в чтении открывается и по тапу в примере
// на карточке, и наоборот.
//
// Ключ — слово + языковая пара: «Rechnung» для de-ru и de-uk это разные карточки.
// Обороты сюда НЕ попадают: их перевод зависит от предложения, и кэшировать его
// по одной лишь фразе значило бы подсунуть чужой контекст.
// ============================================================================

const LIMIT = 200;
const cards = new Map(); // "de-ru|rechnungen" → карточка

const lower = (value) => String(value ?? "").trim().toLowerCase();

function keyFor(learnLang, nativeLang, word) {
  return `${learnLang}-${nativeLang}|${lower(word)}`;
}

function put(learnLang, nativeLang, word, card) {
  const clean = lower(word);
  if (!clean || !card) return;
  // Простое ограничение сверху: выбрасываем самую старую запись. Карточки
  // крошечные, но расти без предела памяти всё равно незачем.
  if (cards.size >= LIMIT) cards.delete(cards.keys().next().value);
  cards.set(keyFor(learnLang, nativeLang, clean), card);
}

/**
 * Запомнить карточку. asked — слово, КАК ЕГО СПРОСИЛИ (в тексте оно стоит в
 * форме: «Rechnungen»), card.word — словарная запись («die Rechnung»). Кладём
 * под обоими ключами: тап по слову из текста должен попадать сразу, без перебора.
 */
export function rememberLookupCard(learnLang, nativeLang, asked, card) {
  if (!card || !card.word) return;
  put(learnLang, nativeLang, card.word, card);
  if (asked) put(learnLang, nativeLang, asked, card);
}

/**
 * Карточка из кэша: сначала точное совпадение, потом — по форме (тем же
 * sameWordEntry, что и везде в приложении). Перебор идёт по кэшу, а он мал
 * (LIMIT записей) и только своей языковой пары.
 */
export function getLookupCard(learnLang, nativeLang, word) {
  const clean = lower(word);
  if (!clean) return null;
  const exact = cards.get(keyFor(learnLang, nativeLang, clean));
  if (exact) return exact;

  const prefix = `${learnLang}-${nativeLang}|`;
  for (const [key, card] of cards) {
    if (!key.startsWith(prefix)) continue;
    if (sameWordEntry(clean, key.slice(prefix.length))) return card;
  }
  return null;
}

/** Есть ли уже карточка для слова (для отбора слов в прогрев). */
export function hasLookupCard(learnLang, nativeLang, word) {
  return Boolean(getLookupCard(learnLang, nativeLang, word));
}
