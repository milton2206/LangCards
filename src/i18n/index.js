import ru from "./translations/ru.js";
import uk from "./translations/uk.js";
import en from "./translations/en.js";
import { pluralForm } from "./plural.js";

// Словари по коду родного языка пользователя (nativeLang: ru | uk | en).
export const DICTIONARIES = { ru, uk, en };

// Язык, на который падаем, когда в словаре НЕТ ключа. Русский — базовый
// (самый полный) словарь, поэтому недостающие строки uk/en берём из него.
export const DEFAULT_LANG = "ru";

// Язык ИНТЕРФЕЙСА, когда родной язык пользователя ещё не выбран или не входит в
// поддерживаемые (ru/uk/en). Это РАЗНЫЕ вещи: тут нужен нейтральный английский,
// а не русский и тем более не язык устройства — интерфейса на греческом или
// немецком у нас нет, и такой текст был бы сломанным.
export const UI_FALLBACK_LANG = "en";

/** Код языка интерфейса: поддерживаемый как есть, иначе английский. */
export function resolveUiLang(lang) {
  return DICTIONARIES[lang] ? lang : UI_FALLBACK_LANG;
}

// Достаёт значение по пути "a.b.c" из вложенного объекта.
function getPath(obj, path) {
  return path
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

// Подставляет параметры вида {name} в строку.
function interpolate(str, params) {
  if (!params) return str;
  return str.replace(/\{(\w+)\}/g, (m, key) =>
    params[key] != null ? String(params[key]) : m,
  );
}

/**
 * Перевод строки по ключу. Если в выбранном языке ключа нет — падаем на русский
 * (переводы uk/en добавляются отдельным шагом). Если нет и там — возвращаем сам
 * ключ (заметно в разработке, ничего не ломает в проде).
 * Поддерживает интерполяцию {param} и листья-массивы (например списки шагов).
 */
export function translate(lang, key, params) {
  const dict = DICTIONARIES[lang] || DICTIONARIES[DEFAULT_LANG];
  let value = getPath(dict, key);
  if (value === undefined && lang !== DEFAULT_LANG) {
    value = getPath(DICTIONARIES[DEFAULT_LANG], key);
  }
  if (value === undefined) return key;
  if (Array.isArray(value)) return value.map((s) => interpolate(s, params));
  if (typeof value !== "string") return value;
  return interpolate(value, params);
}

// Перевод с учётом множественного числа: keyBase.{one|few|many} + {n}.
export function translatePlural(lang, keyBase, n, extraParams) {
  const form = pluralForm(lang, n);
  return translate(lang, `${keyBase}.${form}`, { n, ...extraParams });
}
