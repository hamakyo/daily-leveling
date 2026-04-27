import type { HabitRecord } from "../../lib/types";

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
  onArchive,
  onMove,
}: {
  habits: HabitRecord[];
  onArchive: (habitId: string) => void;
  onMove: (habitId: string, direction: -1 | 1) => void;
}) {
  return (
    <div className="habit-admin-list">
      {habits
        .slice()
        .sort((left, right) => left.displayOrder - right.displayOrder)
        .map((habit) => (
          <article className="habit-admin-row" key={habit.id}>
            <div>
              <strong>
                {habit.emoji ? `${habit.emoji} ` : ""}
                {habit.name}
              </strong>
              <p>{habit.isActive ? `有効 ・ ${formatFrequency(habit)}` : "アーカイブ済み"}</p>
            </div>
            <div className="toolbar">
              <button className="pill" onClick={() => onMove(habit.id, -1)} type="button">
                ↑
              </button>
              <button className="pill" onClick={() => onMove(habit.id, 1)} type="button">
                ↓
              </button>
              {habit.isActive ? (
                <button className="pill" onClick={() => onArchive(habit.id)} type="button">
                  アーカイブ
                </button>
              ) : null}
            </div>
          </article>
        ))}
    </div>
  );
}
