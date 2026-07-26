// Клиент удаления аккаунта (фаза 7.1). Сама операция необратима и выполняется
// НА СЕРВЕРЕ (/api/account), потому что удаление строки из auth.users требует
// service_role. Здесь — только запрос с токеном сессии: сервер берёт id ТОЛЬКО
// из проверенного токена, а не из тела, поэтому подставить чужой id нельзя.

import { authHeaders, makeApiError } from "./apiClient.js";

/**
 * Просит сервер удалить аккаунт текущего пользователя и все его данные.
 * Возвращает true при успехе или бросает Error с .code ('offline' | 'server' |
 * 'sessionExpired' | …) для сообщения в UI.
 */
export async function deleteAccountRequest() {
  let res;
  try {
    res = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(await authHeaders()) },
      body: JSON.stringify({ action: "delete" }),
    });
  } catch {
    const err = new Error("offline");
    err.code = "offline";
    throw err;
  }
  if (!res.ok) {
    throw await makeApiError(res);
  }
  return true;
}
