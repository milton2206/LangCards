import { useState } from "react";
import {
  ONBOARDING_STEPS,
  LANG_EMOJI,
  optionLabelKey,
} from "../data/onboarding.js";
import WeekSchedule from "../components/WeekSchedule.jsx";
import { useI18n } from "../i18n/I18nContext.jsx";
// Переиспользуем стиль чипов настроек (settings__chip и т.д.) — без дублей.
import "./SettingsScreen.css";
import "./LanguagesScreen.css";

// Пресеты дневного лимита новых слов (значение хранится в user_languages).
const LIMIT_PRESETS = [5, 10, 15, 20];

// Варианты «сколько дней в неделю занимаюсь» (profiles.study_days_per_week).
const DAYS_OPTIONS = [3, 4, 5, 6, 7];

/**
 * Выбор языковой пары: те же опции, что в онбординге (ONBOARDING_STEPS), тот же
 * стиль чипов, что в настройках. Используется и для смены единственной пары
 * (одноязычный режим), и для добавления пары (мультирежим).
 */
function PairPicker({ initialLearn, initialNative, submitLabel, onSubmit, onCancel }) {
  const { t } = useI18n();
  const [learn, setLearn] = useState(initialLearn || null);
  const [native, setNative] = useState(initialNative || null);
  const learnOptions = ONBOARDING_STEPS.find((s) => s.key === "learnLang").options;
  const nativeOptions = ONBOARDING_STEPS.find((s) => s.key === "nativeLang").options;
  // Пара «язык сам на себя» смысла не имеет — кнопка недоступна.
  const valid = Boolean(learn && native && learn !== native);

  const chips = (options, value, setValue, stepKey) =>
    options.map((opt) => (
      <button
        key={opt.id}
        type="button"
        className={"settings__chip" + (value === opt.id ? " is-active" : "")}
        aria-pressed={value === opt.id}
        onClick={() => setValue(opt.id)}
      >
        <span aria-hidden="true">{opt.emoji}</span>{" "}
        {t(optionLabelKey(stepKey, opt.id))}
      </button>
    ));

  return (
    <div className="langs__picker">
      <h3 className="langs__picker-title">{t("onb.learnLang.title")}</h3>
      <div className="settings__options">
        {chips(learnOptions, learn, setLearn, "learnLang")}
      </div>
      <h3 className="langs__picker-title">{t("onb.nativeLang.title")}</h3>
      <div className="settings__options">
        {chips(nativeOptions, native, setNative, "nativeLang")}
      </div>
      <div className="langs__picker-actions">
        <button
          type="button"
          className="langs__primary"
          disabled={!valid}
          onClick={() => onSubmit({ learnLang: learn, nativeLang: native })}
        >
          {submitLabel}
        </button>
        <button type="button" className="langs__ghost" onClick={onCancel}>
          {t("selectbar.cancel")}
        </button>
      </div>
    </div>
  );
}

/**
 * Экран «Мои языки» (фаза 4.4) — единственная точка включения мультирежима.
 *
 * Выключен: показана одна активная пара + «Сменить пару». Ни списка, ни
 * приоритетов, ни лимитов — интерфейс как в одноязычном приложении.
 * Включён: список активных пар — добавить, назначить приоритет (ровно один,
 * снятие с прочих делает триггер в БД), задать daily_new_limit (сразу
 * пересчитывает разбивку дня), удалить (is_active=false, прогресс сохраняется).
 * Последнюю активную пару удалить нельзя.
 */
