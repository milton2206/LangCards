// ============================================================================
// ПРОВЕРКА УДАРЕНИЯ В ГРЕЧЕСКОЙ ТРАНСКРИПЦИИ — ОТБРАКОВКА.
//
// Тонос в греческом слове однозначно указывает ударный слог, а транскрипция
// отмечает ударение ЗАГЛАВНЫМИ. Значит, две пометки можно сверить механически:
// «πρόβλημα» → [prov-LEE-ma] — тонос на первом слоге, заглавные на втором,
// то есть приложение учит неверному ударению.
//
// КАРТОЧКА С РАСХОЖДЕНИЕМ БРАКУЕТСЯ и к пользователю не попадает. Основание:
// на 700 карточках бэкапа проверка даёт НОЛЬ ложных срабатываний.
//
// ФРАЗЫ СВЕРЯЮТСЯ ПОСЛОВНО. У фразы ударений столько же, сколько знаменательных
// слов, поэтому сравнивать «первое ударение с последним» бессмысленно — а вот
// слово с его же куском транскрипции сравнить можно. Режем обе стороны по
// пробелам и сверяем токен с токеном. Замер по бэкапу: 211 фраз из 233 (91%)
// делятся на одинаковое число токенов; на них проверка дала 4 срабатывания, и
// все четыре — настоящие ошибки того же класса, что нашёл тестер
// (προβλήματα → [pro-vli-MA-ta] вместо [pro-VLI-ma-ta]). Пословная сверка
// подняла покрытие с 19% греческих карточек примерно до 85%.
//
// ЧЕГО ПРОВЕРКА НЕ ВИДИТ: фразы, у которых число токенов не совпало (22 из
// 233 — слова слиты дефисом или артикль пропущен); транскрипции без разбивки
// на слоги и без заглавных; и сам ВЫБОР ЗВУКА — [KO-ta] вместо [KEE-ta] по
// ударению безупречно. Против побуквенного чтения работает правило промпта.
// ============================================================================

// Диграфы читаются ОДНИМ звуком, в том числе с тоносом на второй букве
// (ού, αύ, εί). Диерезис (ϊ ΐ ϋ ΰ) диграф РАЗБИВАЕТ и сюда не попадает.
const DIGRAPH = /(?:[αά][ιί]|[εέ][ιί]|[οό][ιί]|[οό][υύ]|[αά][υύ]|[εέ][υύ]|[ηή][υύ]|[υύ][ιί])/g;
const GREEK_VOWEL = /[αάεέηήιίϊΐοόυύϋΰωώ]/;
const TONOS = /[άέήίΐόύΰώ]/;
// Гласные транскрипции, включая латиницу с диакритикой: без неё «políː» и
// «áːvrio» считались бы односложными.
const TR_VOWELS = /[aeiouáéíóúàèìòùâêîôûäëïöüāēīōū]+/gi;
// Острый акцент — ВТОРОЙ способ пометить ударение в транскрипции («FTE-rá»).
// Нужен, чтобы поймать карточки, где акцент и заглавные указывают на РАЗНЫЕ
// слоги: такая карточка противоречит сама себе, и «заявленного» ударения у
// неё нет — сверять не с чем.
const ACUTE = /[áéíóúÁÉÍÓÚ]/;

// Метки, которыми диграф подменяется на один «слог». Латиница здесь безопасна:
// строка перед этим очищена до греческих букв, латинских в ней быть не может.
const PLAIN_DIGRAPH = "V";
const STRESSED_DIGRAPH = "W";

const clean = (value) => String(value ?? "").trim().replace(/^\[|\]$/g, "").trim();

/** Слогов в греческом слове и номер ударного (по тоносу); 0 — тоноса нет. */
export function greekSyllables(word) {
  const marked = String(word)
    .toLowerCase()
    .replace(/[^Ͱ-Ͽἀ-῿]/g, "")
    .replace(DIGRAPH, (m) => (TONOS.test(m) ? STRESSED_DIGRAPH : PLAIN_DIGRAPH));
  let count = 0;
  let stress = 0;
  for (const ch of marked) {
    if (ch === PLAIN_DIGRAPH || ch === STRESSED_DIGRAPH || GREEK_VOWEL.test(ch)) {
      count += 1;
      if (ch === STRESSED_DIGRAPH || TONOS.test(ch)) stress = count;
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

/** Номер слога, помеченного острым акцентом, либо 0. */
function acuteSyllable(token) {
  let count = 0;
  for (const part of String(token).split("-")) {
    for (const group of part.match(TR_VOWELS) || []) {
      count += 1;
      if (ACUTE.test(group)) return count;
    }
  }
  return 0;
}

/**
 * Сверка ОДНОГО слова с его куском транскрипции. Возвращает описание
 * расхождения либо null, если судить не о чем.
 */
function tokenMismatch(greekToken, translitToken) {
  const a = greekSyllables(greekToken);
  const b = translitSyllables(translitToken);
  // Нет слогов, слоги разошлись или нет одной из пометок — номер слога
  // сопоставлять не с чем. Односложные греческие слова тоноса не несут по
  // правилам орфографии (ναι, δεν, φως) и отсеиваются этим же условием.
  if (!a.count || !b.count || a.count !== b.count) return null;
  if (!a.stress || !b.stress) return null;
  // Заглавные и острый акцент спорят — «заявленного» ударения у карточки нет.
  const acute = acuteSyllable(translitToken);
  if (acute && acute !== b.stress) return null;
  if (a.stress === b.stress) return null;
  return { tonos: a.stress, caps: b.stress, syllables: a.count };
}

/**
 * Расходится ли ударение в транскрипции с тоносом. Возвращает описание первого
 * найденного расхождения или null, если сверять не с чем.
 *
 * Работает и на одном слове, и на фразе: одно слово — это просто один токен.
 */
export function stressMismatch(learnLang, word, translit) {
  if (learnLang !== "el") return null;
  const whole = String(word ?? "").trim().replace(/[;·?!]+$/, "");
  if (!whole) return null;
  const greekTokens = whole.split(/\s+/).filter(Boolean);
  const translitTokens = clean(translit).split(/\s+/).filter(Boolean);
  // Число токенов не совпало — слова слиты дефисом или артикль пропущен.
  // Сопоставить слово с его куском транскрипции нельзя, поэтому молчим:
  // бракуя по догадке, теряли бы годные карточки.
  if (!greekTokens.length || greekTokens.length !== translitTokens.length) return null;
  for (let i = 0; i < greekTokens.length; i += 1) {
    const off = tokenMismatch(greekTokens[i], translitTokens[i]);
    if (off) {
      return {
        // Слово-нарушитель и его кусок транскрипции — для лога; phrase нужен,
        // чтобы во фразе было видно, о какой карточке речь.
        word: greekTokens[i],
        translit: translitTokens[i],
        phrase: greekTokens.length > 1 ? whole : null,
        ...off,
      };
    }
  }
  return null;
}
