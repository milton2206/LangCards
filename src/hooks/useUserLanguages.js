import { useState, useEffect, useCallback } from "react";
import {
  fetchUserLanguages,
  getMultiLangMode,
  setMultiLangMode,
  deactivateNonPriorityLanguages,
  reactivateAllLanguages,
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
  // true, пока после входа идёт первая загрузка языков (гейт от мигания
  // онбординга до того, как пары пришли из облака).
  const [loading, setLoading] = useState(Boolean(user));

  useEffect(() => {
    // Нет пользователя (гость/выход) — языков нет, режим одноязычный.
    if (!user) {
      setLanguages([]);
      setMultiLangModeState(false);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    (async () => {
      const [langs, multi] = await Promise.all([
        fetchUserLanguages(user.id),
        getMultiLangMode(user.id),
      ]);
      if (active) {
        setLanguages(langs);
        setMultiLangModeState(multi);
        setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Перечитать языки и флаг (после add/update/remove или внешних правок).
  const reload = useCallback(async () => {
    if (!user) return;
    const [langs, multi] = await Promise.all([
      fetchUserLanguages(user.id),
      getMultiLangMode(user.id),
    ]);
    setLanguages(langs);
    setMultiLangModeState(multi);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

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
    loading,
    reload,
  };
}
