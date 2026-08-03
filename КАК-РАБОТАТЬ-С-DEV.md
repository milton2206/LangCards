# Как работать с dev и прод

С тех пор как приложением пользуются живые тестеры, всё новое сначала
проверяется на превью и только потом уезжает людям.

- **Ветка `main`** → боевой сайт `lang-cards-nine.vercel.app` → его видят тестеры
- **Ветка `dev`** → превью `lang-cards-git-dev-lang-cards.vercel.app` → только для тебя

Базы тоже разные: прод пишет в боевой Supabase, превью — в `langcards-staging`.
Ломать на превью можно что угодно, чужие данные не пострадают.

---

## Шпаргалка

```
Начинаю работу   →  git checkout dev  (проверить: git branch)
Промпты Claude   →  в конце "git push origin dev", а не просто git push
Проверяю         →  lang-cards-git-dev-lang-cards.vercel.app
Выкатываю людям  →  git checkout main && git merge dev && git push && git checkout dev
```

---

## Обычный цикл (без изменения базы)

1. Убедиться, что на нужной ветке:

   ```
   cd D:\Projects\lang-cards
   git branch
   ```

   Звёздочка должна быть на `dev`. Если нет — `git checkout dev`

2. Работать с Claude Code. В конце каждого промпта:

   ```
   В конце: git add ., коммит "...", git push origin dev
   ```

3. Открыть превью и проверить:

   ```
   lang-cards-git-dev-lang-cards.vercel.app
   ```

4. Когда всё хорошо — выкатить тестерам:

   ```
   git checkout main
   git merge dev
   git push
   git checkout dev
   ```

   Последняя строка обязательна — возвращает в `dev`, чтобы следующая
   работа снова шла туда, а не в прод по привычке.

---

## Если фаза меняет базу (есть новый schema.sql)

Порядок строгий, не путать:

1. Выполнить `schema.sql` в **staging** (проект `langcards-staging`)
2. Проверить на превью, что всё работает
3. **Бэкап прода:**

   ```
   npm run backup
   ```

4. Выполнить `schema.sql` в **боевой** базе
5. И только теперь `git merge dev` → `git push`

Схемы прода и staging должны совпадать. Если выполнить миграцию только
в staging и слить код в main — прод упадёт из-за отсутствующей колонки.

---

## Что важно помнить

- **Начинай сессию с `git branch`.** Две секунды, зато точно знаешь, где ты.
  Забыл переключиться на `dev` — правки уедут тестерам без проверки.
- **В staging нет общего кэша:** банка заданий для теста уровня, озвучки,
  сохранённых текстов. Это нормально — они генерируются в проде. На превью
  часть фич будет предлагать выбрать вручную или генерировать заново.
- **Бэкап нужен только для боевой базы.** Данные staging ничего не стоят.
- **Превью для ветки main тоже существует** (`lang-cards-git-main-...`) —
  но он показывает тот же код, что видят тестеры, и для проверки правок
  бесполезен. Нужен именно `-git-dev-`.

---

## Если что-то пошло не так

**Превью не собирается / нет адреса с dev**

```
git branch -a
```

Должна быть `remotes/origin/dev`. Если нет:

```
git push -u origin dev
```

Если ветка есть, но новых коммитов нет — Vercel нечего собирать:

```
git commit --allow-empty -m "chore: trigger dev preview"
git push origin dev
```

**На превью не работает вход / нет аккаунтов**

Значит переменные Preview не подхватились. Vercel → Settings →
Environment Variables, проверить галочку Preview у:

```
VITE_SUPABASE_URL
SUPABASE_URL
VITE_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
GOOGLE_TTS_CREDENTIALS_B64
```

После правки — Redeploy именно превью-деплоя (не production).

**Проверить, в какую базу пишет превью**

Зарегистрироваться на превью, потом в SQL Editor нужного проекта:

```sql
select email, created_at from auth.users order by created_at desc;
```

Аккаунт должен появиться в **staging**, а в боевой базе его быть не должно.
