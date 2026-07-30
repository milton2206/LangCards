import Flag from "../components/icons/Flag.jsx";
import Icon from "../components/icons/Icon.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./SessionScreen.css";

// ============================================================================
// Экран занятия (движок заданий): приложение показывает план на сегодня,
// собранный из доступных форматов (см. lib/sessionEngine.js). Пользователь
// проходит блоки по очереди, а кнопка «Хочу другое» открывает ручной выбор.
// Сам движок ничего не генерирует — он лишь порядок и объём; блоки открывают
// существующие экраны (повторение, чтение, карточки, аудирование).
//
// У каждого блока — ЧЕКБОКС статуса: встаёт сам, когда упражнение реально
// пройдено (движок сверяет с данными/событиями), и его же можно поставить/снять
// вручную. Прогресс и «Всё пройдено» считаются от отмеченных блоков.
// Тап по ТЕЛУ блока ведёт в само упражнение; тап по чекбоксу — только отметка.
//
// Оформление Ember (шаг 3/N): блоки показаны как ПУТЬ — слева статус-кружок
// каждого блока, соединённый вертикальной линией. Кружок заполняется (галочка)
// ТОЛЬКО когда блок реально пройден (doneMap из движка) — логика не тронута,
// поменялось лишь представление статуса.
// ============================================================================

// Линейная иконка формата блока (Ember, вместо эмодзи). Порядок/объём — движок.
const BLOCK_ICON = {
  review: "review",
  reading: "reading",
  newWords: "spark",
  listening: "listening",
};

// i18n-ключ короткого имени блока (для кнопки «Продолжить: …» и aria).
const BLOCK_NAME_KEY = {
  review: "review",
  reading: "reading",
  newWords: "newWords",
  listening: "listening",
};

// Часть суток по локальному часу — для дружелюбного подзаголовка «<день> <часть>».
function partOfDayKey(hour) {
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  if (hour < 22) return "evening";
  return "night";
}

