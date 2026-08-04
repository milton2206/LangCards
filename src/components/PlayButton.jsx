import { useState, useEffect, useRef } from "react";
import {
  fetchTtsUrl,
  playUrl,
  forgetTtsUrl,
  MAX_TTS_TEXT_LEN,
} from "../lib/ttsClient.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import Icon from "./icons/Icon.jsx";
import "./PlayButton.css";

/**
 * Компактная кнопка озвучки (фаза 5.1). text — что озвучить (как есть),
 * learnLang — язык произношения, kind: "word" | "example" (только для aria).
 *
 * appearance — ТОЛЬКО вид глифа (поведение одинаково):
 *   "default" — эмодзи 🔊/🔇 (как раньше; используют все прежние экраны);
 *   "ember"   — линейная иконка speak/mute (набор Ember). Экраны, которые ещё
 *               не мигрировали на Ember, проп НЕ передают и выглядят как прежде.
 *
 * Состояния: idle → loading (первый тап по слову без кэша — с индикатором) →
 * playing; ошибка/офлайн → кнопка неактивна пару секунд, затем можно
 * попробовать снова. Отсутствие аудио НИКОГДА не блокирует карточку.
 */
export default function PlayButton({
  text,
  learnLang,
  kind = "word",
  appearance = "default",
}) {
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

  // Текущий звук этой кнопки — чтобы заглушить его при уходе с экрана. Пауза
  // заодно освобождает шину (см. playUrl), так что «занято» не залипает.
  const audioRef = useRef(null);
  useEffect(
    () => () => {
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.pause();
        } catch {
          // элемент уже мёртв — не страшно
        }
      }
    },
    [],
  );

  /**
   * Пробует проиграть url. true — звук пошёл (или его штатно перехватил другой
   * плеер), false — элемент не смог загрузиться и есть смысл повторить.
   */
  function startPlayback(url) {
    return new Promise((resolve) => {
      const audio = playUrl(url);
      audioRef.current = audio;
      let settled = false;
      const done = (ok) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };

      audio.addEventListener("error", () => done(false), { once: true });
      audio.addEventListener("ended", () => setState("idle"), { once: true });
      // Нас заглушил другой плеер — это норма, просто возвращаемся в исходное.
      // Раньше состояние «playing» в этом случае залипало навсегда.
      audio.addEventListener("pause", () => setState("idle"));

      audio
        .play()
        .then(() => {
          setState("playing");
          done(true);
        })
        .catch((err) => {
          // AbortError — успели нажать другую кнопку, наш звук прервали. Это НЕ
          // сбой: раньше он уводил кнопку в error и гасил её на 2.5 секунды,
          // из-за чего следующий тап «не работал».
          if (err?.name === "AbortError") {
            setState("idle");
            done(true);
          } else {
            done(false);
          }
        });
    });
  }

  async function handlePlay(e) {
    // Кнопка живёт внутри свайпаемой карточки — тап не должен уходить наверх.
    e.stopPropagation();
    if (disabled || state === "loading") return;

    setState("loading");
    const url = await fetchTtsUrl({ text, learnLang });
    if (url && (await startPlayback(url))) return;

    // Не проигралось — забываем URL и пробуем ОДИН раз заново: сервер отдаст
    // свежую ссылку (или до-генерирует файл). Раньше здесь была тишина.
    forgetTtsUrl({ text, learnLang });
    setState("loading");
    const retryUrl = await fetchTtsUrl({ text, learnLang });
    if (retryUrl && (await startPlayback(retryUrl))) return;

    // Не помогло и со второго раза: коротко подсветим ошибку и вернёмся в строй.
    setState("error");
    setTimeout(() => setState("idle"), 2500);
  }

  const label =
    kind === "example" ? t("tts.playExample") : t("tts.playWord");

  const ember = appearance === "ember";
  const glyph = ember ? (
    <Icon
      name={disabled ? "mute" : "speak"}
      size={kind === "example" ? 16 : 22}
    />
  ) : (
    <span aria-hidden="true">{disabled ? "🔇" : "🔊"}</span>
  );

  return (
    <button
      type="button"
      className={`playbtn${ember ? " playbtn--ember" : ""} playbtn--${state}${disabled ? " is-disabled" : ""}`}
      aria-label={disabled ? t("tts.unavailable") : label}
      disabled={disabled}
      onClick={handlePlay}
    >
      {state === "loading" ? (
        <span className="playbtn__spinner" aria-hidden="true" />
      ) : (
        glyph
      )}
    </button>
  );
}
