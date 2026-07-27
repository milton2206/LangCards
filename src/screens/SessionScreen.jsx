import LanguageSwitcher from "../components/LanguageSwitcher.jsx";
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
// ============================================================================

// Иконка по типу блока. Порядок и объём задаёт движок.
const BLOCK_ICON = {
  review: "🔁",
  reading: "📖",
  newWords: "🆕",
  listening: "🎧",
};

// i18n-ключ короткого имени блока (для кнопки «Продолжить: …»).
const BLOCK_NAME_KEY = {
  review: "review",
  reading: "reading",
  newWords: "newWords",
  listening: "listening",
};

// Порядок ползунка нагрузки: авто + три ручных уровня.
const LOAD_OPTIONS = ["auto", "light", "normal", "heavy"];

export default function SessionScreen({
  plan,
  doneMap = {},
  onToggle,
  sessionLoad,
  onChangeLoad,
  onStartBlock,
  onManual,
  onOpenSettings,
  languages,
  multiLangMode,
  activeLanguage,
  onSwitchLanguage,
  learnLang,
  scheduleActive,
}) {
  const { t } = useI18n();

  const blocks = plan?.blocks || [];
  const doneCount = blocks.filter((b) => doneMap[b.type]).length;
  // Активный блок — первый ещё не отмеченный.
  const activeIndex = blocks.findIndex((b) => !doneMap[b.type]);
  const activeBlock = activeIndex >= 0 ? blocks[activeIndex] : null;
  const allDone = blocks.length > 0 && activeIndex === -1;

  // Конкретная задача блока (а не только заголовок): «Повторение · 14»,
  // «Чтение · 1 текст · ответить на вопросы», «Новые слова · 10»,
  // «Диалог · прослушать и ответить».
  function blockTask(block) {
    if (block.type === "review") return t("session.task.review", { n: block.count });
    if (block.type === "newWords")
      return t("session.task.newWords", { n: block.count });
    if (block.type === "reading") return t("session.task.reading");
    if (block.type === "listening") return t("session.task.listening");
    return "";
  }

  const topbar = (
    <header className="session__topbar">
      <h1 className="session__title">{t("session.title")}</h1>
      <div className="session__topbar-actions">
        {multiLangMode && languages?.length > 0 && (
          <LanguageSwitcher
            languages={languages}
            activeLanguage={activeLanguage}
            onSwitch={onSwitchLanguage}
          />
        )}
        <button
          type="button"
          className="session__icon-btn"
          onClick={onOpenSettings}
          aria-label={t("cards.settingsAria")}
        >
          <span aria-hidden="true">⚙️</span>
        </button>
      </div>
    </header>
  );

  // Ползунок нагрузки: «Авто / Легче / Нормально / Тяжелее». При «Авто» подсказка
  // показывает, какой уровень рассчитался сам.
  const loadPicker = (
    <div className="session__load">
      <span className="session__load-label">{t("session.loadLabel")}</span>
      <div className="session__load-chips" role="group">
        {LOAD_OPTIONS.map((id) => (
          <button
            key={id}
            type="button"
            className={
              "session__load-chip" + (sessionLoad === id ? " is-active" : "")
            }
            aria-pressed={sessionLoad === id}
            onClick={() => onChangeLoad(id)}
          >
            {t(`session.load.${id}`)}
          </button>
        ))}
      </div>
      <p className="session__load-hint">
        {sessionLoad === "auto"
          ? t("session.loadAutoHint", { level: t(`session.load.${plan?.level}`) })
          : t("session.loadHint")}
      </p>
    </div>
  );

  return (
    <section className="session">
      {topbar}

      {/* Пояснение дня: расписание / день второстепенного языка. */}
      {scheduleActive && (
        <p className="session__note">
          {t("schedule.today", { lang: t(`lang.${learnLang}`) })}
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

      {/* План блоков на сегодня */}
      {blocks.length > 0 ? (
        <>
          <div className="session__progress">
            <span className="session__progress-text">
              {allDone
                ? t("session.allDoneShort")
                : t("session.progress", { n: doneCount, total: blocks.length })}
            </span>
            <div className="session__progress-bar" aria-hidden="true">
              <span
                className="session__progress-fill"
                style={{ width: `${(doneCount / blocks.length) * 100}%` }}
              />
            </div>
          </div>

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
                  {/* Чекбокс: авто/ручная отметка — один и тот же. Тап по нему
                      НЕ открывает упражнение, только меняет статус. */}
                  <button
                    type="button"
                    className={"session__check" + (isDone ? " is-checked" : "")}
                    role="checkbox"
                    aria-checked={isDone}
                    aria-label={
                      isDone ? t("session.uncheckAria", { block: name }) : t("session.checkAria", { block: name })
                    }
                    onClick={() => onToggle(block.type)}
                  >
                    <span aria-hidden="true">{isDone ? "✓" : ""}</span>
                  </button>

                  {/* Тело блока: тап ведёт в само упражнение (объём передаётся). */}
                  <button
                    type="button"
                    className="session__block-btn"
                    onClick={() => onStartBlock(block)}
                  >
                    <span className="session__block-icon" aria-hidden="true">
                      {BLOCK_ICON[block.type]}
                    </span>
                    <span className="session__block-task">{blockTask(block)}</span>
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
              {doneCount === 0
                ? t("session.start")
                : t("session.continue", {
                    block: t(`session.block.${BLOCK_NAME_KEY[activeBlock.type]}`),
                  })}
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

      {/* Регулируемая нагрузка */}
      {loadPicker}

      {/* Свобода выбора: одним нравится, когда ведут, другие хотят выбрать сами. */}
      <button type="button" className="session__manual" onClick={onManual}>
        {plan?.restDay ? t("session.studyAnyway") : t("session.manual")}
      </button>
    </section>
  );
}
