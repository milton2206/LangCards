import { useState, useEffect } from "react";
import { fetchTtsUrl, playUrl, MAX_TTS_TEXT_LEN } from "../lib/ttsClient.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./PlayButton.css";

/**
 * Компактная кнопка озвучки (фаза 5.1). text — что озвучить (как есть),
 * learnLang — язык произношения, kind: "word" | "example" (только для aria).
 *
 * Состояния: idle → loading (первый тап по слову без кэша — с индикатором) →
 * playing; ошибка/офлайн → кнопка неактивна пару секунд, затем можно
 * попробовать снова. Отсутствие аудио НИКОГДА не блокирует карточку.
 */
export default function PlayButton({ text, learnLang, kind = "word" }) {
  const { t } = useI18n();
  const [state, setState] = useState("idle"); // idle | loading | playing | error
  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );

  // Офлайн → кнопка неактивна; при возврате сети снова активна.
  useEffect(() => {
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  // Слишком длинный текст не озвучиваем вовсе (предохранитель квоты).
  const tooLong = String(text ?? "").trim().length > MAX_TTS_TEXT_LEN;
  const disabled = offline || tooLong || state === "error";

  async function handlePlay(e) {
    // Кнопка живёт внутри свайпаемой карточки — тап не должен уходить наверх.
    e.stopPropagation();
    if (disabled || state === "loading") return;

    setState("loading");
    const url = await fetchTtsUrl({ text, learnLang });
    if (!url) {
      // Не готово/нет сети: побудем неактивной и вернёмся — можно повторить.
      setState("error");
      setTimeout(() => setState("idle"), 2500);
      return;
    }

    try {
      // Общий плеер (ttsClient): новый звук останавливает предыдущий.
      const audio = playUrl(url);
      audio.onended = () => setState("idle");
      audio.onerror = () => setState("idle");
      await audio.play();
      setState("playing");
    } catch {
      setState("error");
      setTimeout(() => setState("idle"), 2500);
    }
  }

  const label =
    kind === "example" ? t("tts.playExample") : t("tts.playWord");

  return (
    <button
      type="button"
      className={`playbtn playbtn--${state}${disabled ? " is-disabled" : ""}`}
      aria-label={disabled ? t("tts.unavailable") : label}
      disabled={disabled}
      onClick={handlePlay}
    >
      {state === "loading" ? (
        <span className="playbtn__spinner" aria-hidden="true" />
      ) : (
        <span aria-hidden="true">{disabled ? "🔇" : "🔊"}</span>
      )}
    </button>
  );
}
