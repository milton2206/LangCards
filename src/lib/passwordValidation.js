// Общая проверка пары «новый пароль + подтверждение» для смены пароля и для
// экрана восстановления. Возвращает КЛЮЧ i18n ошибки или null, если всё ок.
// Правила Supabase (минимум символов) финально проверяет сам сервер — тут только
// быстрая клиентская проверка ради понятного сообщения.

export const MIN_PASSWORD_LEN = 6;

export function passwordError(pw, confirm) {
  if (!pw || !confirm) return "auth.reset.enterBoth";
  if (pw.length < MIN_PASSWORD_LEN) return "auth.pwShort";
  if (pw !== confirm) return "auth.reset.mismatch";
  return null;
}
