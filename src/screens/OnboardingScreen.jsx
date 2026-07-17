import { useState } from "react";
import { ONBOARDING_STEPS } from "../data/onboarding.js";
import "./OnboardingScreen.css";

/**
 * Пошаговый мастер стартовых настроек.
 * На каждом шаге — один выбор из крупных кнопок. Выбор на промежуточных
 * шагах автоматически переводит на следующий; на последнем — появляется
 * кнопка «Начать».
 */
export default function OnboardingScreen({ initial, onComplete, onBack }) {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState(() => ({ ...initial }));

  const current = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;
  const selected = draft[current.key];
  const allChosen = ONBOARDING_STEPS.every((s) => draft[s.key]);

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
          aria-label="Назад"
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
          {current.title}
        </h1>
        {current.hint && <p className="onb__hint">{current.hint}</p>}

        <div
          className="onb__options"
          role="radiogroup"
          aria-label={current.title}
        >
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
                <span className="onb__option-label">{opt.label}</span>
                <span className="onb__option-check" aria-hidden="true">
                  {active ? "✓" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {isLast && (
        <div className="onb__footer">
          <button
            type="button"
            className="onb__start"
            disabled={!allChosen}
            onClick={() => onComplete(draft)}
          >
            Начать
          </button>
        </div>
      )}
    </section>
  );
}
