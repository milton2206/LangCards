import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

// ============================================================================
// Надёжное определение восстановления пароля (ссылка из письма сброса).
// ----------------------------------------------------------------------------
// Ссылка по клику приводит на приложение, а supabase-js создаёт сессию
// восстановления. Если это НЕ перехватить — человек «магически» попадёт на
// главный экран, не сменив пароль. Ловим восстановление ТРЕМЯ путями, потому что
// порядок инициализации supabase-js не гарантирован, а событие одноразовое:
//   1) синхронно читаем адрес при загрузке модуля (хеш И query) — до того как
//      supabase-js обработает и очистит URL;
//   2) подписываемся на onAuthStateChange ЗДЕСЬ ЖЕ, на уровне модуля, — эта
//      подписка регистрируется РАНЬШЕ асинхронной обработки URL, поэтому не
//      пропускает событие PASSWORD_RECOVERY (в отличие от подписки в React-
//      эффекте, который выполняется позже и может опоздать);
//   3) дублирующая подписка в эффекте самого хука — на всякий случай.
// ============================================================================

function readRecoveryFromUrl() {
  try {
    const hash = new URLSearchParams(
      (window.location.hash || "").replace(/^#/, ""),
    );
    const query = new URLSearchParams(window.location.search || "");
    const get = (k) => hash.get(k) || query.get(k);
    return {
      type: get("type"),
      error: get("error") || get("error_code"),
      errorDesc: get("error_description") || "",
    };
  } catch {
    return {};
  }
}

const URL_RECOVERY = readRecoveryFromUrl();

// Модульные флаги: начальное значение — из адреса, дальше могут стать true по
// событию PASSWORD_RECOVERY. recoveryFlag сбрасывается после успешной смены
// пароля (clearRecovery), чтобы режим не включился повторно.
let recoveryFlag = URL_RECOVERY.type === "recovery" && !URL_RECOVERY.error;
const recoveryErrorInitial = URL_RECOVERY.error
  ? /expired|otp_expired/i.test(`${URL_RECOVERY.error} ${URL_RECOVERY.errorDesc}`)
    ? "expired"
    : "invalid"
  : null;

// Кому сообщить, что восстановление обнаружено (экземпляры useAuth).
const recoverySubscribers = new Set();

if (supabase) {
  // Подписка на уровне модуля — регистрируется до асинхронной обработки URL в
  // supabase-js, поэтому событие PASSWORD_RECOVERY не теряется, даже если оно
  // сработает раньше, чем смонтируется React.
  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      recoveryFlag = true;
      recoverySubscribers.forEach((cb) => cb());
    }
  });
}

/**
 * Состояние аутентификации Supabase (email + пароль) + восстановление/смена пароля.
 *
 * С фазы 4.2 вход ОБЯЗАТЕЛЕН. Если Supabase не настроен (нет переменных
 * окружения) — hook отдаёт configured=false, а UI показывает подсказку.
 *
 * recovery — пользователь пришёл по ссылке сброса пароля: App показывает экран
 * ввода нового пароля вместо обычного контента (и не пускает на главную, пока
 * пароль не сменён). recoveryError — ссылка истекла или недействительна.
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  // Пока не настроен Supabase — грузить нечего.
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recovery, setRecovery] = useState(recoveryFlag);
  const [recoveryError, setRecoveryError] = useState(recoveryErrorInitial);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    // Подхватываем событие PASSWORD_RECOVERY, пойманное модульной подпиской
    // (в т.ч. если оно пришло между загрузкой модуля и монтированием).
    const onRecovery = () => {
      if (active) setRecovery(true);
    };
    recoverySubscribers.add(onRecovery);
    if (recoveryFlag) setRecovery(true);

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Держим состояние в синхроне с логином/логаутом/обновлением токена.
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
    });

    return () => {
      active = false;
      recoverySubscribers.delete(onRecovery);
      sub.subscription.unsubscribe();
    };
  }, []);

  // Регистрация. emailRedirectTo — куда ведёт ссылка из письма подтверждения:
  // без него Supabase подставляет Site URL проекта, и человек, регистрировавшийся
  // с превью или локально, после клика попадал на прод (или вовсе не туда).
  //
  // ВАЖНО про ответ: при включённой защите от перебора адресов (Prevent
  // enumeration attacks) регистрация на УЖЕ занятый email не даёт ошибки —
  // приходит успех с user без сессии и с ПУСТЫМ user.identities, и письмо не
  // отправляется. Разбирает этот случай экран (AuthScreen), здесь просто отдаём
  // data как есть.
  const signUp = useCallback(async (email, password) => {
    if (!supabase) throw new Error("Supabase не настроен.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
    return data;
  }, []);

  // Повторная отправка письма подтверждения регистрации. Нужна, когда письмо не
  // дошло или потерялось: отдельный вызов Supabase, пароль для него не нужен.
  const resendConfirmation = useCallback(async (email) => {
    if (!supabase) throw new Error("Supabase не настроен.");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
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

  // Выход из режима восстановления после успешной смены пароля. Сбрасываем и
  // модульный флаг — иначе восстановление могло бы включиться повторно.
  const clearRecovery = useCallback(() => {
    recoveryFlag = false;
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
    resendConfirmation,
    signIn,
    signOut,
    sendPasswordReset,
    updatePassword,
    clearRecovery,
  };
}
