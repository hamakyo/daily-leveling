import type { FormEvent } from "react";
import type { CreateHabitInput } from "../types";
import { habitColorOptions } from "../utils/habitForm";

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
  return (
    <form className="stack-form" onSubmit={onSubmit}>
      <label>
        <span>名前</span>
        <input
          required
          value={form.name}
          onChange={(event) => onChange({ ...form, name: event.target.value })}
          placeholder="読書"
        />
      </label>
      <label>
        <span>色</span>
        <select
          value={form.color}
          onChange={(event) => onChange({ ...form, color: event.target.value })}
        >
          {habitColorOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>頻度</span>
        <select
          value={form.frequencyType}
          onChange={(event) =>
            onChange({
              ...form,
              frequencyType: event.target.value as CreateHabitInput["frequencyType"],
            })
          }
        >
          <option value="daily">毎日</option>
          <option value="weekly_days">曜日指定</option>
        </select>
      </label>
      {form.frequencyType === "weekly_days" ? (
        <label>
          <span>対象曜日</span>
          <input
            value={form.targetWeekdays}
            onChange={(event) => onChange({ ...form, targetWeekdays: event.target.value })}
            placeholder="1,3,5  （月・水・金）"
          />
        </label>
      ) : null}
      <button className="secondary-button" disabled={disabled} type="submit">
        {buttonLabel}
      </button>
    </form>
  );
}
