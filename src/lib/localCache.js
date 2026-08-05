// Локальный кэш, привязанный к аккаунту (офлайн-first PWA).
//
// localStorage остаётся рабочим офлайн-кэшем прогресса (wordsByPair и т.д.,
// см. wordSync.js/cloudWords.js — они не меняются). Здесь — вспомогательные
// ключи фазы 4.2: последняя выбранная языковая пара (восстанавливается при
// загрузке, в т.ч. офлайн), «владелец» кэша (чей прогресс лежит на устройстве)
// и очистка кэша при выходе из аккаунта / отказе от переноса.

const ACTIVE_PAIR_KEY = "activeLangPair"; // { learnLang, nativeLang }
const OWNER_KEY = "cacheOwner"; // id пользователя, которому принадлежит кэш
const TUTORIAL_KEY = "tutorialSeen"; // старый ОБЩИЙ флаг (см. hasSeenTutorial)

// Старые «плоские» ключи слов (до разделения по парам). Их всё ещё подхватывает
// loadStore() в useWordLists и переносит в wordsByPair, поэтому для вопросов
// «есть ли что переносить» и «очистить прогресс» они РАВНОЗНАЧНЫ wordsByPair:
// не учтёшь — предложение о переносе не покажется, а слова потом появятся; не
// удалишь — «начать с чистого листа» вернёт их при следующей загрузке.
const LEGACY_WORD_KEYS = [
  "takenWords",
  "knownWords",
  "skippedWords",
  "wordInfo",
];

// Ключи локального ПРОГРЕССА (слова/карточки) — то, что нельзя оставлять
// на устройстве после выхода из аккаунта. sessionProgress тоже здесь: это
// снимок сегодняшнего занятия («Повторение · N»), без слов он врёт.
const PROGRESS_KEYS = [
  "wordsByPair",
  "cardsByPair",
  "wordsSyncDirty",
  "sessionProgress",
  ...LEGACY_WORD_KEYS,
];

// Ключи НАСТРОЙКИ: что человек выбрал в онбординге и рядом с ним. Отделены от
// прогресса, потому что при переносе ведут себя иначе — слова аккаунт унаследовать
// может (по согласию), а выбор языка/темы/уровня с ничейного устройства ему не
// принадлежит: его человек делает сам (см. clearLocalSetup).
const SETUP_KEYS = [
  ACTIVE_PAIR_KEY,
  TUTORIAL_KEY,
  "settings",
  "generateMode",
  "generateCount",
];

// Всё состояние приложения, привязанное к аккаунту/пользователю. Сюда входит и
// старый общий tutorialSeen: он относится к ЧЕЛОВЕКУ, а не к устройству, и на
// устройстве, сменившем владельца, значить ничего не должен (новый флаг —
// персональный, tutorialSeen:<userId>, и этой чисткой не затрагивается).
const ACCOUNT_KEYS = [...PROGRESS_KEYS, ...SETUP_KEYS, OWNER_KEY];

// ---------- Последняя выбранная языковая пара ----------

export function loadActivePair() {
  try {
    const raw = localStorage.getItem(ACTIVE_PAIR_KEY);
    const pair = raw ? JSON.parse(raw) : null;
    return pair && pair.learnLang && pair.nativeLang ? pair : null;
  } catch {
    return null;
  }
}

export function saveActivePair(pair) {
  try {
    localStorage.setItem(
      ACTIVE_PAIR_KEY,
      JSON.stringify({ learnLang: pair.learnLang, nativeLang: pair.nativeLang }),
    );
  } catch {
    // ignore — офлайн-восстановление просто не сработает
  }
}

// ---------- Владелец кэша (для предложения о переносе прогресса) ----------

export function getCacheOwner() {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}

export function setCacheOwner(userId) {
  try {
    localStorage.setItem(OWNER_KEY, userId);
  } catch {
    // ignore
  }
}

// Есть ли на устройстве РЕАЛЬНЫЕ слова, которые можно перенести в аккаунт.
// Считаем только членство в списках: пустые пары, заготовки карточек и
// сохранённые описания слов (wordInfo) переносить нечего — по ним предлагать
// перенос было бы предложением ни о чём.
function listLen(value) {
  return Array.isArray(value) ? value.length : 0;
}

