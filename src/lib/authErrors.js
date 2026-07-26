// Сообщения Supabase Auth приходят на английском — сопоставляем их с ключом i18n.
// Общий маппер для входа/регистрации, восстановления и смены пароля.

export function authErrorKey(message) {
  const m = (message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "auth.err.invalidCreds";
  if (m.includes("email not confirmed")) return "auth.err.notConfirmed";
  if (
    m.includes("user already registered") ||
    m.includes("already been registered")
  )
    return "auth.err.alreadyRegistered";
  if (m.includes("password should be at least")) return "auth.pwShort";
  // Смена пароля на такой же — Supabase запрещает, отдельное понятное сообщение.
  if (m.includes("new password should be different")) return "auth.err.samePassword";
  if (m.includes("email") && m.includes("invalid")) return "auth.err.invalidEmail";
  if (m.includes("rate limit") || m.includes("too many")) return "auth.err.rateLimit";
  // Нет/истёкшая сессия (например, протухшая ссылка сброса).
  if (m.includes("auth session missing") || (m.includes("session") && m.includes("expired")))
    return "auth.err.sessionExpired";
  if (m.includes("failed to fetch") || m.includes("network")) return "auth.err.network";
  return "auth.err.generic";
}
