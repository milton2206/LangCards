import { createContext, useContext, useMemo } from "react";
import {
  translate,
  translatePlural,
  DICTIONARIES,
  DEFAULT_LANG,
} from "./index.js";

const I18nContext = createContext({
  lang: DEFAULT_LANG,
  t: (key) => key,
  tp: (key) => key,
});

/**
 * Провайдер языка интерфейса. lang берётся из родного языка пользователя
 * (nativeLang). Неизвестный/пустой язык → русский по умолчанию.
 */
export function I18nProvider({ lang, children }) {
  const active = DICTIONARIES[lang] ? lang : DEFAULT_LANG;
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
