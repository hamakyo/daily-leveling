import { useId } from "react";
import type { CreateHabitInput } from "../types";
import { buildIntervalSchedulePreview, intervalPresetOptions, weekdayOptions } from "../utils/habitForm";

export function HabitScheduleFields({
  form,
  disabled,
  validationMessage,
  onChange,
  onValidationMessageClear,
}: {
  form: CreateHabitInput;
  disabled?: boolean;
  validationMessage?: string | null;
  onChange: (form: CreateHabitInput) => void;
  onValidationMessageClear?: () => void;
}) {
  const intervalInputId = useId();
  const intervalHintId = useId();
  const requiresWeekdays = form.frequencyType === "weekly_days";
  const requiresIntervalDays = form.frequencyType === "every_n_days";
  const intervalPreview = requiresIntervalDays ? buildIntervalSchedulePreview(form.intervalDays) : null;

  function clearValidationMessage() {
    onValidationMessageClear?.();
  }

  function toggleWeekday(weekday: number) {
    const isSelected = form.targetWeekdays.includes(weekday);
    const nextWeekdays = isSelected
      ? form.targetWeekdays.filter((value) => value !== weekday)
      : [...form.targetWeekdays, weekday].sort((left, right) => left - right);

    onChange({ ...form, targetWeekdays: nextWeekdays });
    if (nextWeekdays.length > 0) {
      clearValidationMessage();
    }
  }

  return (
    <>
      <label>
        <span>繰り返し方</span>
        <select
          disabled={disabled}
          value={form.frequencyType}
          onChange={(event) => {
            const frequencyType = event.target.value as CreateHabitInput["frequencyType"];
            clearValidationMessage();
            onChange({
              ...form,
              frequencyType,
              targetWeekdays: frequencyType === "weekly_days" ? form.targetWeekdays : [],
            });
          }}
        >
          <option value="daily">毎日</option>
          <option value="weekly_days">曜日を選ぶ</option>
          <option value="every_n_days">日数間隔で繰り返す</option>
        </select>
      </label>
      {requiresWeekdays ? (
        <fieldset className="weekday-picker">
          <legend>対象曜日</legend>
          <div className="weekday-picker__chips">
            {weekdayOptions.map((option) => {
              const isSelected = form.targetWeekdays.includes(option.value);

              return (
                <button
                  key={option.value}
                  aria-label={`${option.label}曜日`}
                  aria-pressed={isSelected}
                  className={isSelected ? "weekday-chip weekday-chip--selected" : "weekday-chip"}
                  disabled={disabled}
                  onClick={() => toggleWeekday(option.value)}
                  type="button"
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          <p className="weekday-picker__hint">繰り返したい曜日を選択してください。</p>
        </fieldset>
      ) : null}
      {requiresIntervalDays ? (
        <div className="interval-builder">
          <label htmlFor={intervalInputId}>
            <span>何日間隔ですか</span>
          </label>
          <input
            id={intervalInputId}
            aria-describedby={intervalHintId}
            disabled={disabled}
            inputMode="numeric"
            min="2"
            max="365"
            pattern="[0-9]*"
            value={form.intervalDays}
            onChange={(event) => {
              clearValidationMessage();
              onChange({ ...form, intervalDays: event.target.value });
            }}
            placeholder="3"
          />
          <div className="interval-builder__presets" role="group" aria-label="間隔日数プリセット">
            {intervalPresetOptions.map((preset) => {
              const isSelected = form.intervalDays === String(preset);

              return (
                <button
                  key={preset}
                  aria-pressed={isSelected}
                  className={isSelected ? "interval-chip interval-chip--selected" : "interval-chip"}
                  disabled={disabled}
                  onClick={() => {
                    clearValidationMessage();
                    onChange({ ...form, intervalDays: String(preset) });
                  }}
                  type="button"
                >
                  {preset}日
                </button>
              );
            })}
          </div>
          <small className="field-hint" id={intervalHintId}>
            洗濯のように、数日おきで続けたい習慣に向いています。
          </small>
          {intervalPreview ? (
            <div className="schedule-preview" aria-live="polite">
              <strong>{intervalPreview.description}</strong>
              <span>対象日の例: {intervalPreview.targetDateLabels.join(" / ")}</span>
            </div>
          ) : null}
        </div>
      ) : null}
      {validationMessage ? <p className="weekday-picker__error">{validationMessage}</p> : null}
    </>
  );
}
