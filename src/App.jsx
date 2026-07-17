import { useState } from "react";
import AppShell from "./components/AppShell.jsx";
import StartScreen from "./screens/StartScreen.jsx";
import OnboardingScreen from "./screens/OnboardingScreen.jsx";
import LoadingScreen from "./screens/LoadingScreen.jsx";
import { EMPTY_SETTINGS } from "./data/onboarding.js";

export default function App() {
  // Простая навигация без роутера: 'start' | 'onboarding' | 'loading'
  const [screen, setScreen] = useState("start");
  // Выбор пользователя из онбординга: learnLang, nativeLang, topic, level
  const [settings, setSettings] = useState(EMPTY_SETTINGS);

  function handleComplete(chosen) {
    setSettings(chosen);
    setScreen("loading");
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

      {screen === "loading" && (
        <LoadingScreen
          settings={settings}
          onOpenSettings={() => setScreen("onboarding")}
        />
      )}
    </AppShell>
  );
}
