import { useState } from "react";
import {
  ONBOARDING_STEPS,
  optionLabelKey,
  stepTitleKey,
  stepHintKey,
} from "../data/onboarding.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./OnboardingScreen.css";

/**
 * Пошаговый мастер стартовых настроек.
 * На каждом шаге — один выбор из крупных кнопок. Выбор на промежуточных
 * шагах автоматически переводит на следующий; на последнем — появляется
 * кнопка «Начать».
 *
 * Шаг уровня (фаза 6.3) начинается с равноправной развилки: пройти тест или
 * выбрать уровень самому. Тест НЕ обязателен — «выбрать самому» это один тап,
 * и дальше шаг работает ровно как раньше. initialStep нужен возврату из теста:
 * мастер открывается на шаге уровня с уже сделанными ответами.
 */
export default function OnboardingScreen({
  initial,
  initialStep = 0,
  onComplete,
  onStartPlacement,
  onBack,
}) {
  const { t } = useI18n();
  const [step, setStep] = useState(initialStep);
  const [draft, setDraft] = useState(() => ({ ...initial }));
  // Развилка шага уровня: null — показываем выбор, "manual" — обычные варианты.
  const [levelMode, setLevelMode] = useState(null);

  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  const selected = draft[current.key];
  const allChosen = ONBOARDING_STEPS.every((s) => draft[s.key]);

  const title = t(stepTitleKey(current.key));
  const hintKey = stepHintKey(current.key);
  const hint = t(hintKey);
  const hasHint = hint !== hintKey; // не у всех шагов есть подсказка

  // Развилку показываем только на шаге уровня, только пока уровень не выбран
  // и только если тест вообще доступен (запуск приходит сверху).
  const showLevelChoice =
    current.key === "level" &&
    Boolean(onStartPlacement) &&
    levelMode !== "manual" &&
    !selected;

  function choose(optionId) {
    setDraft((prev) => ({ ...prev, [current.key]: optionId }));
    if (!isLast) {
      setStep((s) => s + 1);
    }
  }

  function goBack() {
    if (step === 0) {
      onBack();
    } else {
      setStep((s) => s - 1);
    }
  }

  return (
    <section className="onb" aria-labelledby="onb-title">
      <header className="onb__header">
        <button
          type="button"
          className="onb__back"
          onClick={goBack}
          aria-label={t("common.back")}
        >
          ←
        </button>
        <div className="onb__progress" aria-hidden="true">
          {ONBOARDING_STEPS.map((s, i) => (
            <span
              key={s.key}
              className={"onb__dot" + (i <= step ? " is-active" : "")}
            />
          ))}
        </div>
        <span className="onb__counter">
          {step + 1}/{ONBOARDING_STEPS.length}
        </span>
      </header>

      <div className="onb__body">
        <h1 id="onb-title" className="onb__title">
          {title}
        </h1>
        {hasHint && <p className="onb__hint">{hint}</p>}

        {/* Две равноправные кнопки: измерить уровень или выбрать его самому.
            Ни одна не «главная» — тест это предложение, а не условие входа. */}
        {showLevelChoice && (
          <div className="onb__choice">
            <button
              type="button"
              className="onb__choice-btn"
              onClick={() => onStartPlacement(draft)}
            >
              <span className="onb__choice-emoji" aria-hidden="true">
                🎯
              </span>
              <span className="onb__choice-label">
                {t("placement.entryOnboarding")}
              </span>
              <span className="onb__choice-hint">
                {t("placement.entryOnboardingHint")}
              </span>
            </button>
            <button
              type="button"
              className="onb__choice-btn"
              onClick={() => setLevelMode("manual")}
            >
              <span className="onb__choice-emoji" aria-hidden="true">
                ✍️
              </span>
              <span className="onb__choice-label">
                {t("placement.chooseSelf")}
              </span>
              <span className="onb__choice-hint">
                {t("placement.chooseSelfHint")}
              </span>
            </button>
          </div>
        )}

        {/* Пока показана развилка, список уровней не мешается: выбор из него —
            это и есть ветка «выбрать самому». */}
        {!showLevelChoice && (
        <div className="onb__options" role="radiogroup" aria-label={title}>
          {current.options.map((opt) => {
            const active = selected === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                role="radio"
                aria-checked={active}
                className={"onb__option" + (active ? " is-selected" : "")}
                onClick={() => choose(opt.id)}
              >
                <span className="onb__option-emoji" aria-hidden="true">
                  {opt.emoji}
                </span>
                <span className="onb__option-label">
                  {t(optionLabelKey(current.key, opt.id))}
                </span>
                <span className="onb__option-check" aria-hidden="true">
                  {active ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
        )}
      </div>

      {isLast && !showLevelChoice && (
        <div className="onb__footer">
          <button
            type="button"
            className="onb__start"
            disabled={!allChosen}
            onClick={() => onComplete(draft)}
          >
            {t("onb.start")}
          </button>
        </div>
      )}
    </section>
  );
}
