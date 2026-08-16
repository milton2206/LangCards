import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  fetchTtsUrlResult,
  forgetTtsUrl,
  claimAudio,
  releaseAudio,
  RETRYABLE_REASONS,
} from "../lib/ttsClient.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import Icon from "./icons/Icon.jsx";
import "./AudioPlayer.css";

// ============================================================================
// Переиспользуемый плеер ДЛИННОГО аудио (фаза 7.x): пауза/продолжить с места,
// перемотка полосой прогресса, текущее время и длительность, повтор с начала.
// Используется в аудировании и в чтении (весь текст + отдельное предложение).
// Короткое аудио (слово в чтении/карточках) остаётся простой кнопкой — не здесь.
// ----------------------------------------------------------------------------
// Источник звука ПРЕЖНИЙ: те же mp3 из общего TTS-кэша (fetchTtsUrl). Меняется
// только проигрывание. Весь текст — это НЕСКОЛЬКО mp3 (по предложению, ограничение
// длины запроса), поэтому плеер склеивает их в ОДНУ шкалу времени: перемотка и
// «текущее/всего» считаются по сумме длительностей, а под капотом играет нужный
// отрезок нужного файла.
//
// tracks   — [{ text, learnLang, rate?, voice? }], один или несколько; порядок =
//            порядок игры. voice — какой голос языка нужен (см. TTS_VOICES в
//            lib/tts.js): без него основной, у реплик диалога — голос по полу
//            говорящего, так собеседники звучат по-разному.
// autoPlay — начать воспроизведение сразу при появлении/смене tracks (аудирование:
//            следующее задание и смена скорости озвучиваются сразу).
// compact  — до первого запуска показывать компактную кнопку play (для списка
//            предложений в чтении), разворачиваясь в полосу при старте.
// ============================================================================

// Секунды → «м:сс».
function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// Длительность одного файла через preload метаданных (без проигрывания).
function loadDuration(url) {
  return new Promise((resolve) => {
    const a = new Audio();
    a.preload = "metadata";
    const done = (d) => resolve(Number.isFinite(d) && d > 0 ? d : 0);
    a.addEventListener("loadedmetadata", () => done(a.duration), { once: true });
    a.addEventListener("error", () => done(0), { once: true });
    a.src = url;
  });
}

