import { useState } from "react";
import AppShell from "./components/AppShell.jsx";
import StartScreen from "./screens/StartScreen.jsx";
import OnboardingScreen from "./screens/OnboardingScreen.jsx";
import CardScreen from "./screens/CardScreen.jsx";
import MyWordsScreen from "./screens/MyWordsScreen.jsx";
import KnownWordsScreen from "./screens/KnownWordsScreen.jsx";
import { EMPTY_SETTINGS } from "./data/onboarding.js";
import { useWordLists } from "./hooks/useWordLists.js";

export default function App() {
  // Простая навигация без роутера: 'start' | 'onboarding' | 'cards' | 'mywords'
  const [screen, setScreen] = useState("start");
  // Выбор пользователя из онбординга: learnLang, nativeLang, topic, level
  const [settings, setSettings] = useState(EMPTY_SETTINGS);
  // Личные списки слов (с сохранением в localStorage)
  const vocab = useWordLists();

  function handleComplete(chosen) {
    setSettings(chosen);
    setScreen("cards");
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
          onBack={() => setScreen("start")}
        />
      )}

      {screen === "cards" && (
        <CardScreen
          vocab={vocab}
          onOpenSettings={() => setScreen("onboarding")}
          onOpenMyWords={() => setScreen("mywords")}
        />
      )}

      {screen === "mywords" && (
        <MyWordsScreen
          takenWords={vocab.takenWords}
          knownCount={vocab.knownWords.length}
          onBack={() => setScreen("cards")}
          onOpenKnown={() => setScreen("known")}
        />
      )}

      {screen === "known" && (
        <KnownWordsScreen
          knownWords={vocab.knownWords}
          takenCount={vocab.takenWords.length}
          onRestore={vocab.restoreToStudy}
          onBack={() => setScreen("cards")}
          onOpenMyWords={() => setScreen("mywords")}
        />
      )}
    </AppShell>
  );
}
