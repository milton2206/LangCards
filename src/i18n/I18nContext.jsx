import { createContext, useContext, useMemo } from "react";
import {
  translate,
  translatePlural,
  resolveUiLang,
  UI_FALLBACK_LANG,
} from "./index.js";

const I18nContext = createContext({
  lang: UI_FALLBACK_LANG,
  t: (key) => key,
  tp: (key) => key,
});

/**
 * Провайдер языка интерфейса. lang берётся из родного языка пользователя
 * (nativeLang). Пока он не выбран (первый вход, онбординг) или не поддерживается
 * — английский: интерфейса на языке устройства у нас нет.
 */
export function I18nProvider({ lang, children }) {
  const active = resolveUiLang(lang);
  const value = useMemo(
    () => ({
      lang: active,
      t: (key, params) => translate(active, key, params),
      tp: (keyBase, n, params) => translatePlural(active, keyBase, n, params),
    }),
    [active],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// t(key, params) — перевод; tp(keyBase, n, params) — перевод с мн. числом.
// Провайдер и хук живут вместе (обычный паттерн контекста).
// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  return useContext(I18nContext);
}
