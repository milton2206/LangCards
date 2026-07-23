-- ============================================================================
-- LangCards · ОТКАТ фазы 4.1 (таблица user_languages)
-- ----------------------------------------------------------------------------
-- Выполнять ТОЛЬКО если нужно полностью убрать список языков пользователя.
-- Прогресс слов НЕ затрагивается: user_words.data остаётся как был, существующие
-- экраны продолжают работать (они читают этот jsonb напрямую).
-- Скрипт идемпотентный: повторный запуск не даёт ошибок.
-- ============================================================================

-- Всё, что привязано к таблице (триггер, политики, индексы), удаляем внутри
-- условного блока — иначе DROP TRIGGER/POLICY падал бы, если таблицы уже нет.
do $$
begin
  if exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'user_languages'
  ) then
    drop trigger if exists user_languages_priority on public.user_languages;
    drop policy if exists "user_languages_select_own" on public.user_languages;
    drop policy if exists "user_languages_insert_own" on public.user_languages;
    drop policy if exists "user_languages_update_own" on public.user_languages;
    drop index if exists public.user_languages_active_idx;
    drop table public.user_languages;
  end if;
end $$;

-- Функция триггера живёт отдельно от таблицы — удаляем последней.
drop function if exists public.user_languages_priority_guard();

-- Дополнение фазы 4.1: явный флаг мультиязычного режима в profiles.
-- Сама таблица profiles и её политики остаются — убираем только колонку.
alter table public.profiles
  drop column if exists multi_lang_mode;
