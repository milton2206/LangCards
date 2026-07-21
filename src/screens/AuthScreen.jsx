import { useState } from "react";
import "./AuthScreen.css";

// Частые ошибки Supabase приходят на английском — показываем понятно по-русски.
function translateError(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "Неверный email или пароль.";
  if (m.includes("email not confirmed"))
    return "Email не подтверждён. Проверьте почту и перейдите по ссылке.";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "Такой email уже зарегистрирован. Войдите.";
  if (m.includes("password should be at least"))
    return "Пароль слишком короткий (минимум 6 символов).";
  if (m.includes("email") && m.includes("invalid"))
    return "Некорректный email. Проверьте адрес и попробуйте снова.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Слишком много попыток. Подождите немного и попробуйте снова.";
  if (m.includes("failed to fetch") || m.includes("network"))
    return "Нет соединения с сервером. Проверьте интернет и настройки Supabase.";
  return message || "Что-то пошло не так. Попробуйте ещё раз.";
}

/**
 * Экран входа/регистрации (email + пароль). Выбран пароль, а не magic-link:
 * работает без настройки доставки писем и предсказуемо для пользователя.
 *
 * Данные слов пока в localStorage — аккаунт нужен как подготовка к синхронизации.
 */
export default function AuthScreen({ onSignIn, onSignUp, onBack }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isSignup = mode === "signup";

  function switchMode(next) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    const mail = email.trim();
    if (!mail || !password) {
      setError("Введите email и пароль.");
      return;
    }
    if (isSignup && password.length < 6) {
      setError("Пароль слишком короткий (минимум 6 символов).");
      return;
    }

    setBusy(true);
    try {
      if (isSignup) {
        const data = await onSignUp(mail, password);
        // Если в проекте включено подтверждение email — сессии сразу нет.
        if (!data?.session) {
          setNotice(
            "Готово! Мы отправили письмо на " +
              mail +
              ". Перейдите по ссылке, чтобы подтвердить email, затем войдите.",
          );
          setMode("signin");
          setPassword("");
        }
        // Если подтверждение выключено — придёт сессия, экран закроется сам.
      } else {
        await onSignIn(mail, password);
        // Успех: onAuthStateChange обновит App и уведёт с этого экрана.
      }
    } catch (err) {
      setError(translateError(err?.message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="auth">
      <header className="auth__header">
        <button
          type="button"
          className="auth__back"
          onClick={onBack}
          aria-label="Назад"
        >
          ←
        </button>
        <h1 className="auth__title">{isSignup ? "Регистрация" : "Вход"}</h1>
      </header>

      <p className="auth__note">
        Аккаунт нужен для будущей синхронизации слов между устройствами. Сейчас
        слова хранятся на этом устройстве.
      </p>

      <div className="auth__tabs" role="tablist" aria-label="Вход или регистрация">
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          className={"auth__tab" + (!isSignup ? " is-active" : "")}
          onClick={() => switchMode("signin")}
        >
          Вход
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          className={"auth__tab" + (isSignup ? " is-active" : "")}
          onClick={() => switchMode("signup")}
        >
          Регистрация
        </button>
      </div>

      <form className="auth__form" onSubmit={handleSubmit}>
        <label className="auth__label">
          Email
          <input
            type="email"
            className="auth__input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            autoCapitalize="none"
            spellCheck="false"
            placeholder="you@example.com"
            required
          />
        </label>

        <label className="auth__label">
          Пароль
          <input
            type="password"
            className="auth__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={isSignup ? "минимум 6 символов" : "ваш пароль"}
            required
          />
        </label>

        {error && <p className="auth__error">{error}</p>}
        {notice && <p className="auth__notice">{notice}</p>}

        <button type="submit" className="auth__submit" disabled={busy}>
          {busy
            ? "Подождите…"
            : isSignup
              ? "Зарегистрироваться"
              : "Войти"}
        </button>
      </form>
    </section>
  );
}
