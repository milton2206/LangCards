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
-- Синхронизация прогресса: одна строка на пользователя, весь прогресс как jsonb
-- ----------------------------------------------------------------------------
-- Здесь хранятся takenWords / knownWords / skippedWords со всеми полями
-- повторения (interval, nextReviewDate, ease, repetitions, lastReviewed),
-- примерами предложений (wordInfo) и разбивкой по языковым парам — тот же
-- объект wordsByPair, что и в localStorage. Доступ строго к своей строке (RLS).
-- ============================================================================

create table if not exists public.user_words (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_words enable row level security;

drop policy if exists "user_words_select_own" on public.user_words;
create policy "user_words_select_own"
  on public.user_words for select
  using (auth.uid() = user_id);

drop policy if exists "user_words_insert_own" on public.user_words;
create policy "user_words_insert_own"
  on public.user_words for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_words_update_own" on public.user_words;
create policy "user_words_update_own"
  on public.user_words for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Реалтайм: правки на одном устройстве почти мгновенно прилетают на другие.
-- (Если строка уже добавлена в публикацию — Postgres кинет ошибку дубликата,
--  её можно игнорировать; идемпотентную проверку делаем через DO-блок.)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_words'
  ) then
    alter publication supabase_realtime add table public.user_words;
  end if;
end $$;

-- ============================================================================
-- Проверка RLS (по желанию):
--   1) В SQL Editor выполните: select * from public.profiles;
--      Через service-контекст SQL Editor вернёт все строки — это ожидаемо.
--   2) Реальную изоляцию проверяет фронтенд: войдя двумя разными аккаунтами,
--      supabase.from('profiles').select('*') вернёт КАЖДОМУ только его строку.
--      То же для user_words — каждый видит только свой прогресс.
-- ============================================================================

-- ============================================================================
-- Фаза 4.1 · Языки пользователя (фундамент мультиязычности)
-- ----------------------------------------------------------------------------
-- «Оглавление» языковых пар пользователя: какие пары он учит, какая приоритетная,
-- дневной лимит новых слов. ВАЖНО: прогресс слов по-прежнему живёт ЦЕЛИКОМ в
-- user_words.data (jsonb wordsByPair) и этой фазой НЕ затрагивается — существующие
-- экраны читают этот jsonb напрямую, как и раньше. user_languages — только список.
-- Скрипт идемпотентный: можно запускать повторно, ничего не задублируется.
-- ============================================================================

create table if not exists public.user_languages (
  user_id         uuid not null references auth.users (id) on delete cascade,
  learn_lang      text not null,
  native_lang     text not null,
  is_priority     boolean not null default false,
  daily_new_limit integer not null default 10,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  primary key (user_id, learn_lang, native_lang)
);

-- Индекс под основной запрос «активные языки пользователя по порядку добавления».
-- (Выборку по user_id покрывает и первичный ключ; частичный индекс держит её
--  дешёвой, когда у пользователя накапливаются неактивные строки.)
create index if not exists user_languages_active_idx
  on public.user_languages (user_id, created_at)
  where is_active;

alter table public.user_languages enable row level security;

-- Политики в том же стиле, что у profiles/user_words: доступ только к своим
-- строкам. Политики DELETE нет НАМЕРЕННО: «удаление» языка = is_active=false,
-- строка и прогресс в user_words сохраняются (RLS блокирует настоящий DELETE).
drop policy if exists "user_languages_select_own" on public.user_languages;
create policy "user_languages_select_own"
  on public.user_languages for select
  using (auth.uid() = user_id);

drop policy if exists "user_languages_insert_own" on public.user_languages;
create policy "user_languages_insert_own"
  on public.user_languages for insert
  with check (auth.uid() = user_id);

drop policy if exists "user_languages_update_own" on public.user_languages;
create policy "user_languages_update_own"
  on public.user_languages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- Инвариант: ровно ОДНА is_priority=true среди is_active=true ----------
