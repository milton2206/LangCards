-- ============================================================================
-- LangCards · Supabase · Схема + Row Level Security (RLS)
-- ----------------------------------------------------------------------------
-- Как применить: Supabase Dashboard → SQL Editor → New query → вставить этот
-- файл целиком → Run. Скрипт идемпотентный (можно запускать повторно).
--
-- Зачем: RLS гарантирует, что каждый пользователь видит и меняет ТОЛЬКО свои
-- строки. Даже с публичным anon-ключом во фронтенде чужие данные недоступны —
-- политики проверяют auth.uid() (id вошедшего пользователя) на стороне БД.
-- Синхронизация слов будет в следующей фазе; сейчас таблица profiles нужна,
-- чтобы включить и проверить RLS на понятном примере.
-- ============================================================================

-- ---------- Таблица профилей (1 строка на пользователя) ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users (id) on delete cascade,
  email      text,
  created_at timestamptz not null default now()
);

-- ---------- Включаем RLS (без политик доступ будет закрыт полностью) ----------
alter table public.profiles enable row level security;

-- ---------- Политики: доступ только к своей строке (id = auth.uid()) ----------
-- Пересоздаём идемпотентно.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------- Автосоздание профиля при регистрации ----------
-- При появлении пользователя в auth.users заводим ему строку в profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Проверка RLS (по желанию):
--   1) В SQL Editor выполните: select * from public.profiles;
--      Через service-контекст SQL Editor вернёт все строки — это ожидаемо.
--   2) Реальную изоляцию проверяет фронтенд: войдя двумя разными аккаунтами,
--      supabase.from('profiles').select('*') вернёт КАЖДОМУ только его строку.
-- ============================================================================
