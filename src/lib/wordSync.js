// Слияние двух хранилищ слов (wordsByPair) — чистая функция, без сети и React.
// Используется при синхронизации: объединяет данные с разных устройств так,
// чтобы НИЧЕГО не потерять (union членства + самый прогрессивный SRS + примеры).
//
// Форма хранилища: { "de-ru": { takenWords, knownWords, skippedWords,
// wordInfo: {word:{translit,translation,example,exampleTranslation}},
// srsByWord: {word:{interval,nextReviewDate,ease,repetitions,lastReviewed}} }, ... }

function uniq(list) {
  return [...new Set(list)];
}

// wordInfo: для каждого слова берём наиболее полные поля (непустые побеждают).
function mergeInfo(aInfo = {}, bInfo = {}) {
  const out = {};
  const words = new Set([...Object.keys(aInfo), ...Object.keys(bInfo)]);
  for (const w of words) {
    const a = aInfo[w] || {};
    const b = bInfo[w] || {};
    out[w] = {
      translit: b.translit || a.translit || "",
      translation: b.translation || a.translation || "",
      example: b.example || a.example || "",
      exampleTranslation: b.exampleTranslation || a.exampleTranslation || "",
    };
  }
  return out;
}

// Какая SRS-запись «дальше» по прогрессу: больше повторов → позднее следующая
// дата → позднее последний повтор. Так при конкурентных правках сохраняется
// более продвинутый прогресс, а не затирается.
function moreProgressedSrs(a, b) {
  if (!a) return b;
  if (!b) return a;
  const ra = a.repetitions ?? 0;
  const rb = b.repetitions ?? 0;
  if (ra !== rb) return ra > rb ? a : b;
  const na = a.nextReviewDate || "";
  const nb = b.nextReviewDate || "";
  if (na !== nb) return na > nb ? a : b;
  const la = a.lastReviewed || "";
  const lb = b.lastReviewed || "";
  return la >= lb ? a : b;
}

function mergeSrs(aSrs = {}, bSrs = {}, takenWords) {
  const out = {};
  for (const w of takenWords) {
    const merged = moreProgressedSrs(aSrs[w], bSrs[w]);
    if (merged) out[w] = merged;
  }
  return out;
}

function mergePair(a = {}, b = {}) {
  // «Знаю» — терминальный статус, поэтому имеет приоритет над «взято»/«пропущено».
  const known = uniq([...(a.knownWords || []), ...(b.knownWords || [])]);
  const knownSet = new Set(known);

  const taken = uniq([
    ...(a.takenWords || []),
    ...(b.takenWords || []),
  ]).filter((w) => !knownSet.has(w));
  const takenSet = new Set(taken);

  // skipped: дедуп по слову, оставляем более позднюю дату возврата; выкидываем
  // слова, которые уже взяты или известны.
  const skipMap = new Map();
  for (const s of [...(a.skippedWords || []), ...(b.skippedWords || [])]) {
    if (!s || !s.word) continue;
    if (knownSet.has(s.word) || takenSet.has(s.word)) continue;
    const existing = skipMap.get(s.word);
    if (!existing || (s.returnDate || "") > (existing.returnDate || "")) {
      skipMap.set(s.word, s);
    }
  }

  return {
    takenWords: taken,
    knownWords: known,
    skippedWords: [...skipMap.values()],
    wordInfo: mergeInfo(a.wordInfo, b.wordInfo),
    srsByWord: mergeSrs(a.srsByWord, b.srsByWord, taken),
  };
}

/**
 * Объединяет два хранилища по всем языковым парам. Симметрично по членству
 * (union), не удаляет данные — используется при первом входе (миграция локальных
 * слов) и при конкурентных правках, чтобы не потерять прогресс.
 */
export function mergeWordData(a = {}, b = {}) {
  const pairs = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  const out = {};
  for (const pair of pairs) {
    out[pair] = mergePair(a[pair], b[pair]);
  }
  return out;
}
