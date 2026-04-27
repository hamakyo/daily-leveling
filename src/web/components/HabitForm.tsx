import { type FormEvent, useState } from "react";
import type { CreateHabitInput } from "../types";
import { weekdayOptions } from "../utils/habitForm";

export function HabitForm({
  form,
  buttonLabel,
  disabled,
  onChange,
  onSubmit,
}: {
  form: CreateHabitInput;
  buttonLabel: string;
  disabled?: boolean;
  onChange: (form: CreateHabitInput) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const requiresWeekdays = form.frequencyType === "weekly_days";
  const requiresIntervalDays = form.frequencyType === "every_n_days";

  function toggleWeekday(weekday: number) {
    const isSelected = form.targetWeekdays.includes(weekday);
    const nextWeekdays = isSelected
      ? form.targetWeekdays.filter((value) => value !== weekday)
      : [...form.targetWeekdays, weekday].sort((left, right) => left - right);

    onChange({ ...form, targetWeekdays: nextWeekdays });
    if (nextWeekdays.length > 0) {
      setValidationMessage(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (requiresWeekdays && form.targetWeekdays.length === 0) {
      event.preventDefault();
      setValidationMessage("1つ以上の曜日を選択してください。");
      return;
    }

    if (requiresIntervalDays) {
      const intervalDays = Number.parseInt(form.intervalDays, 10);
      if (!Number.isInteger(intervalDays) || intervalDays < 2 || intervalDays > 365) {
        event.preventDefault();
        setValidationMessage("間隔日数は 2 から 365 の整数で指定してください。");
        return;
      }
    }

    setValidationMessage(null);
    onSubmit(event);
  }

  return (
    <form className="stack-form" onSubmit={handleSubmit}>
      <label>
        <span>名前</span>
        <input
          disabled={disabled}
          required
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="読書"
        />
      </label>
      <label>
        <span>頻度</span>
        <select
          disabled={disabled}
          value={form.frequencyType}
          onChange={(event) => {
            const frequencyType = event.target.value as CreateHabitInput["frequencyType"];
            setValidationMessage(null);
            onChange({
              ...form,
              frequencyType,
              targetWeekdays: frequencyType === "weekly_days" ? form.targetWeekdays : [],
            });
          }}
        >
          <option value="daily">毎日</option>
          <option value="weekly_days">曜日指定</option>
          <option value="every_n_days">n日ごと</option>
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
        <label>
          <span>間隔日数</span>
          <input
            disabled={disabled}
            inputMode="numeric"
            min="2"
            max="365"
            pattern="[0-9]*"
            value={form.intervalDays}
            onChange={(event) => {
              setValidationMessage(null);
              onChange({ ...form, intervalDays: event.target.value });
            }}
            placeholder="3"
          />
          <small className="field-hint">作成日を起点に、指定した日数ごとに対象日になります。</small>
        </label>
      ) : null}
      {validationMessage ? <p className="weekday-picker__error">{validationMessage}</p> : null}
      <button className="secondary-button" disabled={disabled} type="submit">
        {buttonLabel}
      </button>
    </form>
  );
}
