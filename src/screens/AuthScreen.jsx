import { useState, useEffect } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { authErrorKey } from "../lib/authErrors.js";
import "./AuthScreen.css";

/**
 * Экран входа/регистрации (email + пароль) + запрос сброса пароля. Выбран пароль,
 * а не magic-link: работает предсказуемо для пользователя.
 *
 * Режимы: "signin" | "signup" | "reset" (ввод email для письма сброса). Сам ввод
 * нового пароля — на отдельном экране восстановления (по ссылке из письма).
 */
export default function AuthScreen({
  onSignIn,
  onSignUp,
  onResetPassword,
  onBack,
  resetLinkError,
}) {
  const { t } = useI18n();
  const [mode, setMode] = useState("signin"); // "signin" | "signup" | "reset"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);

  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  // Пришли по истёкшей/недействительной ссылке сброса — показываем понятное
  // сообщение сразу на экране входа.
  useEffect(() => {
    if (resetLinkError) {
      setMode("signin");
      setError(
        t(
          resetLinkError === "expired"
            ? "auth.reset.expired"
            : "auth.reset.invalid",
        ),
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetLinkError]);

  function switchMode(next) {
    setMode(next);
    setError(null);
    setNotice(null);
  }

  // Вход / регистрация.
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
      setError(t(authErrorKey(err?.message)));
    } finally {
      setBusy(false);
    }
  }

  // Запрос письма со ссылкой сброса.
  async function handleResetSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setNotice(null);

    const mail = email.trim();
    if (!mail) {
      setError(t("auth.enterEmail"));
      return;
    }

    setBusy(true);
    try {
      await onResetPassword(mail);
      // Supabase намеренно отвечает успехом и для незарегистрированных адресов
      // (чтобы нельзя было перебором узнать, кто есть в базе). Сообщение —
      // НЕЙТРАЛЬНОЕ, без email и без подтверждения/отрицания наличия аккаунта.
      setMode("signin");
      setNotice(t("auth.reset.sent"));
    } catch (err) {
      setError(t(authErrorKey(err?.message)));
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
          onClick={isReset ? () => switchMode("signin") : onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <h1 className="auth__title">
          {isReset
            ? t("auth.reset.title")
            : isSignup
              ? t("auth.signup")
              : t("auth.signin")}
        </h1>
      </header>

      <p className="auth__note">{isReset ? t("auth.reset.lead") : t("auth.note")}</p>

      {!isReset && (
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
      )}

      {isReset ? (
        <form className="auth__form" onSubmit={handleResetSubmit}>
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

          {error && <p className="auth__error">{error}</p>}
          {notice && <p className="auth__notice">{notice}</p>}

          <button type="submit" className="auth__submit" disabled={busy}>
            {busy ? t("auth.busy") : t("auth.reset.submit")}
          </button>

          <button
            type="button"
            className="auth__link"
            onClick={() => switchMode("signin")}
          >
            {t("auth.reset.backToSignin")}
          </button>
        </form>
      ) : (
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

          {/* Ссылка «Забыли пароль?» — только на входе. */}
          {!isSignup && (
            <button
              type="button"
              className="auth__link"
              onClick={() => switchMode("reset")}
            >
              {t("auth.forgot")}
            </button>
          )}
        </form>
      )}
    </section>
  );
}
