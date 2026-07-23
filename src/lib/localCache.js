// Локальный кэш, привязанный к аккаунту (офлайн-first PWA).
//
// localStorage остаётся рабочим офлайн-кэшем прогресса (wordsByPair и т.д.,
// см. wordSync.js/cloudWords.js — они не меняются). Здесь — вспомогательные
// ключи фазы 4.2: последняя выбранная языковая пара (восстанавливается при
// загрузке, в т.ч. офлайн), «владелец» кэша (чей прогресс лежит на устройстве)
// и очистка кэша при выходе из аккаунта / отказе от переноса.

const ACTIVE_PAIR_KEY = "activeLangPair"; // { learnLang, nativeLang }
const OWNER_KEY = "cacheOwner"; // id пользователя, которому принадлежит кэш

// Ключи локального ПРОГРЕССА (слова/карточки) — то, что нельзя оставлять
// на устройстве после выхода из аккаунта.
const PROGRESS_KEYS = ["wordsByPair", "cardsByPair", "wordsSyncDirty"];

// Всё состояние приложения, привязанное к аккаунту/пользователю. tutorialSeen
// намеренно не чистим — туториал не персональные данные.
const ACCOUNT_KEYS = [
  ...PROGRESS_KEYS,
  ACTIVE_PAIR_KEY,
  OWNER_KEY,
  "settings",
  "generateMode",
  "generateCount",
];

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

// Есть ли на устройстве непустой локальный прогресс (анонимный wordsByPair).
export function hasLocalProgress() {
  try {
    const store = JSON.parse(localStorage.getItem("wordsByPair") || "{}");
    return Object.values(store).some(
      (p) =>
        (p?.takenWords?.length || 0) +
          (p?.knownWords?.length || 0) +
          (p?.skippedWords?.length || 0) >
        0,
    );
  } catch {
    return false;
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

// Выход из аккаунта: чистим ВСЁ привязанное к пользователю, чтобы чужой
// прогресс не остался на устройстве.
export function clearAccountCache() {
  for (const key of ACCOUNT_KEYS) {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  }
}
