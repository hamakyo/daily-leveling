import { useState } from "react";
import type { HabitRecord } from "../../lib/types";
import type { CreateHabitInput } from "../types";
import { HabitScheduleFields } from "./HabitScheduleFields";
import {
  createHabitFormFromRecord,
  hasHabitFormChanges,
  validateHabitForm,
} from "../utils/habitForm";

const weekdayLabels = ["月", "火", "水", "木", "金", "土", "日"];

function formatFrequency(habit: HabitRecord): string {
  if (habit.frequencyType === "daily") {
    return "毎日";
  }

  if (habit.frequencyType === "every_n_days") {
    return habit.intervalDays ? `${habit.intervalDays}日間隔` : "日数間隔";
  }

  const weekdays = (habit.targetWeekdays ?? [])
    .map((weekday) => weekdayLabels[weekday - 1])
    .filter(Boolean)
    .join("・");

  return weekdays ? `毎週 ${weekdays}` : "曜日指定";
}

export function HabitList({
  habits,
  onDelete,
  onMove,
  onSaveEdit,
}: {
  habits: HabitRecord[];
  onDelete: (habitId: string) => Promise<void>;
  onMove: (habitId: string, direction: -1 | 1) => void;
  onSaveEdit: (habitId: string, payload: CreateHabitInput) => Promise<void>;
}) {
  const [editingHabitId, setEditingHabitId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<CreateHabitInput | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [savingHabitId, setSavingHabitId] = useState<string | null>(null);
  const [deletingHabitId, setDeletingHabitId] = useState<string | null>(null);

  function startEditing(habit: HabitRecord) {
    setEditingHabitId(habit.id);
    setEditingForm(createHabitFormFromRecord(habit));
    setValidationMessage(null);
  }

  function cancelEditing() {
    setEditingHabitId(null);
    setEditingForm(null);
    setValidationMessage(null);
  }

  async function saveEditing(habit: HabitRecord) {
    if (!editingForm) {
      return;
    }

    const nextValidationMessage = validateHabitForm(editingForm);
    if (nextValidationMessage) {
      setValidationMessage(nextValidationMessage);
      return;
    }

    setSavingHabitId(habit.id);
    try {
      await onSaveEdit(habit.id, editingForm);
      cancelEditing();
    } finally {
      setSavingHabitId(null);
    }
  }

  async function deleteExistingHabit(habitId: string) {
    setDeletingHabitId(habitId);
    try {
      await onDelete(habitId);
    } finally {
      setDeletingHabitId(null);
    }
  }

  return (
    <div className="habit-admin-list">
      {habits
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((habit) => {
          const isEditing = editingHabitId === habit.id;
          const isSaving = savingHabitId === habit.id;
          const isDeleting = deletingHabitId === habit.id;
          const hasChanges = editingForm ? hasHabitFormChanges(editingForm, habit) : false;

          return (
            <article className={isEditing ? "habit-admin-row habit-admin-row--editing" : "habit-admin-row"} key={habit.id}>
              {isEditing && editingForm ? (
                <form
                  className="stack-form habit-edit-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void saveEditing(habit);
                  }}
                >
                  <label>
                    <span>習慣名</span>
                    <input
                      disabled={isSaving}
                      required
                      value={editingForm.name}
                      onChange={(event) => {
                        setValidationMessage(null);
                        setEditingForm({
                          ...editingForm,
                          name: event.target.value,
                        });
                      }}
                    />
                  </label>
                  <HabitScheduleFields
                    disabled={isSaving}
                    form={editingForm}
                    onChange={(nextForm) => setEditingForm(nextForm)}
                    onValidationMessageClear={() => setValidationMessage(null)}
                    validationMessage={validationMessage}
                  />
                  <div className="toolbar habit-edit-form__actions">
                    <button className="pill" disabled={isSaving} onClick={cancelEditing} type="button">
                      キャンセル
                    </button>
                    <button className="secondary-button" disabled={isSaving || !hasChanges} type="submit">
                      {isSaving ? "保存中..." : "更新"}
                    </button>
                  </div>
                </form>
              ) : (
                <>
                  <div className="habit-admin-row__content">
                    <strong>
                      {habit.emoji ? `${habit.emoji} ` : ""}
                      {habit.name}
                    </strong>
                    <p>{habit.isActive ? `有効 ・ ${formatFrequency(habit)}` : "削除済み"}</p>
                  </div>
                  <div className="toolbar habit-admin-row__actions">
                    <button className="pill" onClick={() => startEditing(habit)} type="button">
                      編集
                    </button>
                    <button className="pill" onClick={() => onMove(habit.id, -1)} type="button">
                      ↑
                    </button>
                    <button className="pill" onClick={() => onMove(habit.id, 1)} type="button">
                      ↓
                    </button>
                    {habit.isActive ? (
                      <button
                        className="pill pill--danger"
                        disabled={isDeleting}
                        onClick={() => void deleteExistingHabit(habit.id)}
                        type="button"
                      >
                        {isDeleting ? "削除中..." : "削除"}
                      </button>
                    ) : null}
                  </div>
                </>
              )}
            </article>
          );
        })}
    </div>
  );
}
