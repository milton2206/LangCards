import { useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./AuthScreen.css";

// Частые ошибки Supabase приходят на английском — сопоставляем с ключом перевода.
function errorKey(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "auth.err.invalidCreds";
  if (m.includes("email not confirmed")) return "auth.err.notConfirmed";
  if (m.includes("user already registered") || m.includes("already been registered"))
    return "auth.err.alreadyRegistered";
  if (m.includes("password should be at least")) return "auth.pwShort";
  if (m.includes("email") && m.includes("invalid")) return "auth.err.invalidEmail";
  if (m.includes("rate limit") || m.includes("too many")) return "auth.err.rateLimit";
  if (m.includes("failed to fetch") || m.includes("network")) return "auth.err.network";
  return "auth.err.generic";
}

/**
 * Экран входа/регистрации (email + пароль). Выбран пароль, а не magic-link:
 * работает без настройки доставки писем и предсказуемо для пользователя.
 *
 * Данные слов пока в localStorage — аккаунт нужен как подготовка к синхронизации.
 */
export default function AuthScreen({ onSignIn, onSignUp, onBack }) {
  const { t } = useI18n();
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
      setError(t("auth.enterCreds"));
      return;
    }
    if (isSignup && password.length < 6) {
      setError(t("auth.pwShort"));
      return;
    }

    setBusy(true);
    try {
      if (isSignup) {
        const data = await onSignUp(mail, password);
        // Если в проекте включено подтверждение email — сессии сразу нет.
        if (!data?.session) {
          setNotice(t("auth.confirmSent", { email: mail }));
          setMode("signin");
          setPassword("");
        }
        // Если подтверждение выключено — придёт сессия, экран закроется сам.
      } else {
        await onSignIn(mail, password);
        // Успех: onAuthStateChange обновит App и уведёт с этого экрана.
      }
    } catch (err) {
      setError(t(errorKey(err?.message)));
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
          aria-label={t("common.back")}
        >
          ←
        </button>
        <h1 className="auth__title">
          {isSignup ? t("auth.signup") : t("auth.signin")}
        </h1>
      </header>

      <p className="auth__note">{t("auth.note")}</p>

      <div className="auth__tabs" role="tablist" aria-label={t("auth.tabsAria")}>
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          className={"auth__tab" + (!isSignup ? " is-active" : "")}
          onClick={() => switchMode("signin")}
        >
          {t("auth.signin")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          className={"auth__tab" + (isSignup ? " is-active" : "")}
          onClick={() => switchMode("signup")}
        >
          {t("auth.signup")}
        </button>
      </div>

      <form className="auth__form" onSubmit={handleSubmit}>
        <label className="auth__label">
          {t("auth.email")}
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
          {t("auth.password")}
          <input
            type="password"
            className="auth__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={isSignup ? "new-password" : "current-password"}
            placeholder={
              isSignup
                ? t("auth.pwPlaceholderSignup")
                : t("auth.pwPlaceholderSignin")
            }
            required
          />
        </label>

        {error && <p className="auth__error">{error}</p>}
        {notice && <p className="auth__notice">{notice}</p>}

        <button type="submit" className="auth__submit" disabled={busy}>
          {busy
            ? t("auth.busy")
            : isSignup
              ? t("auth.submitSignup")
              : t("auth.submitSignin")}
        </button>
      </form>
    </section>
  );
}
