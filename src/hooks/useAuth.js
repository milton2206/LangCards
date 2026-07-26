import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

// ---------- Разбор адреса ссылки восстановления ----------
// Ссылка из письма сброса приводит на приложение с фрагментом вида
//   #access_token=…&type=recovery         — ссылка валидна (сессия восстановления);
//   #error=access_denied&error_code=otp_expired&…  — ссылка истекла/недействительна.
// Читаем это СРАЗУ при загрузке модуля — до того как supabase-js обработает и
// очистит хеш (обработка асинхронная, а eval модуля синхронный, так что успеваем).
// Дополнительно ловим событие PASSWORD_RECOVERY ниже — на случай иного порядка.
function readAuthHash() {
  try {
    const raw = (window.location.hash || "").replace(/^#/, "");
    const params = new URLSearchParams(raw);
    return {
      type: params.get("type"),
      error: params.get("error") || params.get("error_code"),
      errorDesc: params.get("error_description") || "",
    };
  } catch {
    return {};
  }
}

const HASH = readAuthHash();
const INITIAL_RECOVERY = HASH.type === "recovery" && !HASH.error;
const INITIAL_RECOVERY_ERROR = HASH.error
  ? /expired|otp_expired/i.test(`${HASH.error} ${HASH.errorDesc}`)
    ? "expired"
    : "invalid"
  : null;

/**
 * Состояние аутентификации Supabase (email + пароль) + восстановление/смена пароля.
 *
 * С фазы 4.2 вход ОБЯЗАТЕЛЕН. Если Supabase не настроен (нет переменных
 * окружения) — hook отдаёт configured=false, а UI показывает подсказку.
 *
 * recovery — пользователь пришёл по ссылке сброса пароля: App показывает экран
 * ввода нового пароля вместо обычного контента. recoveryError — ссылка истекла
 * или недействительна (показываем понятное сообщение на экране входа).
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  // Пока не настроен Supabase — грузить нечего.
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recovery, setRecovery] = useState(INITIAL_RECOVERY);
  const [recoveryError, setRecoveryError] = useState(INITIAL_RECOVERY_ERROR);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Держим состояние в синхроне с логином/логаутом/обновлением токена.
    // PASSWORD_RECOVERY — пользователь перешёл по ссылке сброса: включаем режим
    // ввода нового пароля.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email, password) => {
    if (!supabase) throw new Error("Supabase не настроен.");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  }, []);

  const signIn = useCallback(async (email, password) => {
    if (!supabase) throw new Error("Supabase не настроен.");
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  // Отправка письма со ссылкой сброса. redirectTo — origin приложения, куда
  // Supabase вернёт пользователя с токеном восстановления в адресе. Этот адрес
  // должен быть в списке разрешённых редиректов проекта (см. README/настройку).
  const sendPasswordReset = useCallback(async (email) => {
    if (!supabase) throw new Error("Supabase не настроен.");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }, []);

  // Смена пароля текущего пользователя (и для входа, и в режиме восстановления —
  // там уже есть сессия восстановления). Пароли Supabase хранит сам, руками
  // ничего не держим.
  const updatePassword = useCallback(async (password) => {
    if (!supabase) throw new Error("Supabase не настроен.");
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  // Выход из режима восстановления после успешной смены пароля (или отмены).
  const clearRecovery = useCallback(() => {
    setRecovery(false);
    setRecoveryError(null);
  }, []);

  return {
    configured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    loading,
    recovery,
    recoveryError,
    signUp,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    clearRecovery,
  };
}
