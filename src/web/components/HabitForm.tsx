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
  const [showWeekdayError, setShowWeekdayError] = useState(false);
  const requiresWeekdays = form.frequencyType === "weekly_days";

  function toggleWeekday(weekday: number) {
    const isSelected = form.targetWeekdays.includes(weekday);
    const nextWeekdays = isSelected
      ? form.targetWeekdays.filter((value) => value !== weekday)
      : [...form.targetWeekdays, weekday].sort((left, right) => left - right);

    onChange({ ...form, targetWeekdays: nextWeekdays });
    if (nextWeekdays.length > 0) {
      setShowWeekdayError(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (requiresWeekdays && form.targetWeekdays.length === 0) {
      event.preventDefault();
      setShowWeekdayError(true);
      return;
    }

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
            setShowWeekdayError(false);
            onChange({
              ...form,
              frequencyType: event.target.value as CreateHabitInput["frequencyType"],
              targetWeekdays: event.target.value === "weekly_days" ? form.targetWeekdays : [],
            });
          }}
        >
          <option value="daily">毎日</option>
          <option value="weekly_days">曜日指定</option>
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
          {showWeekdayError ? <p className="weekday-picker__error">1つ以上の曜日を選択してください。</p> : null}
        </fieldset>
      ) : null}
      <button className="secondary-button" disabled={disabled} type="submit">
        {buttonLabel}
      </button>
    </form>
  );
}
