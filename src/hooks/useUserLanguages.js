import { useState, useEffect, useCallback } from "react";
import {
  fetchUserLanguages,
  getProfilePrefs,
  saveScheduleSettings,
  setMultiLangMode,
  deactivateNonPriorityLanguages,
  reactivateAllLanguages,
  DEFAULT_SCHEDULE_PREFS,
} from "../lib/userLanguages.js";

/**
 * Языки пользователя (фаза 4.1 — фундамент мультиязычности).
 *
 * При входе пользователя загружает его активные языковые пары из user_languages
 * и ЯВНЫЙ флаг мультирежима из profiles.multi_lang_mode, отдаёт:
 *   languages[]         — активные пары (learnLang/nativeLang/isPriority/…);
 *   priorityLanguage    — приоритетная пара (или первая, или null);
 *   multiLangMode       — осознанный выбор пользователя из profiles, а НЕ
 *                         следствие числа языков (languages.length здесь
 *                         больше НЕ используется);
 *   toggleMultiLangMode — включить/выключить режим (см. ниже);
 *   reload              — перечитать языки и флаг после внешних изменений.
 *
 * toggleMultiLangMode(true): пишет флаг в БД и возвращает ранее скрытые пары
 * (is_active=true). Если активная пара одна и скрытых нет — просто открывает
 * возможность, добавлять вторую пару не заставляет.
 * toggleMultiLangMode(false): пишет флаг и оставляет активной только
 * приоритетную пару (остальные is_active=false). Прогресс в user_words не
 * трогается — при повторном включении пары возвращаются.
 *
 * ВАЖНО: при multiLangMode=false интерфейс остаётся ровно как сейчас — никакие
 * переключатели не показываются, существующие экраны этот хук не используют и
 * продолжают читать прогресс из user_words.data (jsonb) напрямую.
 * Офлайн-фолбэк: без Supabase / без сети — languages=[] и multiLangMode=false,
 * toggle возвращает { ok: false } и состояние не врёт про сохранённое.
 */
export function useUserLanguages(user) {
  const [languages, setLanguages] = useState([]);
  const [multiLangMode, setMultiLangModeState] = useState(false);
  // Настройки недельного расписания (фаза 4.5) из profiles: дни в неделю,
  // режим ('by_day' | 'mixed') и сохранённая раскладка недели.
  const [schedulePrefs, setSchedulePrefs] = useState({
    studyDaysPerWeek: DEFAULT_SCHEDULE_PREFS.studyDaysPerWeek,
    scheduleMode: DEFAULT_SCHEDULE_PREFS.scheduleMode,
    weeklySchedule: DEFAULT_SCHEDULE_PREFS.weeklySchedule,
  });
  // true, пока после входа идёт первая загрузка языков (гейт от мигания
  // онбординга до того, как пары пришли из облака).
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    // Нет пользователя (гость/выход) — языков нет, режим одноязычный.
    if (!user) {
      setLanguages([]);
      setMultiLangModeState(false);
      setSchedulePrefs({
        studyDaysPerWeek: DEFAULT_SCHEDULE_PREFS.studyDaysPerWeek,
        scheduleMode: DEFAULT_SCHEDULE_PREFS.scheduleMode,
        weeklySchedule: DEFAULT_SCHEDULE_PREFS.weeklySchedule,
      });
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    (async () => {
      const [langs, prefs] = await Promise.all([
        fetchUserLanguages(user.id),
        getProfilePrefs(user.id),
      ]);
      if (active) {
        setLanguages(langs);
        setMultiLangModeState(prefs.multiLangMode);
        setSchedulePrefs({
          studyDaysPerWeek: prefs.studyDaysPerWeek,
          scheduleMode: prefs.scheduleMode,
          weeklySchedule: prefs.weeklySchedule,
        });
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Перечитать языки и настройки (после add/update/remove или внешних правок).
  const reload = useCallback(async () => {
    if (!user) return;
    const [langs, prefs] = await Promise.all([
      fetchUserLanguages(user.id),
      getProfilePrefs(user.id),
    ]);
    setLanguages(langs);
    setMultiLangModeState(prefs.multiLangMode);
    setSchedulePrefs({
      studyDaysPerWeek: prefs.studyDaysPerWeek,
      scheduleMode: prefs.scheduleMode,
      weeklySchedule: prefs.weeklySchedule,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Обновить настройки расписания: локально применяем СРАЗУ (офлайн-first,
  // UI не ждёт сеть), сохранение в profiles — best-effort.
  const updateSchedulePrefs = useCallback(
    async (partial) => {
      setSchedulePrefs((prev) => ({ ...prev, ...partial }));
      if (user) await saveScheduleSettings(user.id, partial);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  );

  // Явное включение/выключение мультирежима. Состояние меняем только после
  // успешной записи флага в БД — хук не врёт про сохранённое.
  const toggleMultiLangMode = useCallback(
    async (enabled) => {
      if (!user) return { ok: false };
      const res = await setMultiLangMode(user.id, enabled);
      if (!res.ok) return res;

      if (enabled) {
        // Возвращаем ранее скрытые пары (нет скрытых — просто открыли режим).
        await reactivateAllLanguages(user.id);
      } else {
        // Оставляем активной только приоритетную пару; прогресс не трогаем.
        await deactivateNonPriorityLanguages(user.id);
      }

      setMultiLangModeState(Boolean(enabled));
      setLanguages(await fetchUserLanguages(user.id));
      return { ok: true };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  );

  // Приоритетная пара: помеченная is_priority, иначе первая по порядку.
  const priorityLanguage =
    languages.find((l) => l.isPriority) || languages[0] || null;

  return {
    languages,
    priorityLanguage,
    multiLangMode,
    toggleMultiLangMode,
    // Недельное расписание (фаза 4.5).
    studyDaysPerWeek: schedulePrefs.studyDaysPerWeek,
    scheduleMode: schedulePrefs.scheduleMode,
    weeklySchedule: schedulePrefs.weeklySchedule,
    updateSchedulePrefs,
    loading,
    reload,
  };
}
