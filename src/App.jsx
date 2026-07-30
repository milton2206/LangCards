import { useState, useEffect, useRef, useMemo } from "react";
import { Analytics } from "@vercel/analytics/react";
import { I18nProvider } from "./i18n/I18nContext.jsx";
import { translate } from "./i18n/index.js";
import AppShell from "./components/AppShell.jsx";
import StartScreen from "./screens/StartScreen.jsx";
import OnboardingScreen from "./screens/OnboardingScreen.jsx";
import MigrateScreen from "./screens/MigrateScreen.jsx";
import CardScreen from "./screens/CardScreen.jsx";
import MyWordsScreen from "./screens/MyWordsScreen.jsx";
import AddWordScreen from "./screens/AddWordScreen.jsx";
import ReadingScreen from "./screens/ReadingScreen.jsx";
import ListeningScreen from "./screens/ListeningScreen.jsx";
import SessionScreen from "./screens/SessionScreen.jsx";
import PlacementScreen from "./screens/PlacementScreen.jsx";
import KnownWordsScreen from "./screens/KnownWordsScreen.jsx";
import KnownReviewScreen from "./screens/KnownReviewScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import LanguagesScreen from "./screens/LanguagesScreen.jsx";
import ReviewScreen from "./screens/ReviewScreen.jsx";
import StatsScreen from "./screens/StatsScreen.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";
import ResetPasswordScreen from "./screens/ResetPasswordScreen.jsx";
import Tutorial from "./components/Tutorial.jsx";
import WhatsNew from "./components/WhatsNew.jsx";
import {
  EMPTY_SETTINGS,
  SETTINGS_KEYS,
  ONBOARDING_STEPS,
} from "./data/onboarding.js";
import { sanitizeTopic } from "../lib/topicSanitize.js";
import { useWordLists, getDueWords } from "./hooks/useWordLists.js";
import { useCards } from "./hooks/useCards.js";
import { useAuth } from "./hooks/useAuth.js";
import { useUserLanguages } from "./hooks/useUserLanguages.js";
import {
  addUserLanguage,
  deactivateNonPriorityLanguages,
  setPriorityLanguage,
  updateUserLanguage,
  removeUserLanguage,
  savePlacementLevel,
  MAX_CUSTOM_TOPICS,
} from "./lib/userLanguages.js";
import { computeDailyQuotas } from "./lib/dailyBalance.js";
import { buildSession } from "./lib/sessionEngine.js";
import {
  loadSessionProgress,
  saveSessionProgress,
} from "./lib/sessionProgress.js";
import {
  buildWeeklySchedule,
  todayScheduledPair,
  scheduleSignature,
  reconcileSchedule,
} from "./lib/weeklySchedule.js";
import {
  loadActivePair,
  saveActivePair,
  getCacheOwner,
  setCacheOwner,
  hasLocalProgress,
  clearLocalProgress,
  clearAccountCache,
} from "./lib/localCache.js";
import { loadGenerateCount } from "./lib/generateCount.js";
import { loadGenerateMode } from "./lib/generateMode.js";
import {
  loadListeningLevel,
  saveListeningLevel,
  loadListeningMode,
  saveListeningMode,
  loadListeningFormat,
  saveListeningFormat,
} from "./lib/listeningLevels.js";
import { prewarmTts } from "./lib/ttsClient.js";
import { deleteAccountRequest } from "./lib/accountClient.js";
import { sendFeedback } from "./lib/feedbackClient.js";
import {
  captureSignupSource,
  touchLastSeen,
  recordSignupSource,
} from "./lib/presence.js";
import { resolveWhatsNew } from "./lib/whatsNew.js";

// Id тем-пресетов и запасная тема: когда выбранная своя тема удалена или
// принадлежит другой паре, откатываемся к пресету, чтобы генерация не осталась
// с несуществующей темой. Пресеты всегда в коде — их набор фиксирован.
const PRESET_TOPIC_OPTIONS = ONBOARDING_STEPS.find(
  (s) => s.key === "topic",
).options;
const PRESET_TOPIC_IDS = new Set(PRESET_TOPIC_OPTIONS.map((o) => o.id));
const FALLBACK_TOPIC = PRESET_TOPIC_OPTIONS[0].id;

function loadSettings() {
  try {
    const raw = localStorage.getItem("settings");
    return raw ? JSON.parse(raw) : EMPTY_SETTINGS;
  } catch {
    return EMPTY_SETTINGS;
  }
}

