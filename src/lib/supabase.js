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
export const supabase =
  url && anonKey ? createClient(url, anonKey) : null;

export const isSupabaseConfigured = Boolean(supabase);