export default function LanguagesScreen({
  multiLangMode,
  languages,
  priorityLanguage,
  activeLanguage,
  studyDaysPerWeek,
  scheduleMode,
  weeklySchedule,
  onEnableMultiLang,
  onToggleMultiLang,
  onUpdateSchedule,
  onReplaceSinglePair,
  onAddPair,
  onSetPriority,
  onSetLimit,
  onRemove,
  onBack,
}) {
  const { t } = useI18n();
  const [confirmOff, setConfirmOff] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [confirmRemoveKey, setConfirmRemoveKey] = useState(null);
  // Подсказка после включения режима с одной парой: не заставляем добавлять
  // вторую, просто предлагаем.
  const [justEnabled, setJustEnabled] = useState(false);
  // Вопрос перед включением мультирежима (фаза 4.5): дни в неделю + режим.
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupDays, setSetupDays] = useState(studyDaysPerWeek || 7);
  const [setupMode, setSetupMode] = useState(scheduleMode || "by_day");

  const keyOf = (l) => `${l.learnLang}-${l.nativeLang}`;
  const staying = priorityLanguage || languages[0] || activeLanguage;

  async function handleToggle() {
    if (multiLangMode) {
      // Выключение — через подтверждение с указанием остающегося языка.
      setConfirmOff(true);
      return;
    }
    // Включение — сначала вопрос про дни недели и режим распределения.
    setSetupDays(studyDaysPerWeek || 7);
    setSetupMode(scheduleMode || "by_day");
    setSetupOpen(true);
  }

  async function handleSetupConfirm() {
    setSetupOpen(false);
    await onEnableMultiLang({
      studyDaysPerWeek: setupDays,
      scheduleMode: setupMode,
    });
    if (languages.length <= 1) setJustEnabled(true);
  }

  // Чипы «дни в неделю» и «режим» — общие для вопроса при включении и для
  // редактирования расписания в мультирежиме.
  const daysChips = (value, onPick) => (
    <div className="langs__limit-chips">
      {DAYS_OPTIONS.map((n) => (
        <button
          key={n}
          type="button"
          className={"langs__limit-chip" + (value === n ? " is-active" : "")}
          aria-pressed={value === n}
          onClick={() => onPick(n)}
        >
          {n}
        </button>
      ))}
    </div>
  );

  const modeChips = (value, onPick) => (
    <div className="settings__options">
      <button
        type="button"
        className={"settings__chip" + (value === "by_day" ? " is-active" : "")}
        aria-pressed={value === "by_day"}
        onClick={() => onPick("by_day")}
      >
        📅 {t("schedule.modeByDay")}
      </button>
      <button
        type="button"
        className={"settings__chip" + (value === "mixed" ? " is-active" : "")}
        aria-pressed={value === "mixed"}
        onClick={() => onPick("mixed")}
      >
        🔀 {t("schedule.modeMixed")}
      </button>
    </div>
  );

  async function handleConfirmOff() {
    setConfirmOff(false);
    setJustEnabled(false);
    await onToggleMultiLang(false);
  }

  const pairName = (l) => (
    <>
      <span aria-hidden="true">{LANG_EMOJI[l.learnLang] || "🌐"}</span>{" "}
      {t(`lang.${l.learnLang}`)} → {t(`lang.${l.nativeLang}`)}
    </>
  );

  return (
    <section className="langs">
      <header className="langs__header">
        <button
          type="button"
          className="langs__back"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <h1 className="langs__title">{t("languages.title")}</h1>
      </header>

      {/* Тумблер мультирежима — единственная точка его включения в приложении */}
      <div className="langs__group">
        <h2 className="langs__group-title">{t("languages.multiToggle")}</h2>
        {!multiLangMode && (
          <p className="langs__hint">{t("settings.multiLangHint")}</p>
        )}
        <button
          type="button"
          className={
            "settings__chip settings__chip--wide" +
            (multiLangMode ? " is-active" : "")
          }
          aria-pressed={multiLangMode}
          onClick={handleToggle}
        >
          {multiLangMode
            ? t("settings.multiLangOn")
            : t("settings.multiLangOff")}
        </button>

        {/* Вопрос перед включением: сколько дней в неделю и какой режим */}
        {setupOpen && (
          <div className="langs__confirm langs__confirm--setup">
            <p className="langs__confirm-title">{t("schedule.setupTitle")}</p>
            {daysChips(setupDays, setSetupDays)}
            <p className="langs__confirm-title">{t("schedule.setupMode")}</p>
            {modeChips(setupMode, setSetupMode)}
            <p className="langs__hint">
              {setupMode === "by_day"
                ? t("schedule.modeByDayHint")
                : t("schedule.modeMixedHint")}
            </p>
            <div className="langs__confirm-actions">
              <button
                type="button"
                className="langs__primary"
                onClick={handleSetupConfirm}
              >
                {t("schedule.enable")}
              </button>
              <button
                type="button"
                className="langs__ghost"
                onClick={() => setSetupOpen(false)}
              >
                {t("selectbar.cancel")}
              </button>
            </div>
          </div>
        )}

        {/* Подтверждение выключения: показываем, какой язык останется */}
        {confirmOff && (
          <div className="langs__confirm" role="alertdialog">
            <p className="langs__confirm-title">
              {t("languages.offConfirmTitle")}
            </p>
            <p className="langs__confirm-text">
              {t("languages.offConfirmText", {
                lang: staying ? t(`lang.${staying.learnLang}`) : "—",
              })}
            </p>
            <div className="langs__confirm-actions">
              <button
                type="button"
                className="langs__primary"
                onClick={handleConfirmOff}
              >
                {t("languages.offConfirm")}
              </button>
              <button
                type="button"
                className="langs__ghost"
                onClick={() => setConfirmOff(false)}
              >
                {t("selectbar.cancel")}
              </button>
            </div>
          </div>
        )}

        {multiLangMode && justEnabled && languages.length <= 1 && (
          <p className="langs__hint langs__hint--ok">
            {t("languages.addFirstHint")}
          </p>
        )}
      </div>

      {!multiLangMode ? (
        /* ---------- Одноязычный режим: одна активная пара ---------- */
        <div className="langs__group">
          <h2 className="langs__group-title">{t("languages.activePair")}</h2>
          {activeLanguage && (
            <p className="langs__item-name">{pairName(activeLanguage)}</p>
          )}
          {showPicker ? (
            <PairPicker
              initialLearn={activeLanguage?.learnLang}
              initialNative={activeLanguage?.nativeLang}
              submitLabel={t("languages.submitChange")}
              onSubmit={(pair) => {
                setShowPicker(false);
                onReplaceSinglePair(pair);
              }}
              onCancel={() => setShowPicker(false)}
            />
          ) : (
            <button
              type="button"
              className="langs__ghost langs__ghost--wide"
              onClick={() => setShowPicker(true)}
            >
              {t("languages.changePair")}
            </button>
          )}
        </div>
      ) : (
        /* ---------- Мультирежим: расписание + список активных пар ---------- */
        <>
        {/* Расписание можно поменять в любой момент: дни, режим, обзор недели */}
        <div className="langs__group">
          <h2 className="langs__group-title">{t("schedule.title")}</h2>
          <div className="langs__limit">
            <span className="langs__limit-label">
              {t("schedule.daysLabel")}
            </span>
            {daysChips(studyDaysPerWeek, (n) =>
              onUpdateSchedule({ studyDaysPerWeek: n }),
            )}
          </div>
          {modeChips(scheduleMode, (m) =>
            onUpdateSchedule({ scheduleMode: m }),
          )}
          {scheduleMode === "by_day" && (
            <WeekSchedule schedule={weeklySchedule} />
          )}
        </div>

        <div className="langs__group">
          <h2 className="langs__group-title">{t("languages.listTitle")}</h2>

          {languages.map((l) => {
            const key = keyOf(l);
            return (
              <div className="langs__item" key={key}>
                <div className="langs__item-head">
                  <span className="langs__item-name">{pairName(l)}</span>
                  {l.isPriority ? (
                    <span className="langs__badge">
                      ★ {t("languages.priorityBadge")}
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="langs__mini"
                      onClick={() => onSetPriority(l)}
                    >
                      {t("languages.makePriority")}
                    </button>
                  )}
                </div>

                {/* Дневной лимит: правка сразу пересчитывает разбивку (4.3) */}
                <div className="langs__limit">
                  <span className="langs__limit-label">
                    {t("languages.limitLabel")}
                  </span>
                  <div className="langs__limit-chips">
                    {LIMIT_PRESETS.map((n) => (
                      <button
                        key={n}
                        type="button"
                        className={
                          "langs__limit-chip" +
                          (l.dailyNewLimit === n ? " is-active" : "")
                        }
                        aria-pressed={l.dailyNewLimit === n}
                        onClick={() => onSetLimit(l, n)}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>

                {confirmRemoveKey === key ? (
                  <div className="langs__confirm">
                    <p className="langs__confirm-text">
                      {t("languages.removeConfirmText")}
                    </p>
                    <div className="langs__confirm-actions">
                      <button
                        type="button"
                        className="langs__primary langs__primary--danger"
                        onClick={() => {
                          setConfirmRemoveKey(null);
                          onRemove(l);
                        }}
                      >
                        {t("selectbar.confirmOk")}
                      </button>
                      <button
                        type="button"
                        className="langs__ghost"
                        onClick={() => setConfirmRemoveKey(null)}
                      >
                        {t("selectbar.cancel")}
                      </button>
                    </div>
                  </div>
                ) : languages.length > 1 ? (
                  <button
                    type="button"
                    className="langs__mini langs__mini--danger"
                    onClick={() => setConfirmRemoveKey(key)}
                  >
                    {t("languages.remove")}
                  </button>
                ) : (
                  /* Последняя активная пара — деактивация заблокирована */
                  <p className="langs__note">{t("languages.lastPairNote")}</p>
                )}
              </div>
            );
          })}

          {showPicker ? (
            <PairPicker
              initialLearn={null}
              initialNative={activeLanguage?.nativeLang}
              submitLabel={t("languages.submitAdd")}
              onSubmit={(pair) => {
                setShowPicker(false);
                setJustEnabled(false);
                onAddPair(pair);
              }}
              onCancel={() => setShowPicker(false)}
            />
          ) : (
            <button
              type="button"
              className="langs__ghost langs__ghost--wide"
              onClick={() => setShowPicker(true)}
            >
              ➕ {t("languages.addPair")}
            </button>
          )}
        </div>
        </>
      )}
    </section>
  );
}
