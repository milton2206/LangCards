import { tokenize, sameWordEntry } from "../../lib/highlightWord.js";
import { requestLookupCards } from "./manualCard.js";
import { hasLookupCard, rememberLookupCard } from "./lookupCache.js";

// ============================================================================
// ПРОГРЕВ ПЕРЕВОДОВ ТЕКСТА (режим чтения).
// ----------------------------------------------------------------------------
// Тап по слову ждут мгновенно, а карточка от модели идёт несколько секунд.
// Локальные карточки закрывают только часть тапов — тапают как раз по
// незнакомому. Поэтому, как только текст показан, одним ФОНОВЫМ вызовом
// собираем карточки для слов, которых у человека нет: пока он читает заголовок
// и первые строки, переводы уже готовы.
//
// Это ДЕШЕВЛЕ, а не дороже: один вызов на текст вместо N вызовов по тапам.
//
// Прогрев молчалив: не блокирует чтение, ничего не показывает и при любой
// неудаче просто ничего не делает — тап тогда сработает как раньше.
// ============================================================================

// Сколько слов греем на один текст. Тексты бывают до 8 предложений, незнакомых
// слов там набирается два-три десятка — карточки на все это тяжёлый и долгий
// ответ модели. Двенадцать — размер обычной пачки карточек, он проверен, и его
// хватает на первые экраны текста, дальше добирается по тапу.
export const MAX_WARM_WORDS = 12;

// Ради одного-двух слов запрос не стоит затевать: выигрыш в один тап не стоит
// вызова модели и единицы суточного лимита.
export const MIN_WARM_WORDS = 3;

// Совсем короткие токены — это почти всегда служебные слова и обрывки.
const MIN_WORD_LEN = 3;

// ---------- Служебные слова ----------
// По ним не тапают (артикли, предлоги, союзы, местоимения, вспомогательные
// глаголы), а место в запросе они заняли бы. Готового частотного списка в
// проекте нет, а тянуть словарь частотности ради этого — лишняя зависимость:
// закрытый список служебных слов на наши пять языков решает ту же задачу и
// читается глазами. Всё, что не служебное, считаем смысловым — по длине и
// частотности не фильтруем.
const STOP_WORDS = {
  de: `der die das den dem des ein eine einen einem einer eines und oder aber
    denn sondern doch nicht kein keine keinen keinem ich du er sie es wir ihr
    mich dich sich uns euch mir dir ihm ihn ihnen mein dein sein ihre unser
    in an auf aus bei mit nach seit von vor zu zur zum durch für gegen ohne um
    über unter zwischen hinter neben ist sind war waren bin bist sein haben hat
    habe hast hatte hatten werden wird wurde wurden worden kann kannst können
    muss musst müssen soll sollen will willst wollen darf dürfen mag mögen
    als wie wenn dass weil ob damit also schon noch nur auch sehr mehr hier da
    dort jetzt dann man sich es`,
  en: `the a an and or but so nor for yet i you he she it we they me him her us
    them my your his its our their this that these those is are was were be been
    being am do does did done have has had will would can could shall should
    may might must not no yes of in on at by with from into over under about
    after before between during through to too as if then than there here when
    where why how what which who whom while very just only also more most some
    any each every both few many much such own same s t`,
  el: `ο η το οι τα του της των τον την τους τις ένα ένας μια μία μιας και κι ή
    αλλά όμως γιατί δεν δε μην μη είναι ήταν είμαι είσαι είμαστε είστε έχω έχεις
    έχει έχουμε έχετε έχουν θα να που πως ως σαν αν όταν εγώ εσύ αυτός αυτή αυτό
    εμείς εσείς αυτοί μου σου του μας σας τους με σε από για προς παρά κατά μετά
    πριν χωρίς μέσα έξω πάνω κάτω πολύ πιο ακόμα μόνο επίσης εδώ εκεί τώρα τότε`,
  es: `el la los las un una unos unas y o pero sino porque que no ni sí se me te
    le lo nos os les mi tu su sus mis tus nuestro vuestro yo tú él ella nosotros
    vosotros ellos ellas es son era eran soy eres somos sois estoy está están
    he has ha hemos han había ser estar tener hacer de del al a en con por para
    sin sobre entre hasta desde tras como cuando donde porque muy más menos ya
    también solo aquí allí ahora entonces`,
  ru: `и а но или да же ли бы не ни в во на за под над при о об от до из к ко с
    со у по про для без через между я ты он она оно мы вы они меня тебя его её
    нас вас их мне тебе ему ей нам вам им мой твой свой наш ваш этот тот такой
    весь это то как что чтобы если когда где куда почему потому уже ещё только
    также тут там теперь тогда быть был была были есть нет очень более менее
    себя сам такие эти`,
};

