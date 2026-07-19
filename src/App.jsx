import { useState, useEffect } from "react";
import AppShell from "./components/AppShell.jsx";
import StartScreen from "./screens/StartScreen.jsx";
import OnboardingScreen from "./screens/OnboardingScreen.jsx";
import CardScreen from "./screens/CardScreen.jsx";
import MyWordsScreen from "./screens/MyWordsScreen.jsx";
import KnownWordsScreen from "./screens/KnownWordsScreen.jsx";
import SettingsScreen from "./screens/SettingsScreen.jsx";
import { EMPTY_SETTINGS, SETTINGS_KEYS } from "./data/onboarding.js";
import { useWordLists } from "./hooks/useWordLists.js";
import { useCards } from "./hooks/useCards.js";

function loadSettings() {
  try {
    const raw = localStorage.getItem("settings");
    return raw ? JSON.parse(raw) : EMPTY_SETTINGS;
  } catch {
    return EMPTY_SETTINGS;
  }
}

export default function App() {
  // Настройки онбординга (learnLang, nativeLang, topic, level) — сохраняются.
  const [settings, setSettings] = useState(loadSettings);
  const settingsComplete = SETTINGS_KEYS.every((k) => settings[k]);

  // Если настройки уже заданы — открываем сразу карточки (не онбординг).
  const [screen, setScreen] = useState(settingsComplete ? "cards" : "start");

  const vocab = useWordLists();
  const { cards, loading, error, generate, clearError } = useCards();

  useEffect(() => {
    localStorage.setItem("settings", JSON.stringify(settings));
  }, [settings]);

  // Параметры генерации: текущие настройки + исключения (взятые, известные,
  // ещё не вернувшиеся отложенные). Читаются в момент нажатия кнопки.
  function buildParams() {
    const deferred = vocab.skippedWords
      .filter((s) => (s.returnDate ?? "") > vocab.todayKey)
      .map((s) => s.word);
    return {
      learnLang: settings.learnLang,
      nativeLang: settings.nativeLang,
      topic: settings.topic,
      level: settings.level,
      exclude: [
        ...new Set([...vocab.takenWords, ...vocab.knownWords, ...deferred]),
      ],
      count: 10,
    };
  }

  function handleGenerate() {
    generate(buildParams());
  }

  function handleComplete(chosen) {
    setSettings(chosen);
    setScreen("cards");
  }

  function updateSetting(key, id) {
    setSettings((prev) => ({ ...prev, [key]: id }));
  }

  return (
    <AppShell>
      {screen === "start" && (
        <StartScreen onStart={() => setScreen("onboarding")} />
      )}

      {screen === "onboarding" && (
        <OnboardingScreen
          initial={settings}
          onComplete={handleComplete}
          onBack={() => setScreen(settingsComplete ? "cards" : "start")}
        />
      )}

      {screen === "cards" && (
        <CardScreen
          vocab={vocab}
          cards={cards}
          loading={loading}
          error={error}
          onGenerate={handleGenerate}
          onClearError={clearError}
          onOpenSettings={() => setScreen("settings")}
          onOpenMyWords={() => setScreen("mywords")}
        />
      )}

      {screen === "mywords" && (
        <MyWordsScreen
          takenWords={vocab.takenWords}
          knownCount={vocab.knownWords.length}
          wordInfo={vocab.wordInfo}
          onMarkKnown={vocab.markKnown}
          onBack={() => setScreen("cards")}
          onOpenKnown={() => setScreen("known")}
        />
      )}

      {screen === "known" && (
        <KnownWordsScreen
          knownWords={vocab.knownWords}
          takenCount={vocab.takenWords.length}
          wordInfo={vocab.wordInfo}
          onRestore={vocab.restoreToStudy}
          onBack={() => setScreen("cards")}
          onOpenMyWords={() => setScreen("mywords")}
        />
      )}

      {screen === "settings" && (
        <SettingsScreen
          settings={settings}
          onChange={updateSetting}
          onBack={() => setScreen("cards")}
        />
      )}
    </AppShell>
  );
}