export function hasLocalProgress() {
  try {
    const store = JSON.parse(localStorage.getItem("wordsByPair") || "{}");
    const inPairs =
      store &&
      typeof store === "object" &&
      Object.values(store).some(
        (p) =>
          listLen(p?.takenWords) +
            listLen(p?.knownWords) +
            listLen(p?.skippedWords) >
          0,
      );
    if (inPairs) return true;
    // Плюс старые «плоские» списки: их loadStore() превратит в слова пары.
    return ["takenWords", "knownWords", "skippedWords"].some((key) => {
      const raw = localStorage.getItem(key);
      return raw ? listLen(JSON.parse(raw)) > 0 : false;
    });
  } catch {
    return false;
  }
}

// ---------- Флаг «короткий туториал просмотрен» ----------
// Туториал показывается один раз ЧЕЛОВЕКУ, поэтому флаг привязан к аккаунту
// (tutorialSeen:<userId>), а не к устройству. Раньше ключ был один на браузер —
// и новый пользователь, вошедший на этом же устройстве (например, по ссылке
// подтверждения email), наследовал чужой «уже видел» и знакомства не получал.
//
// Наследство: старый общий ключ tutorialSeen засчитываем ВЛАДЕЛЬЦУ кэша (или
// когда владельца нет вовсе) и сразу переписываем в персональный — иначе те, кто
// давно прошёл туториал, увидели бы его снова. Чужому пользователю он не
// достаётся: на смене владельца кэш чистится целиком (clearAccountCache).

function tutorialKeyFor(userId) {
  return `${TUTORIAL_KEY}:${userId}`;
}

export function hasSeenTutorial(userId) {
  try {
    // Без аккаунта (Supabase не настроен) флаг остаётся общим для устройства.
    if (!userId) return Boolean(localStorage.getItem(TUTORIAL_KEY));
    if (localStorage.getItem(tutorialKeyFor(userId))) return true;
    const legacy = localStorage.getItem(TUTORIAL_KEY);
    const owner = getCacheOwner();
    // Строго ВЛАДЕЛЬЦУ кэша. «Владельца нет» засчитывать нельзя: ровно так
    // выглядит ничейное устройство, которое сейчас забирает себе НОВЫЙ человек, —
    // он унаследовал бы чужое «уже видел» и остался без знакомства.
    if (legacy && owner === userId) {
      localStorage.setItem(tutorialKeyFor(userId), "1");
      localStorage.removeItem(TUTORIAL_KEY);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function markTutorialSeen(userId) {
  try {
    localStorage.setItem(userId ? tutorialKeyFor(userId) : TUTORIAL_KEY, "1");
  } catch {
    // ignore — в худшем случае знакомство предложится ещё раз
  }
}

// ---------- Очистка ----------

// «Начать с чистого листа»: убрать локальный прогресс перед первой синхронизацией.
export function clearLocalProgress() {
  for (const key of PROGRESS_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

// Забыть НАСТРОЙКУ устройства (язык/тема/уровень, активная пара, общий флаг
// туториала). Зовётся, когда аккаунт забирает себе ничейное устройство: что бы
// человек ни выбрал про слова, настраивается он сам — через онбординг и
// знакомство. Прогресс эта чистка не трогает.
export function clearLocalSetup() {
  for (const key of SETUP_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}

// Выход из аккаунта (и смена владельца устройства): чистим ВСЁ привязанное к
// пользователю, чтобы чужие настройки и прогресс не остались на устройстве.
// userId передаётся только когда аккаунта больше не будет (удаление): тогда
// убираем и его персональный флаг туториала. При обычном выходе флаг остаётся —
// тот же человек, вернувшись, знакомство заново не проходит.
export function clearAccountCache(userId = null) {
  const keys = userId ? [...ACCOUNT_KEYS, tutorialKeyFor(userId)] : ACCOUNT_KEYS;
  for (const key of keys) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
