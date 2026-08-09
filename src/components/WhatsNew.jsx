import { useEffect, useMemo, useState } from "react";
import { useI18n } from "../i18n/I18nContext.jsx";
import { CHANGELOG } from "../data/changelog.js";
import Icon from "./icons/Icon.jsx";
import "./Modal.css";
import "./WhatsNew.css";

/**
 * Окно «Что нового» при заходе. Два режима (см. resolveWhatsNew):
 *   greeting — короткое приветствие новичку (без списка изменений);
 *   list     — ВСЯ история обновлений, сгруппированная по датам (сессиям).
 * Показывается один раз за заход, закрывается, переходам по экранам не мешает.
 *
 * В режиме list показываем ПОСЛЕДНИЕ записи, сгруппированные по датам (сессиям);
 * остальная история — под кнопкой «Показать всю историю», ничего не удаляется.
 * Каждая сессия — сворачиваемый блок (аккордеон), ИЗНАЧАЛЬНО все свёрнуты: виден
 * компактный список дат, тап раскрывает содержимое. Что и когда ПОКАЗЫВАТЬ решает
 * resolveWhatsNew (greeting/list/ничего) — эту логику не трогаем.
 */

// Сколько ЗАПИСЕЙ (а не сессий) видно сразу. Считаем именно записи: иначе
// «десять последних дней» могло бы означать и три пункта, и полсотни. Если
// десятая запись попала в середину дня, день показывается до неё, а хвост
// уезжает под кнопку — так граница не зависит от того, сколько всего было
// сделано в тот день.
const VISIBLE_ENTRIES = 10;

// Записи одного дня — в одну сессию. Порядок внутри и между сессиями: свежие
// сверху (устойчиво к случайному непорядку в самом массиве).
function groupByDay(entries) {
  const byDay = new Map();
  for (const entry of entries) {
    const day = String(entry.date).slice(0, 10); // YYYY-MM-DD
    if (!byDay.has(day)) byDay.set(day, { day, date: entry.date, items: [] });
    byDay.get(day).items.push(entry);
  }
  const list = [...byDay.values()];
  for (const s of list) {
    s.items.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
  list.sort((a, b) => new Date(b.date) - new Date(a.date));
  return list;
}

export default function WhatsNew({ mode, onClose }) {
  const { t, lang } = useI18n();
  const isGreeting = mode === "greeting";

  // Изначально все сессии свёрнуты — храним набор раскрытых ключей-дней.
  const [expanded, setExpanded] = useState(() => new Set());
  // Вся история раскрыта (по кнопке под списком).
  const [showAll, setShowAll] = useState(false);

  // Плоский список от новых к старым — по нему и режем ровно по записям.
  const ordered = useMemo(
    () => [...CHANGELOG].sort((a, b) => new Date(b.date) - new Date(a.date)),
    [],
  );
  const hiddenCount = Math.max(0, ordered.length - VISIBLE_ENTRIES);
  const sessions = useMemo(
    () => groupByDay(showAll ? ordered : ordered.slice(0, VISIBLE_ENTRIES)),
    [ordered, showAll],
  );

  // Закрытие по Escape + блокировка прокрутки фона (как в остальных окнах).
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  function toggle(day) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  }

  // Форматируем дату сессии в UTC — так подпись совпадает с ключом группировки
  // (день по UTC, см. sessions). Иначе вечерние по UTC записи в часовых поясах
  // впереди «переезжали» бы на следующий день и раздваивали сессию в подписи.
  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString(lang, {
        day: "numeric",
        month: "long",
        timeZone: "UTC",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div
      className="modal"
      role="dialog"
      aria-modal="true"
      aria-labelledby="whatsnew-title"
      onClick={onClose}
    >
      <div
        className="modal__box modal__box--ember"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__header">
          <span className="modal__title-group">
            <span className="modal__title-icon" aria-hidden="true">
              <Icon name="spark" size={20} />
            </span>
            <h2 id="whatsnew-title" className="modal__title">
              {isGreeting ? t("whatsnew.greetingTitle") : t("whatsnew.title")}
            </h2>
          </span>
          <button
            type="button"
            className="modal__close"
            onClick={onClose}
            aria-label={t("common.close")}
          >
            ×
          </button>
        </header>

        {isGreeting ? (
          <p className="modal__text">{t("whatsnew.greeting")}</p>
        ) : (
          <div className="whatsnew__sessions">
            {sessions.map((s) => {
              const open = expanded.has(s.day);
              const bodyId = `whatsnew-session-${s.day}`;
              return (
                <div className="whatsnew__session" key={s.day}>
                  {/* Заголовок сессии — тап сворачивает/разворачивает. */}
                  <button
                    type="button"
                    className={
                      "whatsnew__session-head" + (open ? " is-open" : "")
                    }
                    aria-expanded={open}
                    aria-controls={bodyId}
                    onClick={() => toggle(s.day)}
                  >
                    <span className="whatsnew__session-date">
                      {formatDate(s.date)}
                    </span>
                    <span className="whatsnew__session-count">
                      {s.items.length}
                    </span>
                    <Icon
                      name="chevron"
                      size={18}
                      className="whatsnew__session-chevron"
                    />
                  </button>

                  {open && (
                    <div id={bodyId} className="whatsnew__session-body">
                      {s.items.map((e) => (
                        <div className="whatsnew__item" key={e.id}>
                          <span className="whatsnew__item-title">
                            <Icon
                              name="spark"
                              size={15}
                              className="whatsnew__item-icon"
                            />
                            {t(`whatsnew.entries.${e.id}.title`)}
                          </span>
                          <p className="whatsnew__desc">
                            {t(`whatsnew.entries.${e.id}.desc`)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Остальная история — по кнопке. Ничего не удаляем, просто не
                вываливаем всё сразу. */}
            {!showAll && hiddenCount > 0 && (
              <button
                type="button"
                className="whatsnew__more"
                onClick={() => setShowAll(true)}
              >
                {t("whatsnew.showAll")}
              </button>
            )}
          </div>
        )}

        <div className="modal__actions">
          <button
            type="button"
            className="modal__btn modal__btn--primary"
            onClick={onClose}
          >
            {isGreeting ? t("whatsnew.start") : t("common.gotIt")}
          </button>
        </div>
      </div>
    </div>
  );
}
