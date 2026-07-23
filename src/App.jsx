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
import KnownWordsScreen from "./screens/KnownWordsScreen.jsx";
import KnownReviewScreen from "./screens/KnownReviewScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
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
} from "./lib/userLanguages.js";
import { computeDailyQuotas } from "./lib/dailyBalance.js";
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

  const activeLanguage = useMemo(() => {
    const langs = userLangs.languages;
    if (langs.length > 0) {
      if (userLangs.multiLangMode && chosenPair) {
        const found = langs.find(
          (l) =>
            l.learnLang === chosenPair.learnLang &&
            l.nativeLang === chosenPair.nativeLang,
        );
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

  // Слова, которым сегодня пора на повтор (отдельно от потока новых карточек).
  const dueWords = getDueWords(vocab.takenWords, vocab.srsByWord, vocab.todayKey);

  // ---------- Баланс дневной нагрузки (фаза 4.3) ----------
  // Квоты новых слов по активным парам (только мультирежим; при false — null,
  // баланса нет вообще). «Взято сегодня» считает useWordLists по takenDate.
  // Повторения (SRS) в норму не входят и не режутся никогда.
  const dailyBalance = useMemo(() => {
    if (!userLangs.multiLangMode || userLangs.languages.length === 0) {
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
  }, [userLangs.multiLangMode, userLangs.languages, vocab.takenTodayByPair]);

  const activeBalance = dailyBalance?.find((b) => b.pairKey === pairKey) || null;
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
    if (ok) vocab.rememberCards([card]);
    return ok;
  }

  // Онбординг завершён: тема/уровень в settings, языковая пара — в
  // user_languages (первая пара станет приоритетной автоматически).
  async function handleComplete(chosen) {
    setSettings(chosen);
    const pair = { learnLang: chosen.learnLang, nativeLang: chosen.nativeLang };
    saveActivePair(pair);
    setChosenPair(pair);
    setScreen("cards");
    if (auth.user) {
      await addUserLanguage(auth.user.id, pair.learnLang, pair.nativeLang, {
        isPriority: true,
      });
      userLangs.reload();
    }
  }

  function updateSetting(key, id) {
    setSettings((prev) => ({ ...prev, [key]: id }));
  }

  // Смена языка в настройках. Одноязычный режим: новая пара заменяет
  // единственную (приоритет → новой, старая скрывается, прогресс в user_words
  // сохраняется). Мультирежим: пара добавляется/активируется, прочие остаются.
  async function handleChangeLanguage(key, id) {
    const current = activeLanguage || {
      learnLang: settings.learnLang,
      nativeLang: settings.nativeLang,
    };
    const next = {
      learnLang: key === "learnLang" ? id : current.learnLang,
      nativeLang: key === "nativeLang" ? id : current.nativeLang,
    };
    if (!next.learnLang || !next.nativeLang) return;
    if (
      next.learnLang === current.learnLang &&
      next.nativeLang === current.nativeLang
    ) {
      return;
    }
    saveActivePair(next);
    setChosenPair(next);
    setSettings((prev) => ({ ...prev, ...next }));
    if (auth.user) {
      if (userLangs.multiLangMode) {
        await addUserLanguage(auth.user.id, next.learnLang, next.nativeLang);
      } else {
        await addUserLanguage(auth.user.id, next.learnLang, next.nativeLang, {
          isPriority: true,
        });
        await deactivateNonPriorityLanguages(auth.user.id);
      }
      userLangs.reload();
    }
  }

  // Переключатель пар (мультирежим): выбор сохраняется и переживает перезагрузку.
  function handleSwitchLanguage(pair) {
    saveActivePair(pair);
    setChosenPair(pair);
  }

  async function handleToggleMultiLang(enabled) {
    await userLangs.toggleMultiLangMode(enabled);
    // При выключении активной остаётся приоритетная пара — activeLanguage
    // вернётся к ней сам (multiLangMode=false → приоритетная).
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
  } else if (needsSetup) {
    content = (
      <OnboardingScreen
        initial={settings}
        onComplete={handleComplete}
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
            activeLanguage={activeLanguage}
            onChangeLanguage={handleChangeLanguage}
            multiLangMode={userLangs.multiLangMode}
            multiLangAvailable={Boolean(auth.configured && auth.user)}
            onToggleMultiLang={handleToggleMultiLang}
            languages={userLangs.languages}
            onSetPriority={handleSetPriority}
            onBack={() => setScreen("cards")}
            onOpenTutorial={() => setShowTutorial(true)}
            auth={authForUi}
            onOpenAuth={() => setScreen("auth")}
            syncStatus={vocab.syncStatus}
            syncReason={vocab.syncReason}
            onRetrySync={vocab.retrySync}
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
