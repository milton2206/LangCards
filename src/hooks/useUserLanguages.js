import { useState, useEffect, useCallback } from "react";
import { fetchUserLanguages } from "../lib/userLanguages.js";

/**
 * Языки пользователя (фаза 4.1 — фундамент мультиязычности).
 *
 * При входе пользователя загружает его активные языковые пары из user_languages
 * и отдаёт:
 *   languages[]      — активные пары (learnLang/nativeLang/isPriority/…);
 *   priorityLanguage — приоритетная пара (или первая, или null);
 *   multiLangMode    — languages.length > 1: фазы 4.2–4.4 будут включать по
 *                      нему мультиязычный UI (переключатели и т.п.);
 *   reload           — перечитать список после add/update/remove.
 *
 * ВАЖНО: при multiLangMode=false интерфейс остаётся ровно как сейчас — никакие
 * переключатели не показываются, существующие экраны этот хук не используют и
 * продолжают читать прогресс из user_words.data (jsonb) напрямую.
 * Офлайн-фолбэк: без Supabase / без сети fetchUserLanguages тихо отдаёт [] —
 * приложение работает как обычно на localStorage.
 */
export function useUserLanguages(user) {
  const [languages, setLanguages] = useState([]);

  useEffect(() => {
    // Нет пользователя (гость/выход) — языков нет, режим одноязычный.
    if (!user) {
      setLanguages([]);
      return;
    }

    let active = true;
    (async () => {
      const langs = await fetchUserLanguages(user.id);
      if (active) setLanguages(langs);
    })();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Перечитать список (после добавления/удаления/смены приоритета).
  const reload = useCallback(async () => {
    if (!user) return;
    setLanguages(await fetchUserLanguages(user.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Приоритетная пара: помеченная is_priority, иначе первая по порядку.
  const priorityLanguage =
    languages.find((l) => l.isPriority) || languages[0] || null;
  const multiLangMode = languages.length > 1;

  return { languages, priorityLanguage, multiLangMode, reload };
}
