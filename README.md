# LangCards — Карточки: учи слова в контексте

Языковое приложение с карточками для запоминания иностранных слов в контексте
живых примеров. Каркас построен **mobile-first**: сначала узкий экран (375px),
затем расширение под десктоп.

## Технологии

- [React 19](https://react.dev/)
- [Vite](https://vite.dev/)

## Быстрый старт

```bash
npm install     # установка зависимостей
npm run dev     # запуск дев-сервера (http://localhost:5173)
npm run build   # прод-сборка в dist/
npm run preview # предпросмотр прод-сборки
```

## Структура

```
src/
  components/        # переиспользуемые UI-компоненты
    AppShell.jsx     # центрирующий контейнер с max-width для десктопа
  screens/           # экраны приложения
    StartScreen.jsx  # стартовый экран (заглушка «в разработке»)
  App.jsx            # корневой компонент
  main.jsx           # точка входа
  index.css          # глобальные стили и дизайн-токены (тёмная тема)
```

## Аккаунты (Supabase Auth)

Вход/регистрация по email + паролю. Аккаунты пока **опциональны** — слова
хранятся в `localStorage`; вход нужен как подготовка к синхронизации между
устройствами (следующая фаза). Раздел «Аккаунт» — в «Настройках».

### 1. Создать проект Supabase

1. Зайдите на [supabase.com](https://supabase.com) → **Start your project** →
   войдите (GitHub/email).
2. **New project**: имя (напр. `langcards`), придумайте **Database Password**
   (сохраните — но во фронтенде он не нужен), выберите ближайший регион.
   Тариф **Free** подходит. Дождитесь, пока проект развернётся (~1–2 мин).

### 2. Где взять Project URL и anon-ключ

Dashboard проекта → **Project Settings** (шестерёнка) → **API**:

- **Project URL** — например `https://xxxx.supabase.co` → это `VITE_SUPABASE_URL`.
- **Project API keys → `anon` `public`** → это `VITE_SUPABASE_ANON_KEY`.

> `anon` (public) ключ **не секрет** — он и создан, чтобы жить во фронтенде.
> Защиту данных обеспечивает RLS (ниже), а не тайна ключа.
> Ключ **`service_role` (secret)** НИКОГДА не кладите во фронтенд и не коммитьте.

### 3. Куда вставить ключи

Так же, как `ANTHROPIC_API_KEY` — через переменные окружения (файл не коммитится):

- **Локально:** скопируйте `.env.example` → `.env.local` и заполните:
  ```
  VITE_SUPABASE_URL=https://xxxx.supabase.co
  VITE_SUPABASE_ANON_KEY=eyJ...
  ```
  Перезапустите `npm run dev` (Vite читает env при старте).
- **На Vercel:** Project → **Settings → Environment Variables** → добавьте те же
  две переменные (Production + Preview) → **Redeploy**.

### 4. Включить RLS (доступ только к своим данным)

RLS (Row Level Security) — защита на стороне БД: каждый пользователь видит и
меняет только свои строки, даже с публичным anon-ключом.

1. Dashboard → **SQL Editor** → **New query**.
2. Вставьте целиком файл [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
   Он создаёт таблицу `profiles`, **включает RLS** и заводит политики
   `auth.uid() = id` (только своя строка) + триггер автосоздания профиля.
3. Проверка: **Table Editor → profiles** — у таблицы должна гореть плашка
   **RLS enabled**. В **Authentication → Policies** видны три политики.

> На вкладке **Authentication → Providers → Email** можно на время тестов
> выключить **Confirm email**, чтобы регистрация сразу давала вход без письма.

### 5. Проверить

Откройте приложение → **Настройки → Аккаунт** → «Войти / Зарегистрироваться».
Зарегистрируйтесь, выйдите, войдите снова. В Supabase → **Authentication →
Users** появится ваш пользователь, в **profiles** — его строка.

## Принципы mobile-first

- `box-sizing: border-box` глобально, `overflow-x: hidden` на `body`
- вёрстка под узкий экран 375px без горизонтального скролла
- минимальная высота кнопок и полей — 44px (удобный тап-таргет)
- `font-size: 16px` у полей ввода (iOS не зумит при фокусе)
- тёмная тема, контейнер по центру с `max-width` для десктопа
- `<meta name="viewport" content="width=device-width, initial-scale=1">`

> Статус: приложение в разработке.
