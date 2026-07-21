import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "../lib/supabase.js";

/**
 * Состояние аутентификации Supabase (email + пароль).
 *
 * Аккаунты пока НЕ обязательны: данные слов остаются в localStorage, вход нужен
 * как подготовка к синхронизации (следующая фаза). Если Supabase не настроен
 * (нет переменных окружения) — hook отдаёт configured=false, а UI показывает
 * подсказку вместо форм.
 */
export function useAuth() {
  const [session, setSession] = useState(null);
  // Пока не настроен Supabase — грузить нечего.
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Держим состояние в синхроне с логином/логаутом/обновлением токена.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
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

  return {
    configured: isSupabaseConfigured,
    session,
    user: session?.user ?? null,
    loading,
    signUp,
    signIn,
    signOut,
  };
}
