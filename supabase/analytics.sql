-- ============================================================================
-- LangCards · Аналитика без внешних сервисов (фаза 7.1)
-- ----------------------------------------------------------------------------
-- Готовые запросы для SQL Editor в Supabase. Никаких трекеров и кукибаннеров —
-- только две колонки в profiles (created_at, last_seen) и данные user_words.
--
-- ВАЖНО про модель данных и честность метрик:
--   last_seen хранит ТОЛЬКО момент последнего захода (обновляется не чаще раза
--   в сутки). Это НЕ журнал заходов по дням. Поэтому «вернулся на N-й день»
--   здесь измеряется как «был активен хотя бы на N-й день после регистрации»
--   (last_seen дотянулся до этого дня). Точное «заходил ИМЕННО во 2-й день, но
--   не в 3-й» по одному last_seen восстановить нельзя — для этого нужен журнал
--   событий (отдельная таблица), которого намеренно нет.
--
-- «День 1» = день регистрации. «День 2» = регистрация + 1 сутки. И т.д.
-- Все даты сравниваются по календарным суткам UTC.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1) Сколько зарегистрировалось за период
-- ---------------------------------------------------------------------------
-- Замените границы под нужный период. Пример: за последние 30 дней.
select count(*) as signups
from public.profiles
where created_at >= now() - interval '30 days';

-- Помесячно (динамика регистраций):
select date_trunc('month', created_at) as month, count(*) as signups
from public.profiles
group by 1
order by 1;


-- ---------------------------------------------------------------------------
-- 2) Возврат на 2-й день (удержание к D2)
-- ---------------------------------------------------------------------------
-- Из тех, кто зарегистрировался достаточно давно, чтобы 2-й день вообще успел
-- наступить (created_at <= сегодня - 1 день), сколько были активны на 2-й день
-- или позже (last_seen дотянулся до дня регистрации + 1).
select
  count(*) filter (
    where created_at::date <= (now() at time zone 'utc')::date - 1
  ) as eligible,
  count(*) filter (
    where created_at::date <= (now() at time zone 'utc')::date - 1
      and last_seen is not null
      and last_seen::date >= created_at::date + 1
  ) as returned_d2,
  round(
    100.0 * count(*) filter (
      where created_at::date <= (now() at time zone 'utc')::date - 1
        and last_seen is not null
        and last_seen::date >= created_at::date + 1
    ) / nullif(count(*) filter (
      where created_at::date <= (now() at time zone 'utc')::date - 1
    ), 0), 1
  ) as retention_d2_pct
from public.profiles;


-- ---------------------------------------------------------------------------
-- 3) Возврат на 7-й день (удержание к D7)
-- ---------------------------------------------------------------------------
-- То же, но горизонт 7 дней: eligible — кто зарегистрировался >= 6 дней назад;
-- returned — кто был активен на 7-й день или позже (created_at + 6 суток).
select
  count(*) filter (
    where created_at::date <= (now() at time zone 'utc')::date - 6
  ) as eligible,
  count(*) filter (
    where created_at::date <= (now() at time zone 'utc')::date - 6
      and last_seen is not null
      and last_seen::date >= created_at::date + 6
  ) as returned_d7,
  round(
    100.0 * count(*) filter (
      where created_at::date <= (now() at time zone 'utc')::date - 6
        and last_seen is not null
        and last_seen::date >= created_at::date + 6
    ) / nullif(count(*) filter (
      where created_at::date <= (now() at time zone 'utc')::date - 6
    ), 0), 1
  ) as retention_d7_pct
from public.profiles;


-- ---------------------------------------------------------------------------
-- 4) Отвалились сразу после регистрации («bounce»)
-- ---------------------------------------------------------------------------
-- Зарегистрировались давно (был шанс вернуться — берём >= 2 дней назад), но
-- активность так и осталась только в день регистрации: last_seen пуст или не
-- вышел за день создания.
select count(*) as bounced_after_signup
from public.profiles
where created_at::date <= (now() at time zone 'utc')::date - 1
  and (last_seen is null or last_seen::date <= created_at::date);


-- ---------------------------------------------------------------------------
-- 5) Взяли хотя бы одно слово
-- ---------------------------------------------------------------------------
-- «Взято» слово = в user_words.data по любой языковой паре непуст takenWords или
-- knownWords (форма данных: { "de-ru": { takenWords:[…], knownWords:[…], … } }).
-- Считаем уникальных пользователей и долю от всех зарегистрированных.
with engaged as (
  select distinct uw.user_id
  from public.user_words uw
  cross join lateral jsonb_each(uw.data) as pair(key, val)
  where jsonb_array_length(coalesce(val->'takenWords', '[]'::jsonb)) > 0
     or jsonb_array_length(coalesce(val->'knownWords', '[]'::jsonb)) > 0
)
select
  (select count(*) from public.profiles)          as total_users,
  (select count(*) from engaged)                  as took_a_word,
  round(
    100.0 * (select count(*) from engaged)
    / nullif((select count(*) from public.profiles), 0), 1
  )                                               as took_a_word_pct;


-- ---------------------------------------------------------------------------
-- Бонус) Откуда приходят (signup_source)
-- ---------------------------------------------------------------------------
-- NULL = зашли без метки ?src/?ref/?utm_source.
select coalesce(signup_source, '(без метки)') as source, count(*) as users
from public.profiles
group by 1
order by users desc;
