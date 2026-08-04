import { createClient } from "@supabase/supabase-js";

// Публичные переменные окружения (префикс VITE_ — Vite отдаёт их в браузер).
// anon-ключ ПУБЛИЧНЫЙ по замыслу Supabase: он не секрет, защита данных — это
// Row Level Security на стороне Supabase (см. supabase/schema.sql). Секретный
// service_role ключ здесь НЕ используется и во фронтенд не попадает.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Клиент создаётся только если заданы обе переменные. Пока Supabase не настроен
// (нет .env.local локально / Environment Variables на Vercel) — приложение
// продолжает работать на localStorage, а раздел «Аккаунт» показывает подсказку.
// Настройки сессии заданы ЯВНО, чтобы человека не выбрасывало в «войдите
// заново» посреди работы:
//   persistSession    — сессия переживает перезагрузку вкладки/приложения;
//   autoRefreshToken  — access-токен обновляется сам до истечения срока;
//   detectSessionInUrl — нужно ссылке восстановления пароля (recovery).
// Автообновления мало: когда вкладка долго в фоне (телефон заблокирован),
// таймер может не сработать вовремя, и первый же запрос уйдёт с протухшим
// токеном. Поэтому apiClient дополнительно обновляет токен перед запросом и
// повторяет запрос один раз при 401 (см. src/lib/apiClient.js).
export const supabase =
  url && anonKey
    ? createClient(url, anonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;

export const isSupabaseConfigured = Boolean(supabase);