const STOP_SETS = Object.fromEntries(
  Object.entries(STOP_WORDS).map(([lang, list]) => [
    lang,
    new Set(list.split(/\s+/).filter(Boolean)),
  ]),
);

// Тексты, которые уже грели в этой сессии: повторный заход на тот же текст
// (а экран показывает последний текст при каждом открытии) не должен снова
// дёргать модель. Живёт в памяти — на новую сессию прогреем заново.
const warmed = new Set();

const lower = (value) => String(value ?? "").trim().toLowerCase();

function textSignature(learnLang, nativeLang, sentences) {
  const head = (sentences || [])
    .map((s) => s?.text || "")
    .join(" ")
    .slice(0, 200);
  return `${learnLang}-${nativeLang}|${head}`;
}

/**
 * Какие слова текста стоит греть: смысловые (не служебные), которых у человека
 * ещё нет — ни своей карточкой (wordInfo), ни в кэше этой сессии.
 *
 * Сравнение по формам — общий sameWordEntry: в тексте слово стоит в форме, а
 * своя карточка лежит словарной записью («Rechnungen» ↔ «die Rechnung»).
 * Порядок сохраняем как в тексте: читают с начала, туда и тапают раньше.
 *
 * Чистая функция — её поведение проверяется без сети.
 */
export function pickWordsToWarm({
  sentences = [],
  wordInfo = null,
  learnLang,
  nativeLang,
  limit = MAX_WARM_WORDS,
}) {
  const stop = STOP_SETS[learnLang] || new Set();
  const own = Object.keys(wordInfo || {});
  const picked = [];
  const seen = new Set();

  for (const sentence of sentences) {
    for (const token of tokenize(sentence?.text || "")) {
      const word = token.text;
      const key = lower(word);
      if (key.length < MIN_WORD_LEN || stop.has(key) || seen.has(key)) continue;
      seen.add(key);
      // Уже есть своя карточка (взятое, известное или просто показанное слово)
      // либо карточка этой сессии — греть незачем, тап и так мгновенный.
      if (own.some((entry) => sameWordEntry(word, entry))) continue;
      if (hasLookupCard(learnLang, nativeLang, word)) continue;
      picked.push(word);
      if (picked.length >= limit) return picked;
    }
  }
  return picked;
}

/**
 * Прогреть переводы для показанного текста. Ничего не возвращает и никогда не
 * бросает: это фоновая оптимизация, а не часть чтения.
 *
 * Не греем: офлайн; слов набралось меньше MIN_WARM_WORDS; этот текст уже грели
 * в этой сессии.
 */
export function warmTextLookups({
  sentences = [],
  wordInfo = null,
  learnLang,
  nativeLang,
}) {
  if (!learnLang || !nativeLang || !Array.isArray(sentences) || sentences.length === 0) {
    return;
  }
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;

  const signature = textSignature(learnLang, nativeLang, sentences);
  if (warmed.has(signature)) return;

  const words = pickWordsToWarm({ sentences, wordInfo, learnLang, nativeLang });
  if (words.length < MIN_WARM_WORDS) return;

  // Помечаем ДО запроса: пока он идёт, экран может перерисоваться, и второй
  // такой же вызов был бы прямой тратой лимита.
  warmed.add(signature);

  (async () => {
    const cards = await requestLookupCards({ learnLang, nativeLang, words });
    // Карточка приходит в словарной форме, а тапнут по той, что в тексте.
    // Раскладываем по обоим ключам: ищем для каждой карточки слово, которое
    // её вызвало (тем же сравнением по формам).
    const rest = [...words];
    for (const card of cards) {
      if (!card || !card.word) continue;
      const i = rest.findIndex((w) => sameWordEntry(w, card.word));
      const asked = i >= 0 ? rest.splice(i, 1)[0] : null;
      rememberLookupCard(learnLang, nativeLang, asked, card);
    }
  })().catch(() => {
    // Тихо: прогрев не обязателен. Слово доспросится по тапу, как раньше.
    // Метку не снимаем — иначе каждый рендер экрана повторял бы неудачу.
  });
}
