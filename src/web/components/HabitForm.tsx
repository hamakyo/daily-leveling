import { type FormEvent, useState } from "react";
import { HabitScheduleFields } from "./HabitScheduleFields";
import type { CreateHabitInput } from "../types";
import { validateHabitForm } from "../utils/habitForm";

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

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const nextValidationMessage = validateHabitForm(form);
    if (nextValidationMessage) {
      event.preventDefault();
      setValidationMessage(nextValidationMessage);
      return;
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
      <HabitScheduleFields
        disabled={disabled}
        form={form}
        onChange={onChange}
        onValidationMessageClear={() => setValidationMessage(null)}
        validationMessage={validationMessage}
      />
      <button className="secondary-button" disabled={disabled} type="submit">
        {buttonLabel}
      </button>
    </form>
  );
}