export default function SessionScreen({
  plan,
  doneMap = {},
  onToggle,
  onStartBlock,
  onManual,
  onOpenSettings,
  activeLanguage,
  learnLang,
  scheduleActive,
}) {
  const { t } = useI18n();

  const blocks = plan?.blocks || [];
  const doneCount = blocks.filter((b) => doneMap[b.type]).length;
  // Активный блок — первый ещё не отмеченный.
  const activeIndex = blocks.findIndex((b) => !doneMap[b.type]);
  const activeBlock = activeIndex >= 0 ? blocks[activeIndex] : null;

  const extras = plan?.extras || [];

  // Дружелюбный подзаголовок «<день недели> <часть суток>» на языке интерфейса
  // (родной язык активной пары). Чисто отображение — из текущей даты.
  const locale = activeLanguage?.nativeLang || "en";
  const now = new Date();
  let weekday = "";
  try {
    weekday = now.toLocaleDateString(locale, { weekday: "long" });
    weekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
  } catch {
    weekday = "";
  }
  const dayGreeting = weekday
    ? t("session.greeting", {
        day: weekday,
        part: t(`session.partOfDay.${partOfDayKey(now.getHours())}`),
      })
    : "";

  // Конкретная задача блока (а не только заголовок): «Повторение · 14»,
  // «Чтение · 1 текст · ответить на вопросы», «Новые слова · 10»,
  // «Диалог · прослушать и ответить». Акцент дня «новые слова» → случайные.
  function blockTask(block) {
    if (block.type === "review") return t("session.task.review", { n: block.count });
    if (block.type === "newWords")
      return t(block.random ? "session.task.newWordsRandom" : "session.task.newWords", {
        n: block.count,
      });
    if (block.type === "reading") return t("session.task.reading");
    if (block.type === "listening") return t("session.task.listening");
    return "";
  }

  // Верхняя панель — только настройки справа. Ручной выбор языка убран: язык
  // дня определяется расписанием (логика не тронута), а сам язык виден у метки
  // «Сегодня: [язык]» ниже с круглым флагом.
  const topbar = (
    <header className="session__topbar">
      <button
        type="button"
        className="session__icon-btn"
        onClick={onOpenSettings}
        aria-label={t("cards.settingsAria")}
      >
        <Icon name="settings" size={20} />
      </button>
    </header>
  );

  return (
    <section className="session">
      {topbar}

      {/* Заголовок дня: дружелюбный подзаголовок + крупное название (Alegreya). */}
      <div className="session__heading">
        {dayGreeting && <p className="session__daypart">{dayGreeting}</p>}
        <h1 className="session__title">{t("session.title")}</h1>
      </div>

      {/* Метка «Focus today» терракотовым акцентом (ротация ведущего формата). */}
      {plan?.accent && !plan?.restDay && (
        <p className="session__focus">
          <Icon name="spark" size={16} className="session__focus-icon" />
          {t("session.accentNote", {
            block: t(`session.block.${BLOCK_NAME_KEY[plan.accent]}`),
          })}
        </p>
      )}

      {/* Пояснения дня (расписание / день второстепенного языка) — приглушённо.
          У «Сегодня: [язык]» — круглый флаг языка рядом с названием. */}
      {scheduleActive && (
        <p className="session__note session__note--today">
          <span>{t("schedule.todayLabel")}</span>
          <Flag
            lang={learnLang}
            size={18}
            className="session__note-flag"
          />
          <span className="session__note-lang">{t(`lang.${learnLang}`)}</span>
        </p>
      )}
      {plan?.secondary && (
        <p className="session__note">{t("session.secondaryNote")}</p>
      )}

      {/* Выходной по расписанию: только повторения + предложение позаниматься. */}
      {plan?.restDay ? (
        <div className="session__rest">
          <div className="session__rest-emoji" aria-hidden="true">
            🌙
          </div>
          <h2 className="session__rest-title">{t("session.restTitle")}</h2>
          <p className="session__rest-hint">{t("session.restHint")}</p>
        </div>
      ) : null}

      {/* План блоков на сегодня — как путь: статус-кружки + соединяющая линия. */}
      {blocks.length > 0 ? (
        <>
          <ol className="session__blocks">
            {blocks.map((block, i) => {
              const isDone = Boolean(doneMap[block.type]);
              const isActive = i === activeIndex;
              const name = t(`session.block.${BLOCK_NAME_KEY[block.type]}`);
              return (
                <li
                  key={block.type}
                  className={
                    "session__block" +
                    (isDone ? " is-done" : "") +
                    (isActive ? " is-active" : "")
                  }
                >
                  {/* Статус-кружок = чекбокс (авто/ручная отметка — один и тот же).
                      Тап по нему НЕ открывает упражнение, только меняет статус.
                      Заполняется галочкой ТОЛЬКО когда блок реально пройден. */}
                  <button
                    type="button"
                    className={"session__check" + (isDone ? " is-checked" : "")}
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={
                      isDone
                        ? t("session.uncheckAria", { block: name })
                        : t("session.checkAria", { block: name })
                    }
                    onClick={() => onToggle(block.type)}
                  >
                    <span className="session__check-dot" aria-hidden="true">
                      {isDone && <Icon name="check" size={14} strokeWidth={2.4} />}
                    </span>
                  </button>

                  {/* Тело блока: тап ведёт в само упражнение (объём передаётся). */}
                  <button
                    type="button"
                    className="session__block-btn"
                    onClick={() => onStartBlock(block)}
                  >
                    <span className="session__block-icon" aria-hidden="true">
                      <Icon name={BLOCK_ICON[block.type]} size={20} />
                    </span>
                    <span className="session__block-task">{blockTask(block)}</span>
                    {block.accent && (
                      <span className="session__accent-badge">
                        {t("session.accentBadge")}
                      </span>
                    )}
                    <span className="session__block-go" aria-hidden="true">
                      ›
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {/* Главная кнопка: начать/продолжить активный блок, либо итог. */}
          {activeBlock ? (
            <button
              type="button"
              className="session__cta"
              onClick={() => onStartBlock(activeBlock)}
            >
              <span>
                {doneCount === 0
                  ? t("session.start")
                  : t("session.continue", {
                      block: t(`session.block.${BLOCK_NAME_KEY[activeBlock.type]}`),
                    })}
              </span>
              <span className="session__cta-arrow" aria-hidden="true">
                →
              </span>
            </button>
          ) : (
            <div className="session__done">
              <div className="session__done-emoji" aria-hidden="true">
                🎉
              </div>
              <p className="session__done-text">{t("session.allDone")}</p>
            </div>
          )}
        </>
      ) : (
        // Пусто: нечего повторять и форматы недоступны (офлайн/нет слов). Не
        // тупик — предлагаем выбрать занятие вручную.
        !plan?.restDay && (
          <div className="session__empty">
            <div className="session__empty-emoji" aria-hidden="true">
              ✨
            </div>
            <p className="session__empty-text">{t("session.empty")}</p>
          </div>
        )
      )}

      {/* ДОБАВКИ сверху базы: «хотите ещё?». Приоритетному дню их больше. Это
          отдельные предложения продолжить — в прогресс базы не входят. */}
      {extras.length > 0 && !plan?.restDay && (
        <div className="session__extras">
          <p className="session__extras-title">{t("session.extrasTitle")}</p>
          <div className="session__extras-list">
            {extras.map((block, i) => (
              <button
                key={`${block.type}-${i}`}
                type="button"
                className="session__extra"
                onClick={() => onStartBlock(block)}
              >
                <Icon
                  name={BLOCK_ICON[block.type]}
                  size={18}
                  className="session__extra-icon"
                />
                {t("session.extraItem", {
                  block: t(`session.block.${BLOCK_NAME_KEY[block.type]}`),
                })}
              </button>
            ))}
          </div>
          <p className="session__extras-hint">{t("session.extrasHint")}</p>
        </div>
      )}

      {/* Свобода выбора: одним нравится, когда ведут, другие хотят выбрать сами. */}
      <button type="button" className="session__manual" onClick={onManual}>
        {plan?.restDay ? t("session.studyAnyway") : t("session.manual")}
      </button>
    </section>
  );
}