export default function App() {
  // Настройки: тема и уровень живут здесь (localStorage); языковая часть с
  // фазы 4.2 переехала в user_languages, а learnLang/nativeLang в settings —
  // офлайн-зеркало активной пары (язык интерфейса + работа без сети).
  const [settings, setSettings] = useState(loadSettings);
  const settingsComplete = SETTINGS_KEYS.every((k) => settings[k]);

  // Главный экран — «занятие» (движок заданий показывает план на сегодня).
  // Ручной хаб карточек остаётся по «Хочу другое».
  const [screen, setScreen] = useState(settingsComplete ? "session" : "start");

  // Аккаунты (Supabase Auth). С фазы 4.2 вход ОБЯЗАТЕЛЕН: без аккаунта дальше
  // start/auth не пускаем. Если Supabase не настроен (dev без env) — гейт
  // невозможен, работаем по-старому локально.
  const auth = useAuth();
  const authRequired = auth.configured;

  // Языки пользователя из user_languages + явный флаг мультирежима.
  const userLangs = useUserLanguages(auth.user);

  // ---------- Перенос локального прогресса при первом входе ----------
  // Если на устройстве лежит анонимный (без владельца) непустой wordsByPair,
  // а пользователь входит впервые — спрашиваем, переносить ли его в аккаунт.
  // До ответа синхронизация слов придержана (holdSync ниже).
  const [migrationAsk, setMigrationAsk] = useState(false);

  useEffect(() => {
    if (!auth.user) {
      setMigrationAsk(false);
      return;
    }
    const owner = getCacheOwner();
    if (owner === auth.user.id) return; // кэш уже принадлежит этому аккаунту
    if (owner) {
      // Чужой кэш (не должно случаться — при выходе чистим; на всякий случай):
      // молча убираем чужой прогресс и перезагружаемся с чистым состоянием.
      clearLocalProgress();
      setCacheOwner(auth.user.id);
      window.location.reload();
      return;
    }
    // Кэш анонимный: есть слова — спрашиваем, нет — просто присваиваем.
    if (hasLocalProgress()) setMigrationAsk(true);
    else setCacheOwner(auth.user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  function handleMigrateTransfer() {
    // Согласие: кэш становится кэшем аккаунта, holdSync снимается — initialSync
    // объединит локальное с облаком существующей логикой слияния (mergeWordData):
    // ничего не теряется и не дублируется.
    setCacheOwner(auth.user.id);
    setMigrationAsk(false);
  }

  function handleMigrateDiscard() {
    // «С чистого листа»: локальный прогресс удаляется, перезагрузка сбрасывает
    // состояние хуков (иначе слова из памяти вернулись бы при синхронизации).
    clearLocalProgress();
    setCacheOwner(auth.user.id);
    window.location.reload();
  }

  // ---------- Активная языковая пара (глобальное состояние) ----------
  // Источник — user_languages: при multiLangMode=false — приоритетная пара,
  // при true — последняя выбранная (localStorage, восстанавливается при
  // загрузке). Офлайн-фолбэк: сохранённый выбор, затем старые settings.
  const [chosenPair, setChosenPair] = useState(loadActivePair);

  // Недельное расписание (фаза 4.5): активно только в мультирежиме при
  // scheduleMode='by_day'. В учебный день активным становится язык дня;
  // dayOverridePair — сессионный «поверх расписания» выбор (переключатель или
  // «Позаниматься всё равно» в выходной), при перезагрузке возвращаемся к
  // расписанию — это осознанно мягкое поведение.
  const scheduleActive =
    userLangs.multiLangMode && userLangs.scheduleMode === "by_day";
  const [dayOverridePair, setDayOverridePair] = useState(null);
  const todayPairKey = scheduleActive
    ? todayScheduledPair(userLangs.weeklySchedule)
    : null;

  const activeLanguage = useMemo(() => {
    const langs = userLangs.languages;
    const findPair = (p) =>
      p &&
      langs.find(
        (l) => l.learnLang === p.learnLang && l.nativeLang === p.nativeLang,
      );
    if (langs.length > 0) {
      if (scheduleActive) {
        // Режим «по дням»: сессионный override → язык дня → приоритетная
        // (в выходной повторения идут по активной = приоритетной паре).
        const override = findPair(dayOverridePair);
        if (override) return override;
        const scheduled = langs.find(
          (l) => `${l.learnLang}-${l.nativeLang}` === todayPairKey,
        );
        if (scheduled) return scheduled;
        return userLangs.priorityLanguage;
      }
      if (userLangs.multiLangMode && chosenPair) {
        const found = findPair(chosenPair);
        if (found) return found;
      }
      return userLangs.priorityLanguage;
    }
    if (chosenPair) return chosenPair;
    if (settings.learnLang && settings.nativeLang) {
      return { learnLang: settings.learnLang, nativeLang: settings.nativeLang };
    }
    return null;
  }, [
    userLangs.languages,
    userLangs.multiLangMode,
    userLangs.priorityLanguage,
    scheduleActive,
    todayPairKey,
    dayOverridePair,
    chosenPair,
    settings.learnLang,
    settings.nativeLang,
  ]);

  const learnLang = activeLanguage?.learnLang || settings.learnLang;
  const nativeLang = activeLanguage?.nativeLang || settings.nativeLang;

  // pairKey строится из активной пары (а не из settings): все экраны и данные
  // (wordsByPair/cardsByPair) уже разделены по нему — смена пары переключает их
  // мгновенно. Логика повторения не меняется.
  const pairKey = activeLanguage
    ? `${activeLanguage.learnLang}-${activeLanguage.nativeLang}`
    : "";

  // Активная пара зеркалится в localStorage (восстановление при загрузке,
  // офлайн) и в settings (язык интерфейса + офлайн-кэш языковой части).
  useEffect(() => {
    if (!activeLanguage) return;
    saveActivePair(activeLanguage);
    setSettings((prev) =>
      prev.learnLang === activeLanguage.learnLang &&
      prev.nativeLang === activeLanguage.nativeLang
        ? prev
        : {
            ...prev,
            learnLang: activeLanguage.learnLang,
            nativeLang: activeLanguage.nativeLang,
          },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeLanguage?.learnLang, activeLanguage?.nativeLang]);

  // ---------- Тест на определение уровня (фаза 6.3) ----------
  // Тест идёт ПО ПАРЕ и запускается из трёх мест: онбординг, «Мои языки»
  // (новая пара), настройки («проверить уровень заново»). Контекст помнит,
  // куда вернуться и по какой паре мерили.
  //   { learnLang, nativeLang, returnTo: 'onboarding'|'languages'|'settings' }
  const [placement, setPlacement] = useState(null);
  // Черновик онбординга, если тест запущен прямо из него: после теста (или
  // отказа) возвращаемся к своим ответам, а не начинаем мастер заново.
  const [onboardingDraft, setOnboardingDraft] = useState(null);

  // Уровень активной пары: если по ней проходили тест, он и есть уровень
  // генерации. Пары независимы — немецкий B1 и греческий A1 нормальны. Пары
  // без теста (placementLevel = null) НЕ трогаем: у существующих пользователей
  // уровень остаётся тем, что они выбрали руками.
  useEffect(() => {
    const level = activeLanguage?.placementLevel;
    if (!level) return;
    setSettings((prev) =>
      prev.level === level ? prev : { ...prev, level },
    );
  }, [
    activeLanguage?.learnLang,
    activeLanguage?.nativeLang,
    activeLanguage?.placementLevel,
  ]);

  // Своя тема принадлежит паре. При переключении пары (или удалении темы)
  // выбранная тема может оказаться чужой/несуществующей — тогда откатываемся к
  // пресету, чтобы генерация не ушла с темой, которой у этой пары нет. Пресеты
  // валидны всегда. settings.topic в зависимостях НЕ держим намеренно: сброс
  // нужен на смену пары и её списка своих тем, а не на каждый выбор темы.
  useEffect(() => {
    const topic = settings.topic;
    if (!topic || PRESET_TOPIC_IDS.has(topic)) return;
    const own = activeLanguage?.customTopics || [];
    if (!own.includes(topic)) {
      setSettings((prev) => ({ ...prev, topic: FALLBACK_TOPIC }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    activeLanguage?.learnLang,
    activeLanguage?.nativeLang,
    activeLanguage?.customTopics,
  ]);

  // Слова: синхронизация придержана, пока не решён вопрос переноса прогресса.
  const vocab = useWordLists(pairKey, auth.user, { holdSync: migrationAsk });
  const { cards, loading, error, generate, clearError } = useCards(pairKey);

  // Сколько карточек генерировать за раз — сохраняется между сессиями.
  const [generateCount, setGenerateCount] = useState(loadGenerateCount);
  useEffect(() => {
    localStorage.setItem("generateCount", String(generateCount));
  }, [generateCount]);

  // Тип контента: обычные слова или «Контекст носителей» (идиомы/фразы).
  const [generateMode, setGenerateMode] = useState(loadGenerateMode);
  useEffect(() => {
    localStorage.setItem("generateMode", generateMode);
  }, [generateMode]);

  // Сложность аудирования (фаза 6.2): скорость речи + длина фразы. Как и
  // количество карточек, выбор сохраняется между сессиями.
  const [listeningLevel, setListeningLevel] = useState(loadListeningLevel);
  useEffect(() => {
    saveListeningLevel(listeningLevel);
  }, [listeningLevel]);

  // Режим аудирования: понимание (диалог + вопросы) — ОСНОВНОЙ — или слова
  // (старые форматы). Сохраняется между сессиями.
  const [listeningMode, setListeningMode] = useState(loadListeningMode);
  useEffect(() => {
    saveListeningMode(listeningMode);
  }, [listeningMode]);

  // Формат «слов» внутри режима слов: «пропущенное слово» или «на слух».
  // Умолчание зависит от уровня (на высоких — сразу «на слух»), дальше
  // главенствует выбор пользователя.
  const [listeningFormat, setListeningFormat] = useState(() =>
    loadListeningFormat(settings.level),
  );
  useEffect(() => {
    saveListeningFormat(listeningFormat);
  }, [listeningFormat]);

  // Слова, которым сегодня пора на повтор (отдельно от потока новых карточек).
  const dueWords = getDueWords(vocab.takenWords, vocab.srsByWord, vocab.todayKey);

  // ---------- Недельная раскладка (фаза 4.5) + ручное редактирование ----------
  // Раскладка заполняется АВТОМАТИЧЕСКИ как стартовая, но дни можно менять
  // вручную (см. WeekSchedule editable в LanguagesScreen). Поэтому авто-пересчёт
  // НЕ делаем на каждом заходе (иначе ручные правки затирались бы): пересчёт —
  // только при РЕАЛЬНОМ изменении набора языков / приоритета / числа дней
  // (сигнатура), и при пересчёте ручные правки сохраняются (reconcileSchedule).
  const scheduleSigRef = useRef(null);
  const autoBaselineRef = useRef(null);
  useEffect(() => {
    if (!scheduleActive || userLangs.loading || userLangs.languages.length === 0) {
      return;
    }
    const sig = scheduleSignature(
      userLangs.languages,
      userLangs.studyDaysPerWeek,
    );
    const auto = buildWeeklySchedule(
      userLangs.languages,
      userLangs.studyDaysPerWeek,
    );
    const current = userLangs.weeklySchedule || {};

    // Первый заход при этом наборе языков: если расписания ещё нет — кладём
    // стартовую авто-раскладку; если уже есть (возможно, с ручными правками) —
    // НЕ трогаем. Запоминаем сигнатуру и авто-базу для будущего сравнения.
    if (scheduleSigRef.current === null) {
      if (Object.keys(current).length === 0) {
        userLangs.updateSchedulePrefs({ weeklySchedule: auto });
      }
      scheduleSigRef.current = sig;
      autoBaselineRef.current = auto;
      return;
    }

    // Набор языков/дней не изменился (просто перезаход/перерендер) — ничего не
    // пересчитываем, ручные правки остаются как есть.
    if (sig === scheduleSigRef.current) return;

    // Реальное изменение набора: пересчитываем, СОХРАНЯЯ валидные ручные правки.
    const activeKeys = new Set(
      userLangs.languages.map((l) => `${l.learnLang}-${l.nativeLang}`),
    );
    const merged = reconcileSchedule(
      current,
      autoBaselineRef.current || {},
      auto,
      activeKeys,
    );
    if (JSON.stringify(merged) !== JSON.stringify(current)) {
      userLangs.updateSchedulePrefs({ weeklySchedule: merged });
    }
    scheduleSigRef.current = sig;
    autoBaselineRef.current = auto;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    scheduleActive,
    userLangs.loading,
    userLangs.languages,
    userLangs.studyDaysPerWeek,
  ]);

  // ---------- Баланс дневной нагрузки (фаза 4.3) ----------
  // Ветка scheduleMode='mixed': квоты новых слов по активным парам. При
  // 'by_day' полоса не показывается (вместо неё обзор недели), а лимитом
  // служит собственный daily_new_limit языка дня (см. activeBalance ниже).
  // «Взято сегодня» считает useWordLists по takenDate. Повторения (SRS) в
  // норму не входят и не режутся никогда.
  const dailyBalance = useMemo(() => {
    if (
      !userLangs.multiLangMode ||
      userLangs.scheduleMode !== "mixed" ||
      userLangs.languages.length === 0
    ) {
      return null;
    }
    const quotas = computeDailyQuotas(userLangs.languages);
    return userLangs.languages.map((l) => {
      const key = `${l.learnLang}-${l.nativeLang}`;
      const taken = vocab.takenTodayByPair[key] || 0;
      const quota = quotas[key] || 0;
      return {
        learnLang: l.learnLang,
        nativeLang: l.nativeLang,
        pairKey: key,
        taken,
        quota,
        done: taken >= quota,
      };
    });
  }, [
    userLangs.multiLangMode,
    userLangs.scheduleMode,
    userLangs.languages,
    vocab.takenTodayByPair,
  ]);

  // Выходной по расписанию: сегодня язык не назначен и override не выбран.
  const restDay = Boolean(
    scheduleActive &&
      Object.values(userLangs.weeklySchedule || {}).some(Boolean) &&
      !todayPairKey &&
      !dayOverridePair,
  );

  // Лимит новых слов активной пары на сегодня:
  //   'mixed' — квота из разбивки 4.3; 'by_day' — собственный daily_new_limit
  //   языка, выпавшего сегодня (или выбранного поверх расписания).
  const activeBalance = useMemo(() => {
    if (dailyBalance) {
      return dailyBalance.find((b) => b.pairKey === pairKey) || null;
    }
    if (scheduleActive && !restDay && activeLanguage) {
      const lang = userLangs.languages.find(
        (l) =>
          l.learnLang === activeLanguage.learnLang &&
          l.nativeLang === activeLanguage.nativeLang,
      );
      if (!lang) return null;
      const quota = Math.max(1, Number(lang.dailyNewLimit) || 10);
      const taken = vocab.takenTodayByPair[pairKey] || 0;
      return { pairKey, quota, taken, done: taken >= quota };
    }
    return null;
  }, [
    dailyBalance,
    scheduleActive,
    restDay,
    activeLanguage,
    userLangs.languages,
    vocab.takenTodayByPair,
    pairKey,
  ]);

  const quotaExhausted = Boolean(activeBalance && activeBalance.done);

  // ---------- Онлайн-статус (доступность форматов в занятии) ----------
  const [online, setOnline] = useState(
    typeof navigator === "undefined" || navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // ---------- Движок заданий: занятие на сегодня ----------
  // Уровней нагрузки нет: база адекватна сама по себе, «ещё» — через добавки.
  // День второстепенного языка — только в мультирежиме by_day, когда сегодня НЕ
  // приоритетная пара. Одноязычный режим и mixed — всегда полная программа.
  const isSecondaryDay = Boolean(
    scheduleActive &&
      activeLanguage &&
      userLangs.priorityLanguage &&
      (activeLanguage.learnLang !== userLangs.priorityLanguage.learnLang ||
        activeLanguage.nativeLang !== userLangs.priorityLanguage.nativeLang),
  );

  // Дневная норма новых слов активной пары. Фолбэк — константа (не generateCount):
  // движок сам меняет размер порции генерации под блок «новые слова», а норма от
  // неё зависеть не должна, иначе была бы обратная связь (норма ← порция ← норма).
  const sessionDailyNewLimit = Math.max(
    1,
    Number(activeLanguage?.dailyNewLimit) || 10,
  );

  // Доступность форматов: без сети текст/диалог не сгенерировать — молча
  // пропускаем; диалог требует активных слов.
  const readingAvailable = online && !restDay;
  const listeningAvailable =
    online && !restDay && vocab.takenWords.length > 0;

  // Счётчик дня для ротации акцента базы (целое число дней по локальной дате):
  // сегодня один формат ведущий, завтра другой — «как игра, а не одно и то же».
  const sessionRotationDay = Math.floor(
    (Date.parse(vocab.todayKey) || Date.now()) / 86400000,
  );

  // Прогресс занятия на СЕГОДНЯ (см. sessionProgress.js): снимок числа созревших
  // на начало дня + ручные отметки + события завершения чтения/аудио. Живёт на
  // день и на пару, сбрасывается на новый день сам. sessionBlock — тип блока,
  // открытого ИЗ занятия (null — вручную): по нему возврат знает, вести к плану
  // или в ручной хаб.
  const [sessionProgress, setSessionProgress] = useState(() =>
    loadSessionProgress(pairKey, vocab.todayKey),
  );
  const [sessionBlock, setSessionBlock] = useState(null);
  const [sessionSentences, setSessionSentences] = useState(null);
  const [sessionQuestions, setSessionQuestions] = useState(null);
  // Акцент дня «новые слова» → случайные слова / «Удиви меня»: подсказка хабу.
  const [sessionRandom, setSessionRandom] = useState(false);

  // Смена дня или пары: перечитываем прогресс (пустой на новый день) и, если
  // снимок числа созревших ещё не сделан, снимаем его — чтобы подпись
  // «Повторение · N» не «плыла» по мере повторения.
  useEffect(() => {
    const p = loadSessionProgress(pairKey, vocab.todayKey);
    if (p.reviewTarget == null) {
      p.reviewTarget = dueWords.length;
      saveSessionProgress(pairKey, vocab.todayKey, p);
    }
    setSessionProgress(p);
    setSessionBlock(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey, vocab.todayKey]);

  function persistProgress(next) {
    setSessionProgress(next);
    saveSessionProgress(pairKey, vocab.todayKey, next);
  }

  const reviewTarget = sessionProgress.reviewTarget || 0;

  const sessionPlan = useMemo(
    () =>
      buildSession({
        reviewCount: reviewTarget,
        dailyNewLimit: sessionDailyNewLimit,
        isSecondaryDay,
        restDay,
        readingAvailable,
        listeningAvailable,
        rotationDay: sessionRotationDay,
      }),
    [
      reviewTarget,
      sessionDailyNewLimit,
      isSecondaryDay,
      restDay,
      readingAvailable,
      listeningAvailable,
      sessionRotationDay,
    ],
  );

  const sessionNewTarget =
    sessionPlan.blocks.find((b) => b.type === "newWords")?.count || 0;

  // Автоматическая выполненность блока — из РЕАЛЬНЫХ данных/событий, а не из
  // факта захода на экран: повторение — не осталось созревших; новые слова —
  // взято сегодня не меньше цели (в т.ч. если взял заранее вне движка); чтение/
  // аудио — есть событие «ответил на вопросы».
  const takenTodayForPair = vocab.takenTodayByPair?.[pairKey] || 0;
  function autoDoneFor(type) {
    if (type === "review") return dueWords.length === 0;
    if (type === "newWords")
      return sessionNewTarget > 0 && takenTodayForPair >= sessionNewTarget;
    if (type === "reading") return Boolean(sessionProgress.events?.reading);
    if (type === "listening") return Boolean(sessionProgress.events?.listening);
    return false;
  }
  // Итоговый статус: ручная отметка ПЕРЕКРЫВАЕТ авто (тот же чекбокс).
  function isBlockDone(type) {
    const manual = sessionProgress.marks?.[type];
    return manual === undefined ? autoDoneFor(type) : manual;
  }
  const sessionDoneMap = Object.fromEntries(
    sessionPlan.blocks.map((b) => [b.type, isBlockDone(b.type)]),
  );

  // Ручная галочка: ставит/снимает статус блока (тот же чекбокс, что и авто).
  function toggleSessionBlock(type) {
    persistProgress({
      ...sessionProgress,
      marks: { ...sessionProgress.marks, [type]: !isBlockDone(type) },
    });
  }

  // Запуск блока: движок только выстраивает порядок и объём и открывает
  // СУЩЕСТВУЮЩИЙ экран — своих экранов не заводит.
  function startSessionBlock(block) {
    setSessionBlock(block.type);
    if (block.type === "review") setScreen("review");
    else if (block.type === "reading") {
      setSessionSentences(block.sentences || null);
      setScreen("reading");
    } else if (block.type === "listening") {
      setSessionQuestions(block.questions || null);
      setListeningMode("comprehension"); // блок аудирования — диалог с вопросами
      setScreen("listening");
    } else if (block.type === "newWords") {
      // Объём блока — размер порции генерации (сама генерация зажата суточным
      // лимитом в buildParams). Взятие слов идёт обычным потоком карточек.
      if (block.count > 0) setGenerateCount(block.count);
      // Акцент «новые слова» → случайные слова / «Удиви меня» (подсказка хабу).
      setSessionRandom(Boolean(block.random));
      setScreen("cards");
    }
  }

  // РЕАЛЬНОЕ завершение упражнения (вызывают сами экраны): чтение/аудио пишут
  // событие «ответил на вопросы» (в т.ч. пройденное вне движка отметит блок);
  // затем, если упражнение открывалось ИЗ занятия, возвращаемся к плану. Простой
  // заход и выход отметку НЕ ставит — это и есть исправление бага.
  function completeExercise(type) {
    if (type === "reading" || type === "listening") {
      persistProgress({
        ...sessionProgress,
        events: { ...sessionProgress.events, [type]: true },
      });
    }
    if (sessionBlock === type) {
      setSessionBlock(null);
      setScreen("session");
    }
  }

  // Возврат из блока к плану БЕЗ отметки (просто «назад»): отметка — только по
  // реальному завершению (completeExercise) или вручную (toggleSessionBlock).
  function exitSession() {
    setSessionBlock(null);
    setScreen("session");
  }

  // «Хочу другое»: ручной выбор формата (хаб карточек), вне логики занятия.
  function goManualHub() {
    setSessionBlock(null);
    setScreen("cards");
  }

  // Возврат из блочного экрана: открыт из занятия → к плану (без отметки), открыт
  // вручную (из хаба) → назад в хаб. Отметку ставит только реальное завершение.
  function handleSessionBack() {
    if (sessionBlock) exitSession();
    else setScreen("cards");
  }

  // Короткий туториал показывается ОДИН раз при первом запуске (по флагу).
  const [showTutorial, setShowTutorial] = useState(
    () => !localStorage.getItem("tutorialSeen"),
  );

  function closeTutorial() {
    setShowTutorial(false);
    try {
      localStorage.setItem("tutorialSeen", "1");
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify(settings));
  }, [settings]);

  // Заголовок вкладки браузера — на языке интерфейса (родной язык пользователя).
  useEffect(() => {
    document.title = translate(nativeLang, "start.title");
  }, [nativeLang]);

  // Гейт навигации: без аккаунта доступны только start/auth; после входа с
  // этих экранов уводим на карточки (онбординг/перенос перекроют при need).
  // Особый случай: пришли по недействительной ссылке сброса (recoveryError) —
  // сессии нет, ведём сразу на экран входа (там показывается сообщение), а не
  // на стартовый.
  useEffect(() => {
    if (authRequired && !auth.user) {
      if (auth.recoveryError) {
        if (screen !== "auth") setScreen("auth");
      } else if (screen !== "start" && screen !== "auth") {
        setScreen("start");
      }
    } else if (screen === "start" || screen === "auth") {
      setScreen("session");
    }
  }, [authRequired, auth.user, screen, auth.recoveryError]);

  // Выход из аккаунта: чистим локальный кэш (чужой прогресс не должен остаться
  // на устройстве) и перезагружаемся — все хуки стартуют с чистого состояния.
  async function handleSignOut() {
    await auth.signOut();
    clearAccountCache();
    window.location.reload();
  }
  const authForUi = { ...auth, signOut: handleSignOut };

  // ---------- Аналитика без внешних сервисов (фаза 7.1) ----------
  // Источник перехода захватываем при старте (?src/?ref/?utm_source), пока он
  // ещё в адресе; записываем в профиль позже, когда появится пользователь.
  useEffect(() => {
    captureSignupSource();
  }, []);

  // «Что нового» при заходе: считается ОДИН раз за сессию (ref-гейт), показывается
  // один раз и переходам по экранам не мешает. null — показывать нечего.
  const [whatsNew, setWhatsNew] = useState(null);
  const whatsNewCheckedRef = useRef(false);

  // Отметка захода + разовая запись источника. Эффект срабатывает, как только
  // становится известен пользователь — это ОБА случая: свежий логин (null → user)
  // и открытие с уже живой сессией (getSession в useAuth восстановил её:
  // undefined → user). Тихий best-effort.
  //
  // КРИТИЧНЫЙ ПОРЯДОК (иначе гонка): сперва СЧИТАТЬ старый last_seen и посчитать
  // «Что нового» (resolveWhatsNew), показать записи — и ТОЛЬКО ПОТОМ обновить
  // last_seen на текущее время (touchLastSeen). Если обновить раньше расчёта,
  // «Что нового» всегда увидит last_seen = «сейчас» и решит, что нового нет.
  useEffect(() => {
    if (!auth.user) return;
    const userId = auth.user.id;
    (async () => {
      // 1) Читаем СТАРЫЙ last_seen и решаем, что показать (один раз за сессию).
      if (!whatsNewCheckedRef.current) {
        whatsNewCheckedRef.current = true;
        const res = await resolveWhatsNew(userId);
        if (res) setWhatsNew(res);
      }
      // 2) И только теперь двигаем last_seen на now() (после расчёта выше).
      await touchLastSeen(userId);
      recordSignupSource(userId);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user?.id]);

  // Последний «содержательный» экран — контекст для отзыва (кнопка отзыва живёт
  // в настройках, но интересно, откуда пользователь на неё пришёл).
  const lastFeatureScreenRef = useRef("cards");
  useEffect(() => {
    if (screen !== "settings" && screen !== "auth" && screen !== "start") {
      lastFeatureScreenRef.current = screen;
    }
  }, [screen]);

  // ---------- Отзыв и удаление аккаунта (фаза 7.1) ----------
  // Отзыв: версию приложения и браузер добавляет feedbackClient; экран берём из
  // последнего содержательного экрана. Возвращает { ok, reason? } для UI.
  async function handleSendFeedback(text) {
    if (!auth.user) return { ok: false, reason: "not-configured" };
    return sendFeedback({
      userId: auth.user.id,
      text,
      screen: lastFeatureScreenRef.current,
    });
  }

  // Удаление аккаунта: сервер удаляет всё (см. api/account.js), затем чистим
  // устройство и перезагружаемся — пользователь попадает на стартовый экран.
  // Ошибку пробрасываем: её показывает окно подтверждения.
  async function handleDeleteAccount() {
    await deleteAccountRequest();
    clearLocalProgress();
    clearAccountCache();
    try {
      await auth.signOut();
    } catch {
      // сессия уже недействительна после удаления — это ожидаемо
    }
    window.location.reload();
  }

  // Онбординг нужен, пока нет активной пары или темы/уровня (после входа).
  const needsSetup = !activeLanguage || !settings.topic || !settings.level;

  // Параметры генерации: активная пара + тема/уровень из настроек + исключения.
  function buildParams({ random = false } = {}) {
    const deferred = vocab.skippedWords
      .filter((s) => (s.returnDate ?? "") > vocab.todayKey)
      .map((s) => s.word);
    // Порция не превышает остаток дневной нормы языка (только мультирежим).
    // Остаток 0 — пользователь идёт «сверх нормы» осознанно: не ограничиваем.
    let count = generateCount;
    if (activeBalance) {
      const remaining = activeBalance.quota - activeBalance.taken;
      if (remaining > 0 && remaining < count) count = remaining;
    }
    return {
      learnLang,
      nativeLang,
      topic: settings.topic,
      level: settings.level,
      exclude: [
        ...new Set([...vocab.takenWords, ...vocab.knownWords, ...deferred]),
      ],
      count,
      mode: generateMode,
      // «Удиви меня»: тема/уровень рандомизируются на сервере; языковая пара
      // (learnLang/nativeLang) остаётся как выбрана.
      random,
    };
  }

  // Была ли последняя генерация «случайной» («Удиви меня») — чтобы «Повторить»
  // на экране ошибки повторял именно её, а не молча обычную генерацию.
  const lastRandomRef = useRef(false);

  function handleGenerate() {
    lastRandomRef.current = false;
    generate(buildParams());
  }

  function handleGenerateRandom() {
    lastRandomRef.current = true;
    generate(buildParams({ random: true }));
  }

  function handleRetryGenerate() {
    generate(buildParams({ random: lastRandomRef.current }));
  }

  // Ручное добавление своего слова: готовую карточку кладём в изучение текущей
  // пары (takenWords + данные в wordInfo). take() возвращает false при достижении
  // лимита активных слов — тогда карточку не добавляем и сообщаем об этом в UI.
  function handleAddManualCard(card) {
    const ok = vocab.take(card.word);
    if (ok) {
      vocab.rememberCards([card]);
      // Прогрев озвучки в момент создания карточки (фаза 5.1).
      prewarmTts([card], learnLang);
    }
    return ok;
  }

  // Онбординг завершён: тема/уровень в settings, языковая пара — в
  // user_languages (первая пара станет приоритетной автоматически).
  // placementLevel задан, если уровень пришёл из теста (фаза 6.3) — тогда он
  // же записывается в пару, чтобы уровень жил по паре, а не глобально.
  async function handleComplete(chosen, placementLevel = null) {
    setSettings(chosen);
    setOnboardingDraft(null);
    const pair = { learnLang: chosen.learnLang, nativeLang: chosen.nativeLang };
    saveActivePair(pair);
    setChosenPair(pair);
    setScreen("session");
    if (auth.user) {
      await addUserLanguage(auth.user.id, pair.learnLang, pair.nativeLang, {
        isPriority: true,
      });
      if (placementLevel) {
        await savePlacementLevel(
          auth.user.id,
          pair.learnLang,
          pair.nativeLang,
          placementLevel,
        );
      }
      userLangs.reload();
    }
  }

  function updateSetting(key, id) {
    setSettings((prev) => ({ ...prev, [key]: id }));
    // Ручная правка уровня у пары, которая уже знает свой уровень (проходили
    // тест или правили результат), пишется в саму пару — иначе переключение
    // языков вернуло бы прежнее значение. Пары без теста не трогаем.
    if (key === "level" && auth.user && activeLanguage?.placementLevel) {
      (async () => {
        await savePlacementLevel(
          auth.user.id,
          activeLanguage.learnLang,
          activeLanguage.nativeLang,
          id,
        );
        userLangs.reload();
      })();
    }
  }

  // ---------- Свои темы активной пары ----------
  // Свои темы можно вести только когда есть пара и аккаунт (хранятся в
  // user_languages). Пресеты в этот список не входят и не ограничиваются.
  const activeCustomTopics = activeLanguage?.customTopics || [];
  const canManageTopics = Boolean(auth.user && activeLanguage);

  // Добавить свою тему: чистим/режем как на сервере, отбрасываем пустое и
  // дубликаты, держим лимит. Добавленную тему сразу делаем выбранной.
  async function handleAddCustomTopic(name) {
    if (!canManageTopics) return;
    const clean = sanitizeTopic(name);
    if (!clean) return;
    const current = activeLanguage.customTopics || [];
    const existing = current.find(
      (topic) => topic.toLowerCase() === clean.toLowerCase(),
    );
    if (existing) {
      updateSetting("topic", existing); // уже есть — просто выбираем её
      return;
    }
    if (current.length >= MAX_CUSTOM_TOPICS) return;
    const next = [...current, clean];
    await userLangs.updateCustomTopics(
      activeLanguage.learnLang,
      activeLanguage.nativeLang,
      next,
    );
    updateSetting("topic", clean);
  }

  // Удалить свою тему: пресеты не трогаются (их тут нет). Если удалили выбранную
  // тему — сброс на пресет сделает эффект валидации выше (customTopics изменится).
  async function handleRemoveCustomTopic(name) {
    if (!canManageTopics) return;
    const current = activeLanguage.customTopics || [];
    const next = current.filter((topic) => topic !== name);
    await userLangs.updateCustomTopics(
      activeLanguage.learnLang,
      activeLanguage.nativeLang,
      next,
    );
  }

  // ---------- Тест на уровень: запуск, применение, отказ ----------
  // Тест необязателен ВЕЗДЕ: с любого экрана из него можно выйти одним тапом,
  // и тогда уровень остаётся тем, что был (или выбирается руками).
  function handleStartPlacement(context) {
    setPlacement(context);
  }

  async function handleApplyPlacement(level) {
    const ctx = placement;
    setPlacement(null);
    if (!ctx) return;

    if (ctx.returnTo === "onboarding") {
      // Уровень из теста завершает онбординг вместо шага самооценки.
      await handleComplete({ ...ctx.draft, level }, level);
      return;
    }

    if (auth.user) {
      await savePlacementLevel(auth.user.id, ctx.learnLang, ctx.nativeLang, level);
      userLangs.reload();
    }
    // Если мерили активную пару — уровень сразу применяется к генерации.
    if (ctx.learnLang === learnLang && ctx.nativeLang === nativeLang) {
      setSettings((prev) => ({ ...prev, level }));
    }
    setScreen(ctx.returnTo === "settings" ? "settings" : "languages");
  }

  function handleCancelPlacement() {
    const ctx = placement;
    setPlacement(null);
    // Из онбординга возвращаемся к мастеру с сохранённым черновиком (шаг
    // уровня), с остальных экранов — туда, откуда пришли.
    if (ctx && ctx.returnTo !== "onboarding") {
      setScreen(ctx.returnTo === "settings" ? "settings" : "languages");
    }
  }

  // ---------- Обработчики экрана «Мои языки» (фаза 4.4) ----------

  // Одноязычный режим: новая пара ЗАМЕНЯЕТ единственную (приоритет → новой,
  // старая скрывается, прогресс в user_words сохраняется).
  async function handleReplaceSinglePair(pair) {
    saveActivePair(pair);
    setChosenPair(pair);
    setSettings((prev) => ({ ...prev, ...pair }));
    if (auth.user) {
      await addUserLanguage(auth.user.id, pair.learnLang, pair.nativeLang, {
        isPriority: true,
      });
      await deactivateNonPriorityLanguages(auth.user.id);
      userLangs.reload();
    }
  }

  // Мультирежим: пара добавляется/реактивируется (upsert), прочие остаются.
  // Сразу делаем её активной — на карточках появится честное пустое состояние
  // с предложением сгенерировать карточки.
  async function handleAddPair(pair) {
    saveActivePair(pair);
    setChosenPair(pair);
    setSettings((prev) => ({ ...prev, ...pair }));
    if (auth.user) {
      await addUserLanguage(auth.user.id, pair.learnLang, pair.nativeLang);
      userLangs.reload();
    }
  }

  // Дневной лимит пары: правка сразу пересчитывает разбивку дня (4.3) —
  // dailyBalance пересчитывается от обновлённого списка языков.
  async function handleSetLimit(lang, limit) {
    if (!auth.user) return;
    await updateUserLanguage(auth.user.id, lang.learnLang, lang.nativeLang, {
      dailyNewLimit: limit,
    });
    userLangs.reload();
  }

  // «Удаление» пары: is_active=false, слова остаются в user_words. Последнюю
  // активную пару экран удалить не даёт (guard и здесь — на всякий случай).
  async function handleRemoveLanguage(lang) {
    if (!auth.user || userLangs.languages.length <= 1) return;
    await removeUserLanguage(auth.user.id, lang.learnLang, lang.nativeLang);
    userLangs.reload();
  }

  // Переключатель пар. В режиме «по дням» выбор — сессионный override поверх
  // расписания (перезагрузка вернёт язык дня); в остальных режимах выбор
  // сохраняется и переживает перезагрузку.
  function handleSwitchLanguage(pair) {
    if (scheduleActive) {
      setDayOverridePair(pair);
      return;
    }
    saveActivePair(pair);
    setChosenPair(pair);
  }

  async function handleToggleMultiLang(enabled) {
    setDayOverridePair(null);
    await userLangs.toggleMultiLangMode(enabled);
    // При выключении активной остаётся приоритетная пара — activeLanguage
    // вернётся к ней сам (multiLangMode=false → приоритетная).
  }

  // Включение мультирежима с ответами на вопросы (фаза 4.5): сколько дней в
  // неделю и какой режим распределения. Сохраняем настройки, затем включаем —
  // раскладку недели построит эффект пересчёта выше.
  async function handleEnableMultiLang(prefs) {
    setDayOverridePair(null);
    await userLangs.updateSchedulePrefs({
      studyDaysPerWeek: prefs.studyDaysPerWeek,
      scheduleMode: prefs.scheduleMode,
    });
    await userLangs.toggleMultiLangMode(true);
  }

  // Правка расписания из «Моих языков» (в любой момент): дни/режим. Смена
  // значений сбрасывает сессионный override — активный язык определит новая
  // раскладка.
  async function handleUpdateSchedule(partial) {
    setDayOverridePair(null);
    await userLangs.updateSchedulePrefs(partial);
  }

  // Смена приоритетной пары (мультирежим): один update — триггер в БД снимает
  // приоритет с прежней; разбивка дневной нормы пересчитается от новых данных.
  async function handleSetPriority(lang) {
    if (!auth.user) return;
    await setPriorityLanguage(auth.user.id, lang.learnLang, lang.nativeLang);
    userLangs.reload();
  }

  // ---------- Рендер с гейтами ----------
  // Простой сплэш на время восстановления сессии/загрузки языков (реюзаем
  // стили статус-экрана карточек, чтобы не плодить CSS).
  const splash = (
    <section className="cards cards--status" aria-busy="true">
      <div className="cards__spinner" aria-hidden="true" />
    </section>
  );

  let content;
  if (auth.recovery) {
    // Пришли по ссылке восстановления пароля: показываем ввод нового пароля
    // поверх всего (сессия восстановления уже есть). После успеха — в приложение.
    content = (
      <ResetPasswordScreen
        onSubmit={auth.updatePassword}
        onDone={auth.clearRecovery}
      />
    );
  } else if (authRequired && auth.loading) {
    content = splash;
  } else if (authRequired && !auth.user) {
    // Обязательная регистрация: незалогиненный видит только start → auth.
    content =
      screen === "auth" ? (
        <AuthScreen
          onSignIn={auth.signIn}
          onSignUp={auth.signUp}
          onResetPassword={auth.sendPasswordReset}
          resetLinkError={auth.recoveryError}
          onBack={() => setScreen("start")}
        />
      ) : (
        <StartScreen onStart={() => setScreen("auth")} />
      );
  } else if (auth.user && migrationAsk) {
    content = (
      <MigrateScreen
        onTransfer={handleMigrateTransfer}
        onDiscard={handleMigrateDiscard}
      />
    );
  } else if (auth.user && userLangs.loading && !activeLanguage) {
    // Языки ещё грузятся и офлайн-фолбэка нет — не мигаем онбордингом.
    content = splash;
  } else if (placement) {
    // Тест на уровень перекрывает и онбординг: из него он и запускается.
    content = (
      <PlacementScreen
        learnLang={placement.learnLang}
        nativeLang={placement.nativeLang}
        onApply={handleApplyPlacement}
        onCancel={handleCancelPlacement}
      />
    );
  } else if (needsSetup) {
    content = (
      <OnboardingScreen
        initial={onboardingDraft || settings}
        // Вернулись из теста — открываем сразу шаг уровня, а не начало мастера.
        initialStep={onboardingDraft ? SETTINGS_KEYS.length - 1 : 0}
        onComplete={handleComplete}
        onStartPlacement={(draft) => {
          setOnboardingDraft(draft);
          handleStartPlacement({
            learnLang: draft.learnLang,
            nativeLang: draft.nativeLang,
            returnTo: "onboarding",
            draft,
          });
        }}
        onBack={() => {}}
      />
    );
  } else {
    content = (
      <>
        {screen === "cards" && (
          <CardScreen
            vocab={vocab}
            cards={cards}
            loading={loading}
            error={error}
            learnLang={learnLang}
            nativeLang={nativeLang}
            languages={userLangs.languages}
            multiLangMode={userLangs.multiLangMode}
            activeLanguage={activeLanguage}
            onSwitchLanguage={handleSwitchLanguage}
            dailyBalance={dailyBalance}
            quotaExhausted={quotaExhausted}
            weekSchedule={scheduleActive ? userLangs.weeklySchedule : null}
            restDay={restDay}
            dueCount={dueWords.length}
            generateCount={generateCount}
            onChangeGenerateCount={setGenerateCount}
            generateMode={generateMode}
            onChangeGenerateMode={setGenerateMode}
            onGenerate={handleGenerate}
            onGenerateRandom={handleGenerateRandom}
            onRetryGenerate={handleRetryGenerate}
            onClearError={clearError}
            onOpenSettings={() => setScreen("settings")}
            onOpenMyWords={() => setScreen("mywords")}
            onOpenAddWord={() => setScreen("addword")}
            onOpenReading={() => {
              setSessionBlock(null);
              setScreen("reading");
            }}
            onOpenListening={() => {
              setSessionBlock(null);
              setScreen("listening");
            }}
            onAddWordFromExample={handleAddManualCard}
            onOpenReview={() => {
              setSessionBlock(null);
              setScreen("review");
            }}
            onOpenStats={() => setScreen("stats")}
            onOpenTutorial={() => setShowTutorial(true)}
            onExitSession={exitSession}
            sessionNewBlock={sessionBlock === "newWords"}
            sessionNewTarget={sessionNewTarget}
            sessionRandom={sessionBlock === "newWords" && sessionRandom}
          />
        )}

        {screen === "session" && (
          <SessionScreen
            plan={sessionPlan}
            doneMap={sessionDoneMap}
            onToggle={toggleSessionBlock}
            onStartBlock={startSessionBlock}
            onManual={goManualHub}
            onOpenSettings={() => setScreen("settings")}
            languages={userLangs.languages}
            multiLangMode={userLangs.multiLangMode}
            activeLanguage={activeLanguage}
            onSwitchLanguage={handleSwitchLanguage}
            learnLang={learnLang}
            scheduleActive={scheduleActive}
          />
        )}

        {screen === "stats" && (
          <StatsScreen
            takenCount={vocab.takenWords.length}
            knownCount={vocab.knownWords.length}
            learnLang={learnLang}
            nativeLang={nativeLang}
            onBack={() => setScreen("session")}
          />
        )}

        {screen === "review" && (
          <ReviewScreen
            dueWords={dueWords}
            wordInfo={vocab.wordInfo}
            srsByWord={vocab.srsByWord}
            todayKey={vocab.todayKey}
            learnLang={learnLang}
            nativeLang={nativeLang}
            onReview={vocab.reviewWord}
            onBack={handleSessionBack}
            onFinished={() => completeExercise("review")}
          />
        )}

        {screen === "mywords" && (
          <MyWordsScreen
            takenWords={vocab.takenWords}
            knownCount={vocab.knownWords.length}
            wordInfo={vocab.wordInfo}
            srsByWord={vocab.srsByWord}
            todayKey={vocab.todayKey}
            learnLang={learnLang}
            nativeLang={nativeLang}
            onMarkKnown={vocab.markKnown}
            onDelete={vocab.deleteWords}
            onBack={() => setScreen("session")}
            onOpenKnown={() => setScreen("known")}
          />
        )}

        {screen === "addword" && (
          <AddWordScreen
            learnLang={learnLang}
            nativeLang={nativeLang}
            onAdd={handleAddManualCard}
            onOpenMyWords={() => setScreen("mywords")}
            onBack={() => setScreen("session")}
          />
        )}

        {screen === "reading" && (
          <ReadingScreen
            pairKey={pairKey}
            learnLang={learnLang}
            nativeLang={nativeLang}
            topic={settings.topic}
            level={settings.level}
            takenWords={vocab.takenWords}
            knownWords={vocab.knownWords}
            onAddWord={handleAddManualCard}
            onBack={handleSessionBack}
            plannedSentences={
              sessionBlock === "reading" ? sessionSentences : null
            }
            onQuestionsComplete={() => completeExercise("reading")}
          />
        )}

        {/* Аудирование (фаза 6.2): фразы вокруг активных слов АКТИВНОЙ пары —
            то есть языка, который назначило расписание на сегодня. */}
        {screen === "listening" && (
          <ListeningScreen
            pairKey={pairKey}
            learnLang={learnLang}
            nativeLang={nativeLang}
            topic={settings.topic}
            level={settings.level}
            takenWords={vocab.takenWords}
            wordInfo={vocab.wordInfo}
            levelId={listeningLevel}
            onChangeLevel={setListeningLevel}
            mode={listeningMode}
            onChangeMode={setListeningMode}
            formatId={listeningFormat}
            onChangeFormat={setListeningFormat}
            scheduleActive={scheduleActive}
            onBack={handleSessionBack}
            plannedQuestions={
              sessionBlock === "listening" ? sessionQuestions : null
            }
            onQuestionsComplete={() => completeExercise("listening")}
          />
        )}

        {screen === "known" && (
          <KnownWordsScreen
            knownWords={vocab.knownWords}
            takenCount={vocab.takenWords.length}
            wordInfo={vocab.wordInfo}
            learnLang={learnLang}
            nativeLang={nativeLang}
            onRestore={vocab.restoreToStudy}
            onDelete={vocab.deleteWords}
            onBack={() => setScreen("session")}
            onOpenMyWords={() => setScreen("mywords")}
            onOpenKnownReview={() => setScreen("knownreview")}
          />
        )}

        {screen === "knownreview" && (
          <KnownReviewScreen
            knownWords={vocab.knownWords}
            wordInfo={vocab.wordInfo}
            learnLang={learnLang}
            nativeLang={nativeLang}
            onRestore={vocab.restoreToStudy}
            onBack={() => setScreen("known")}
          />
        )}

        {screen === "settings" && (
          <SettingsScreen
            settings={settings}
            onChange={updateSetting}
            onOpenLanguages={() => setScreen("languages")}
            onBack={() => setScreen("session")}
            onOpenTutorial={() => setShowTutorial(true)}
            placementLevel={activeLanguage?.placementLevel || null}
            onStartPlacement={() =>
              handleStartPlacement({
                learnLang,
                nativeLang,
                returnTo: "settings",
              })
            }
            customTopics={activeCustomTopics}
            canManageTopics={canManageTopics}
            onAddCustomTopic={handleAddCustomTopic}
            onRemoveCustomTopic={handleRemoveCustomTopic}
            auth={authForUi}
            onOpenAuth={() => setScreen("auth")}
            syncStatus={vocab.syncStatus}
            syncReason={vocab.syncReason}
            onRetrySync={vocab.retrySync}
            onSendFeedback={handleSendFeedback}
            onDeleteAccount={handleDeleteAccount}
            onChangePassword={auth.updatePassword}
          />
        )}

        {screen === "languages" && (
          <LanguagesScreen
            multiLangMode={userLangs.multiLangMode}
            languages={userLangs.languages}
            priorityLanguage={userLangs.priorityLanguage}
            activeLanguage={activeLanguage}
            studyDaysPerWeek={userLangs.studyDaysPerWeek}
            scheduleMode={userLangs.scheduleMode}
            weeklySchedule={userLangs.weeklySchedule}
            onEnableMultiLang={handleEnableMultiLang}
            onToggleMultiLang={handleToggleMultiLang}
            onUpdateSchedule={handleUpdateSchedule}
            onReplaceSinglePair={handleReplaceSinglePair}
            onAddPair={handleAddPair}
            onSetPriority={handleSetPriority}
            onSetLimit={handleSetLimit}
            onRemove={handleRemoveLanguage}
            onStartPlacement={(pair) =>
              handleStartPlacement({
                learnLang: pair.learnLang,
                nativeLang: pair.nativeLang,
                returnTo: "languages",
              })
            }
            onBack={() => setScreen("settings")}
          />
        )}
      </>
    );
  }

  // «Что нового» показываем только в основном приложении — не поверх сплэша,
  // экрана входа, переноса, теста уровня или онбординга (needsSetup покрывает и
  // случай ещё не выбранной пары). Так окно не наслаивается на эти состояния.
  const inMainApp =
    (!authRequired || Boolean(auth.user)) &&
    !auth.loading &&
    !migrationAsk &&
    !placement &&
    !needsSetup;

  return (
    <I18nProvider lang={nativeLang}>
      <Analytics />
      <AppShell
        ember={
          // Экран восстановления пароля (по ссылке) и экран входа/сброса —
          // тоже Ember: каркас тёплый, без холодной каймы вокруг.
          auth.recovery ||
          [
            "cards",
            "session",
            "settings",
            "stats",
            "mywords",
            "reading",
            "listening",
            "languages",
            "auth",
          ].includes(screen)
        }
      >
        {content}
        {/* Туториал — после входа (гостям на экране регистрации он не нужен) */}
        {showTutorial && (!authRequired || auth.user) && (
          <Tutorial onClose={closeTutorial} />
        )}
        {/* «Что нового» — в основном приложении и не поверх туториала (чтобы два
            окна не стакались у новичка). Один раз за заход; закрытие → null. */}
        {whatsNew && inMainApp && !showTutorial && (
          <WhatsNew
            mode={whatsNew.mode}
            entries={whatsNew.entries}
            onClose={() => setWhatsNew(null)}
          />
        )}
      </AppShell>
    </I18nProvider>
  );
}
