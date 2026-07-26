import { useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { authErrorKey } from "../lib/authErrors.js";
import { passwordError } from "../lib/passwordValidation.js";
import "./AuthScreen.css";

/**
 * Экран ввода нового пароля после перехода по ссылке восстановления (режим
 * recovery в useAuth). Сессия восстановления уже есть — updatePassword меняет
 * пароль текущего пользователя. После успеха onDone уводит в приложение.
 *
 * onSubmit(password) — бросает Error при ошибке; onDone() — выйти из режима
 * восстановления (пользователь уже вошёл с новым паролем).
 */
export default function ResetPasswordScreen({ onSubmit, onDone }) {
  const { t } = useI18n();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError(null);

    const key = passwordError(password, confirm);
    if (key) {
      setError(t(key));
      return;
    }

    setBusy(true);
    try {
      await onSubmit(password);
      setDone(true);
    } catch (err) {
      setError(t(authErrorKey(err?.message)));
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <section className="auth">
        <h1 className="auth__title">{t("auth.reset.newTitle")}</h1>
        <p className="auth__notice">{t("auth.reset.saved")}</p>
        <button
          type="button"
          className="auth__submit"
          onClick={onDone}
        >
          {t("auth.reset.continue")}
        </button>
      </section>
    );
  }

  return (
    <section className="auth">
      <h1 className="auth__title">{t("auth.reset.newTitle")}</h1>
      <p className="auth__note">{t("auth.reset.newLead")}</p>

      <form className="auth__form" onSubmit={handleSubmit}>
        <label className="auth__label">
          {t("auth.reset.newPassword")}
          <input
            type="password"
            className="auth__input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            placeholder={t("auth.pwPlaceholderSignup")}
            required
          />
        </label>

        <label className="auth__label">
          {t("auth.reset.confirm")}
          <input
            type="password"
            className="auth__input"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            required
          />
        </label>

        {error && <p className="auth__error">{error}</p>}

        <button type="submit" className="auth__submit" disabled={busy}>
          {busy ? t("auth.busy") : t("auth.reset.save")}
        </button>
      </form>
    </section>
  );
}
