import { useState } from "react";
import { ONBOARDING_STEPS, optionLabelKey } from "../data/onboarding.js";
import {
  sanitizeTopic,
  MAX_TOPIC_CHARS,
} from "../../lib/topicSanitize.js";
import { MAX_CUSTOM_TOPICS } from "../lib/userLanguages.js";
import { useI18n } from "../i18n/I18nContext.jsx";
import "./TopicPicker.css";

const PRESET_OPTIONS = ONBOARDING_STEPS.find((s) => s.key === "topic").options;
const PRESET_IDS = new Set(PRESET_OPTIONS.map((o) => o.id));

/**
 * Выбор темы генерации: сверху неизменяемые пресеты (как раньше), ниже блок
 * «Мои темы» — свои темы пары со счётчиком, добавлением и удалением. Свои и
 * пресеты выбираются ОДИНАКОВО (тот же чип, тот же onSelect); разница лишь в
 * том, что свои можно удалить, а пресеты — нет.
 *
 * value — текущая выбранная тема (id пресета ИЛИ строка своей темы).
 * customTopics — свои темы активной пары; canManage — можно ли их
 * добавлять/удалять (нужен вошедший пользователь и сеть). onAddCustom/
 * onRemoveCustom работают со СТРОКОЙ темы. Обрезку и валидацию делаем здесь же,
 * до вызова колбэков (сервер перепроверит ещё раз).
 */
export default function TopicPicker({
  value,
  customTopics = [],
  canManage = false,
  onSelect,
  onAddCustom,
  onRemoveCustom,
}) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  const atLimit = customTopics.length >= MAX_CUSTOM_TOPICS;
  // Что реально уйдёт после обрезки — по нему и решаем, активна ли кнопка.
  const cleaned = sanitizeTopic(draft);
  const duplicate = customTopics.some(
    (tpc) => tpc.toLowerCase() === cleaned.toLowerCase(),
  );
  const canAdd = canManage && !atLimit && cleaned.length > 0 && !duplicate;

  function handleAdd() {
    if (!canAdd) return;
    onAddCustom(cleaned);
    setDraft("");
  }

  const chip = (id, label, active) => (
    <button
      key={id}
      type="button"
      className={"settings__chip" + (active ? " is-active" : "")}
      aria-pressed={active}
      onClick={() => onSelect(id)}
    >
      {label}
    </button>
  );

  return (
    <div className="topicpicker">
      {/* Пресеты — всегда доступны, неудаляемы */}
      <div className="settings__options">
        {PRESET_OPTIONS.map((opt) =>
          chip(
            opt.id,
            <>
              <span aria-hidden="true">{opt.emoji}</span>{" "}
              {t(optionLabelKey("topic", opt.id))}
            </>,
            value === opt.id,
          ),
        )}
      </div>

      {/* Мои темы: счётчик + список своих (выбор + удаление) + добавление */}
      <div className="topicpicker__custom">
        <div className="topicpicker__custom-head">
          <span className="topicpicker__custom-title">
            {t("topics.myTopics")}
          </span>
          <span className="topicpicker__counter">
            {customTopics.length}/{MAX_CUSTOM_TOPICS}
          </span>
        </div>

        {customTopics.length > 0 && (
          <div className="topicpicker__list">
            {customTopics.map((tpc) => {
              const active = value === tpc && !PRESET_IDS.has(value);
              return (
                <div key={tpc} className="topicpicker__item">
                  <button
                    type="button"
                    className={
                      "settings__chip topicpicker__chip" +
                      (active ? " is-active" : "")
                    }
                    aria-pressed={active}
                    onClick={() => onSelect(tpc)}
                  >
                    {tpc}
                  </button>
                  {canManage && (
                    <button
                      type="button"
                      className="topicpicker__remove"
                      aria-label={t("topics.remove", { topic: tpc })}
                      onClick={() => onRemoveCustom(tpc)}
                    >
                      ✕
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {canManage ? (
          <>
            <div className="topicpicker__add">
              <input
                type="text"
                className="topicpicker__input"
                value={draft}
                maxLength={MAX_TOPIC_CHARS}
                placeholder={t("topics.placeholder")}
                aria-label={t("topics.addAria")}
                disabled={atLimit}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAdd();
                  }
                }}
              />
              <button
                type="button"
                className="topicpicker__add-btn"
                disabled={!canAdd}
                onClick={handleAdd}
              >
                {t("topics.add")}
              </button>
            </div>
            {/* Понятная причина, почему добавить нельзя */}
            {atLimit ? (
              <p className="topicpicker__hint">
                {t("topics.limitReached", { max: MAX_CUSTOM_TOPICS })}
              </p>
            ) : duplicate && cleaned.length > 0 ? (
              <p className="topicpicker__hint">{t("topics.duplicate")}</p>
            ) : (
              <p className="topicpicker__hint">
                {t("topics.hint", { max: MAX_CUSTOM_TOPICS })}
              </p>
            )}
          </>
        ) : (
          // Свои темы требуют аккаунта и сети — честно говорим об этом.
          <p className="topicpicker__hint">{t("topics.needAccount")}</p>
        )}
      </div>
    </div>
  );
}