-- CHECK не может смотреть на другие строки, поэтому триггер. Он держит инвариант
-- сам, чтобы клиенту хватало ОДНОГО update без транзакций:
--   • назначили приоритет строке → у остальных строк пользователя он снимается;
--   • первый/единственный активный язык автоматически становится приоритетным
--     (а попытка «снять» приоритет напрямую молча отменяется);
--   • деактивация приоритетной пары передаёт приоритет самой старой активной.
create or replace function public.user_languages_priority_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Служебные апдейты, которые делает сам триггер (глубина > 1), не трогаем —
  -- иначе демоушен старого приоритета зациклился бы с автоповышением.
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  if not new.is_active then
    -- Деактивация: строка не может оставаться приоритетной.
    if new.is_priority then
      new.is_priority := false;
      -- Передаём приоритет самой старой из оставшихся активных пар (если есть).
      update public.user_languages
         set is_priority = true
       where (user_id, learn_lang, native_lang) = (
               select user_id, learn_lang, native_lang
                 from public.user_languages
                where user_id = new.user_id
                  and is_active
                  and (learn_lang <> new.learn_lang
                       or native_lang <> new.native_lang)
                order by created_at
                limit 1
             );
    end if;
    return new;
  end if;

  if new.is_priority then
    -- Новый приоритет: у остальных строк пользователя приоритет снимается.
    update public.user_languages
       set is_priority = false
     where user_id = new.user_id
       and is_priority
       and (learn_lang <> new.learn_lang or native_lang <> new.native_lang);
  elsif not exists (
    select 1
      from public.user_languages
     where user_id = new.user_id
       and is_active
       and is_priority
       and (learn_lang <> new.learn_lang or native_lang <> new.native_lang)
  ) then
    -- Активного приоритета не осталось — эта строка становится приоритетной.
    new.is_priority := true;
  end if;

  return new;
end;
$$;

drop trigger if exists user_languages_priority on public.user_languages;
create trigger user_languages_priority
  before insert or update on public.user_languages
  for each row execute function public.user_languages_priority_guard();

-- ---------- Миграция: заполняем user_languages из ключей user_words.data ----------
-- Ключ "de-ru" → learn_lang='de', native_lang='ru'. Первый ключ пользователя
-- получает is_priority=true (остальным приоритет не ставим — триггер это уважает).
-- Идемпотентно: on conflict do nothing — повторный запуск ничего не перетирает,
-- в т.ч. ручные изменения приоритета. Данные user_words НЕ изменяются.
-- Заметка: jsonb не хранит порядок вставки ключей, «первый» = первый в порядке
-- обхода jsonb_object_keys (для одной пары — а таких пользователей большинство —
-- это без разницы).
insert into public.user_languages (user_id, learn_lang, native_lang, is_priority)
select uw.user_id,
       split_part(k.key, '-', 1),
       split_part(k.key, '-', 2),
       (row_number() over (partition by uw.user_id order by k.ord) = 1)
  from public.user_words uw
 cross join lateral jsonb_object_keys(uw.data) with ordinality as k(key, ord)
 where split_part(k.key, '-', 1) <> ''
   and split_part(k.key, '-', 2) <> ''
on conflict (user_id, learn_lang, native_lang) do nothing;

-- ============================================================================
-- Проверка фазы 4.1 (по желанию, в SQL Editor):
--   select user_id, learn_lang, native_lang, is_priority, is_active
--     from public.user_languages order by user_id, created_at;
--   Ожидаемо: по строке на каждую пару из user_words.data; у каждого
--   пользователя ровно одна строка с is_priority=true. user_words не изменился:
--   select user_id, jsonb_object_keys(data) from public.user_words;
-- ============================================================================

-- ============================================================================
-- Фаза 4.1 (дополнение) · Явный флаг мультиязычного режима
-- ----------------------------------------------------------------------------
-- Мультирежим — осознанный выбор пользователя, а НЕ следствие числа языков.
-- Флаг живёт в profiles (строка создаётся автоматически при регистрации, см.
-- handle_new_user), новые пользователи стартуют с false — интерфейс как сейчас.
-- RLS уже покрывает profiles (политики *_own выше) — новых политик не нужно.
-- Идемпотентно: add column if not exists.
--
-- Поведение (реализует клиент, см. useUserLanguages):
--   • false: активна ровно одна пара (is_priority); остальные пары лежат в
--     user_languages с is_active=false — прогресс в user_words не трогается,
--     при включении режима пары возвращаются (is_active=true);
--   • true: доступны переключатель/приоритет/баланс (фазы 4.2–4.4).
-- ============================================================================

alter table public.profiles
  add column if not exists multi_lang_mode boolean not null default false;

-- ============================================================================
-- Фаза 4.5 · Недельное расписание языков
-- ----------------------------------------------------------------------------
-- Вместо смешивания языков внутри дня — раскладка по дням недели:
--   study_days_per_week — сколько дней в неделю пользователь занимается (3–7);
--   schedule_mode       — 'by_day' (один язык в день) | 'mixed' (как в 4.3);
--   weekly_schedule     — раскладка: ключ = день недели (1=пн … 7=вс),
--                         значение = пара вида "de-ru" или null (выходной).
-- Раскладку считает клиент (см. src/lib/weeklySchedule.js) и сохраняет сюда,
-- чтобы устройства видели одно расписание. RLS profiles уже покрывает —
-- новых политик не нужно. Идемпотентно.
-- ============================================================================

alter table public.profiles
  add column if not exists study_days_per_week integer not null default 7;

alter table public.profiles
  add column if not exists schedule_mode text not null default 'by_day';

alter table public.profiles
  add column if not exists weekly_schedule jsonb not null default '{}'::jsonb;
