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
import PlacementScreen from "./screens/PlacementScreen.jsx";
import KnownWordsScreen from "./screens/KnownWordsScreen.jsx";
import KnownReviewScreen from "./screens/KnownReviewScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import LanguagesScreen from "./screens/LanguagesScreen.jsx";
import ReviewScreen from "./screens/ReviewScreen.jsx";
import StatsScreen from "./screens/StatsScreen.jsx";
import AuthScreen from "./screens/AuthScreen.jsx";
import Tutorial from "./components/Tutorial.jsx";
import { EMPTY_SETTINGS, SETTINGS_KEYS } from "./data/onboarding.js";
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
} from "./lib/userLanguages.js";
import { computeDailyQuotas } from "./lib/dailyBalance.js";
import {
  buildWeeklySchedule,
  todayScheduledPair,
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
} from "./lib/listeningLevels.js";
import { prewarmTts } from "./lib/ttsClient.js";

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

  const [screen, setScreen] = useState(settingsComplete ? "cards" : "start");

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

  // Слова, которым сегодня пора на повтор (отдельно от потока новых карточек).
  const dueWords = getDueWords(vocab.takenWords, vocab.srsByWord, vocab.todayKey);

  // ---------- Пересчёт недельной раскладки (фаза 4.5) ----------
  // Раскладка пересчитывается при добавлении/удалении языка, смене приоритета
  // и числа учебных дней; сохраняется в profiles (best-effort, локально —
  // сразу). Сравнение по JSON защищает от лишних записей и циклов.
  useEffect(() => {
    if (!scheduleActive || userLangs.loading || userLangs.languages.length === 0) {
      return;
    }
    const next = buildWeeklySchedule(
      userLangs.languages,
      userLangs.studyDaysPerWeek,
    );
    if (JSON.stringify(next) !== JSON.stringify(userLangs.weeklySchedule)) {
      userLangs.updateSchedulePrefs({ weeklySchedule: next });
    }
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
  useEffect(() => {
    if (authRequired && !auth.user) {
      if (screen !== "start" && screen !== "auth") setScreen("start");
    } else if (screen === "start" || screen === "auth") {
      setScreen("cards");
    }
  }, [authRequired, auth.user, screen]);

  // Выход из аккаунта: чистим локальный кэш (чужой прогресс не должен остаться
  // на устройстве) и перезагружаемся — все хуки стартуют с чистого состояния.
  async function handleSignOut() {
    await auth.signOut();
    clearAccountCache();
    window.location.reload();
  }
  const authForUi = { ...auth, signOut: handleSignOut };

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
    setScreen("cards");
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
  if (authRequired && auth.loading) {
    content = splash;
  } else if (authRequired && !auth.user) {
    // Обязательная регистрация: незалогиненный видит только start → auth.
    content =
      screen === "auth" ? (
        <AuthScreen
          onSignIn={auth.signIn}
          onSignUp={auth.signUp}
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
            onOpenReading={() => setScreen("reading")}
            onOpenListening={() => setScreen("listening")}
            onAddWordFromExample={handleAddManualCard}
            onOpenReview={() => setScreen("review")}
            onOpenStats={() => setScreen("stats")}
            onOpenTutorial={() => setShowTutorial(true)}
          />
        )}

        {screen === "stats" && (
          <StatsScreen
            takenCount={vocab.takenWords.length}
            knownCount={vocab.knownWords.length}
            learnLang={learnLang}
            nativeLang={nativeLang}
            onBack={() => setScreen("cards")}
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
            onBack={() => setScreen("cards")}
          />
        )}

        {screen === "mywords" && (
          <MyWordsScreen
            takenWords={vocab.takenWords}
            knownCount={vocab.knownWords.length}
            wordInfo={vocab.wordInfo}
            learnLang={learnLang}
            nativeLang={nativeLang}
            onMarkKnown={vocab.markKnown}
            onDelete={vocab.deleteWords}
            onBack={() => setScreen("cards")}
            onOpenKnown={() => setScreen("known")}
          />
        )}

        {screen === "addword" && (
          <AddWordScreen
            learnLang={learnLang}
            nativeLang={nativeLang}
            onAdd={handleAddManualCard}
            onOpenMyWords={() => setScreen("mywords")}
            onBack={() => setScreen("cards")}
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
            onBack={() => setScreen("cards")}
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
            levelId={listeningLevel}
            onChangeLevel={setListeningLevel}
            scheduleActive={scheduleActive}
            onBack={() => setScreen("cards")}
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
            onBack={() => setScreen("cards")}
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
            onBack={() => setScreen("cards")}
            onOpenTutorial={() => setShowTutorial(true)}
            placementLevel={activeLanguage?.placementLevel || null}
            onStartPlacement={() =>
              handleStartPlacement({
                learnLang,
                nativeLang,
                returnTo: "settings",
              })
            }
            auth={authForUi}
            onOpenAuth={() => setScreen("auth")}
            syncStatus={vocab.syncStatus}
            syncReason={vocab.syncReason}
            onRetrySync={vocab.retrySync}
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

  return (
    <I18nProvider lang={nativeLang}>
      <Analytics />
      <AppShell>
        {content}
        {/* Туториал — после входа (гостям на экране регистрации он не нужен) */}
        {showTutorial && (!authRequired || auth.user) && (
          <Tutorial onClose={closeTutorial} />
        )}
      </AppShell>
    </I18nProvider>
  );
}