export default function AudioPlayer({
  tracks,
  autoPlay = false,
  compact = false,
  ariaLabel,
  // appearance — ТОЛЬКО вид (поведение одинаково): "ember" рисует линейные
  // иконки Ember вместо эмодзи и добавляет классы для тёплых стилей. Экраны, ещё
  // не мигрированные (аудирование), проп не передают и выглядят как прежде.
  appearance = "default",
}) {
  const { t } = useI18n();
  const ember = appearance === "ember";

  // Подпись набора: список текстов+голосов+скоростей. По ней сбрасываемся при
  // смене содержимого (новое предложение, другой текст, другая скорость).
  const sig = useMemo(
    () =>
      (tracks || [])
        .map(
          (tr) =>
            `${tr.learnLang}|${tr.voice ?? "primary"}|${tr.rate ?? 1}|${tr.text}`,
        )
        .join(""),
    [tracks],
  );

  const audioRef = useRef(null);
  // Что сделать, когда у нового трека загрузятся метаданные: перемотать на offset
  // и/или заиграть. Так переход между файлами (склейка/перемотка) остаётся точным.
  const seekOnLoadRef = useRef(null);
  const playOnLoadRef = useRef(false);

  const [phase, setPhase] = useState("idle"); // idle | preparing | ready | error
  // Почему озвучка не получилась (см. fetchTtsUrlResult): offline | rateLimit |
  // rateCooldown | sessionExpired | unavailable | failed. Нужна, чтобы объяснить
  // человеку причину, а не показывать одно «Нет аудио» на все случаи.
  const [errorReason, setErrorReason] = useState(null);
  const [errorParams, setErrorParams] = useState(null);
  // Право на ОДИН автоповтор при сбое загрузки (сбрасывается при смене содержимого).
  const retriedRef = useRef(false);
  const [urls, setUrls] = useState(null);
  const [durations, setDurations] = useState([]);
  const [index, setIndex] = useState(0);
  const [posInTrack, setPosInTrack] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [activated, setActivated] = useState(!compact); // compact разворачивается при старте
  const [scrub, setScrub] = useState(null); // число во время перемотки, иначе null

  const [offline, setOffline] = useState(
    typeof navigator !== "undefined" && !navigator.onLine,
  );
  useEffect(() => {
    const on = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  // Смещения начала каждого трека на общей шкале и полная длительность.
  const offsets = useMemo(() => {
    const out = [];
    let acc = 0;
    for (const d of durations) {
      out.push(acc);
      acc += d;
    }
    return out;
  }, [durations]);
  const total = useMemo(
    () => durations.reduce((a, d) => a + d, 0),
    [durations],
  );
  const currentTime = (offsets[index] || 0) + posInTrack;
  const displayTime = scrub != null ? scrub : currentTime;

  // Пауза «себя» — идентификатор для шины (claimAudio/releaseAudio). Стабилен.
  const pauseSelf = useCallback(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    setPlaying(false);
  }, []);

  // Сброс при смене содержимого: глушим, освобождаем шину, чистим состояние.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.pause();
    releaseAudio(pauseSelf);
    seekOnLoadRef.current = null;
    playOnLoadRef.current = false;
    setPhase("idle");
    setErrorReason(null);
    setErrorParams(null);
    setUrls(null);
    setDurations([]);
    setIndex(0);
    setPosInTrack(0);
    setPlaying(false);
    setScrub(null);
    setActivated(!compact);
    retriedRef.current = false; // новое содержимое — снова даём право на повтор
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // Размонтирование — глушим и уходим с шины. Элемент захватываем при монтаже
  // (он один на всё время жизни компонента), чтобы не читать ref в очистке.
  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      if (audio) audio.pause();
      releaseAudio(pauseSelf);
    };
  }, [pauseSelf]);

  // Готовим все треки: URL-ы из общего кэша + длительности для общей шкалы.
  // При неудаче запоминаем ПРИЧИНУ — по ней плеер объясняет, что случилось.
  //
  // КАЖДАЯ дорожка получает ВТОРУЮ попытку. Диалог из четырёх реплик — это
  // четыре последовательных запроса по длинной цепочке (сессия → лимит →
  // Storage → Google → запись в Storage), и раньше одного моргнувшего звена
  // хватало, чтобы уронить весь диалог: prepare выходил на первой же неудаче.
  // Повтор ровно один и только по причинам, которые он реально лечит
  // (RETRYABLE_REASONS) — дёргать сервер из-за исчерпанного лимита незачем.
  // Это тот же приём, что уже работает в кнопке озвучки слова (PlayButton).
  const prepare = useCallback(async () => {
    setPhase("preparing");
    setErrorReason(null);
    setErrorParams(null);
    try {
      const list = tracks || [];
      const resolved = [];
      for (const [i, tr] of list.entries()) {
        const ask = () =>
          fetchTtsUrlResult({
            text: tr.text,
            learnLang: tr.learnLang,
            rate: tr.rate,
            voice: tr.voice,
          });

        let { url, reason, params } = await ask();
        if (!url && RETRYABLE_REASONS.includes(reason)) {
          // eslint-disable-next-line no-console
          console.warn(
            `[audio] дорожка ${i + 1}/${list.length} не получена (${reason}) — повтор`,
          );
          ({ url, reason, params } = await ask());
        }
        if (!url) {
          // Встали окончательно — говорим, на какой именно реплике: по экрану
          // это неразличимо, а для разбора важно (первая или, скажем, третья).
          // eslint-disable-next-line no-console
          console.warn(
            `[audio] озвучка диалога не готова: дорожка ${i + 1} из ${list.length}, причина ${reason || "failed"}, ${tr.learnLang}/${tr.voice ?? "primary"}`,
          );
          setErrorReason(reason || "failed");
          setErrorParams(params || null);
          setPhase("error");
          return null;
        }
        resolved.push(url);
      }
      const durs = await Promise.all(resolved.map(loadDuration));
      setUrls(resolved);
      setDurations(durs);
      setPhase("ready");
      return resolved;
    } catch {
      setErrorReason("failed");
      setPhase("error");
      return null;
    }
  }, [tracks]);

  // Автозапуск при появлении/смене содержимого (аудирование).
  useEffect(() => {
    if (!autoPlay || offline || !tracks || tracks.length === 0) return;
    let cancelled = false;
    (async () => {
      const resolved = await prepare();
      if (cancelled || !resolved) return;
      setActivated(true);
      seekOnLoadRef.current = 0;
      playOnLoadRef.current = true; // заиграет, когда загрузятся метаданные трека 0
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  // ---------- События <audio> ----------
  function onLoadedMetadata() {
    const audio = audioRef.current;
    if (!audio) return;
    if (seekOnLoadRef.current != null) {
      try {
        audio.currentTime = seekOnLoadRef.current;
      } catch {
        // некоторые браузеры не дают выставить currentTime до готовности — не страшно
      }
      setPosInTrack(seekOnLoadRef.current);
      seekOnLoadRef.current = null;
    }
    if (playOnLoadRef.current) {
      playOnLoadRef.current = false;
      claimAudio(pauseSelf);
      audio
        .play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }

  /**
   * Ошибка загрузки дорожки. Раньше её НИКТО не слушал (<audio> был без
   * onError): плеер оставался в состоянии «играет», шина — занятой, и звук не
   * возвращался до перезагрузки страницы. Теперь отпускаем шину и ОДИН раз
   * пробуем заново со свежими ссылками; если и это не помогло — честно уходим
   * в error, откуда кнопка запускает подготовку заново.
   */
  async function onAudioError() {
    setPlaying(false);
    releaseAudio(pauseSelf);
    if (retriedRef.current) {
      setErrorReason("failed");
      setPhase("error");
      return;
    }
    retriedRef.current = true;
    for (const tr of tracks || []) {
      forgetTtsUrl({
        text: tr.text,
        learnLang: tr.learnLang,
        rate: tr.rate,
        voice: tr.voice,
      });
    }
    seekOnLoadRef.current = posInTrack || 0;
    playOnLoadRef.current = true; // заиграет, как только приедут метаданные
    await prepare();
  }

  function onTimeUpdate() {
    if (scrub != null) return; // во время перемотки не дёргаем ползунок
    const audio = audioRef.current;
    if (audio) setPosInTrack(audio.currentTime);
  }

  function onEnded() {
    if (urls && index < urls.length - 1) {
      // Следующий отрезок склеенного аудио — играем без паузы.
      seekOnLoadRef.current = 0;
      playOnLoadRef.current = true;
      setIndex(index + 1);
    } else {
      // Конец: встаём в начало (готовы к повтору), звук отпускаем.
      setPlaying(false);
      releaseAudio(pauseSelf);
      if (index === 0) {
        const audio = audioRef.current;
        if (audio) {
          try {
            audio.currentTime = 0;
          } catch {
            // no-op
          }
        }
        setPosInTrack(0);
      } else {
        seekOnLoadRef.current = 0;
        playOnLoadRef.current = false;
        setIndex(0);
      }
    }
  }

  // ---------- Управление ----------
  async function handlePlayPause() {
    if (offline || phase === "preparing") return;

    // Первый запуск (или после ошибки) — сперва готовим кэш/шкалу.
    if (phase === "idle" || phase === "error") {
      const resolved = await prepare();
      if (!resolved) return;
      setActivated(true);
      seekOnLoadRef.current = posInTrack || 0;
      playOnLoadRef.current = true; // заиграет по загрузке метаданных
      return;
    }

    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      releaseAudio(pauseSelf);
    } else {
      // Продолжаем с текущего места (currentTime уже стоит где надо).
      claimAudio(pauseSelf);
      try {
        await audio.play();
        setPlaying(true);
      } catch {
        setPlaying(false);
      }
    }
  }

  /**
   * ПОВТОРИТЬ ОЗВУЧКУ — явное действие для уже готового содержимого: сходить за
   * звуком заново, ничего не пересоздавая (в аудировании это значит «не трогая
   * диалог» — новый диалог стоил бы вызова модели и нового синтеза).
   *
   * Не путать с кнопкой ↺ рядом с play: та переслушивает уже загруженное с
   * начала и живёт только в состоянии ready. Эта — единственный выход из
   * состояния «не загрузилось», и раньше её просто не было: повтор был спрятан
   * в кнопку play, и по виду плеера догадаться о нём было нельзя.
   */
  async function handleRetryAudio() {
    if (busy) return;
    // Свежие ссылки: если в кэш попал URL, который потом не проиграть,
    // повтор не должен подсунуть его же.
    for (const tr of tracks || []) {
      forgetTtsUrl({
        text: tr.text,
        learnLang: tr.learnLang,
        rate: tr.rate,
        voice: tr.voice,
      });
    }
    retriedRef.current = false; // снова даём право на авто-повтор при сбое загрузки
    const resolved = await prepare();
    if (!resolved) return;
    setActivated(true);
    seekOnLoadRef.current = posInTrack || 0;
    playOnLoadRef.current = true; // заиграет по загрузке метаданных
  }

  // Повтор с начала — отдельная кнопка.
  function handleRestart() {
    if (phase !== "ready") return;
    if (index === 0) {
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.currentTime = 0;
        } catch {
          // no-op
        }
      }
      setPosInTrack(0);
      claimAudio(pauseSelf);
      audio
        ?.play()
        .then(() => setPlaying(true))
        .catch(() => {});
    } else {
      seekOnLoadRef.current = 0;
      playOnLoadRef.current = true;
      setIndex(0);
    }
  }

  // Перемотка на момент combined-времени (в секундах общей шкалы).
  function seekToTime(target) {
    if (phase !== "ready" || total <= 0) return;
    const clamped = Math.max(0, Math.min(target, total));
    let i = 0;
    while (i < offsets.length - 1 && clamped >= offsets[i + 1]) i += 1;
    const offset = clamped - (offsets[i] || 0);
    if (i === index) {
      const audio = audioRef.current;
      if (audio) {
        try {
          audio.currentTime = offset;
        } catch {
          // no-op
        }
      }
      setPosInTrack(offset);
    } else {
      // Другой отрезок: перезагружаем трек, продолжая играть, если играли.
      seekOnLoadRef.current = offset;
      playOnLoadRef.current = playing;
      setIndex(i);
      setPosInTrack(offset); // оптимистично для отображения
    }
  }

  // Ползунок: во время движения только показываем позицию, перемотку применяем
  // на отпускании — так на длинном (многофайловом) аудио не дёргаем перезагрузку
  // трека на каждый шаг. Работает и тапом, и перетаскиванием, и с клавиатуры.
  function commitScrub() {
    if (scrub == null) return;
    seekToTime(scrub);
    setScrub(null);
  }

  const busy = phase === "preparing";
  const ready = phase === "ready";
  const failed = phase === "error";
  const disabled = offline;
  const label = ariaLabel || t("audio.player");

  // Нет сети мы знаем и без запроса — она главнее причины прошлой попытки.
  const reason = offline ? "offline" : errorReason || "failed";
  // Короткая подпись вместо таймера и развёрнутое объяснение под плеером.
  const shortKey =
    reason === "offline"
      ? "audio.offlineShort"
      : reason === "rateLimit" || reason === "rateCooldown"
        ? "audio.limitShort"
        : "audio.failedShort";
  const reasonKey = {
    offline: "audio.errOffline",
    // Сеть у устройства есть, а запрос не дошёл: сервер молчит, оборвалось
    // соединение. Совет «проверьте интернет» тут не по адресу — предлагаем повтор.
    netFailed: "audio.errNetwork",
    rateLimit: "audio.errLimit",
    rateCooldown: "audio.errCooldown",
    sessionExpired: "audio.errSession",
    unavailable: "audio.errUnavailable",
    failed: "audio.errFailed",
  }[reason];

  // Компактная кнопка (до первого запуска) — для списка предложений в чтении.
  if (compact && !activated) {
    return (
      <button
        type="button"
        className={`aplayer-mini${ember ? " aplayer-mini--ember" : ""}${disabled || failed ? " is-disabled" : ""}`}
        // После неудачи тап — это ПОВТОР озвучки (со свежими ссылками), а не
        // обычный запуск: подпись говорит об этом прямо.
        onClick={failed ? handleRetryAudio : handlePlayPause}
        disabled={disabled}
        aria-label={
          disabled ? t("audio.unavailable") : failed ? t("audio.retry") : label
        }
      >
        {busy ? (
          <span className="aplayer__spinner" aria-hidden="true" />
        ) : ember ? (
          <Icon name={disabled || failed ? "mute" : "speak"} size={20} />
        ) : (
          <span aria-hidden="true">{disabled || failed ? "🔇" : "🔊"}</span>
        )}
      </button>
    );
  }

  return (
    // Фрагмент, а не обёртка: .aplayer остаётся тем же элементом для внешних
    // раскладок (напр. .reading__text-head), а строка ошибки просто встаёт следом.
    <>
    <div className={`aplayer${ember ? " aplayer--ember" : ""}${disabled ? " is-disabled" : ""}`}>
      <audio
        ref={audioRef}
        src={urls ? urls[index] : undefined}
        preload="metadata"
        onLoadedMetadata={onLoadedMetadata}
        onTimeUpdate={onTimeUpdate}
        onEnded={onEnded}
        onError={onAudioError}
      />

      <button
        type="button"
        className="aplayer__btn aplayer__play"
        onClick={handlePlayPause}
        disabled={disabled}
        aria-label={playing ? t("audio.pause") : t("audio.play")}
      >
        {busy ? (
          <span className="aplayer__spinner" aria-hidden="true" />
        ) : (
          <Icon
            name={playing ? "pause" : "play"}
            size={16}
            fill="currentColor"
            stroke="none"
          />
        )}
      </button>

      <button
        type="button"
        className="aplayer__btn aplayer__restart"
        onClick={handleRestart}
        disabled={disabled || !ready}
        aria-label={t("audio.restart")}
      >
        <span aria-hidden="true">↺</span>
      </button>

      <input
        type="range"
        className="aplayer__bar"
        min={0}
        max={total || 0}
        step="0.1"
        value={Math.min(displayTime, total || 0)}
        disabled={disabled || !ready}
        onChange={(e) => setScrub(Number(e.target.value))}
        onPointerUp={commitScrub}
        onKeyUp={commitScrub}
        onBlur={commitScrub}
        aria-label={t("audio.seek")}
      />

      <span className="aplayer__time" aria-hidden="true">
        {failed ? t(shortKey) : `${fmt(displayTime)} / ${fmt(total)}`}
      </span>
    </div>

    {/* Не загрузилось: называем причину и даём повторить ОЗВУЧКУ — содержимое
        (диалог, текст) при этом не трогается и заново не генерируется. */}
    {failed && (
      <div
        className={`aplayer__error${ember ? " aplayer__error--ember" : ""}`}
        role="status"
      >
        <span className="aplayer__error-text">
          {t(reasonKey, { seconds: errorParams?.seconds ?? 1 })}
        </span>
        {/* «Текст не озвучить» повтором не лечится — кнопку не показываем.
            Офлайн кнопку показываем, но выключенной: она оживёт сама, когда
            вернётся связь (слушаем события online/offline выше). */}
        {reason !== "unavailable" && (
          <button
            type="button"
            className="aplayer__retry"
            onClick={handleRetryAudio}
            disabled={busy || offline}
          >
            {busy ? t("audio.retrying") : t("audio.retry")}
          </button>
        )}
      </div>
    )}
    </>
  );
}
