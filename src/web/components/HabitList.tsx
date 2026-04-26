import type { HabitRecord } from "../../lib/types";

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
              <p>{habit.isActive ? "有効" : "アーカイブ済み"}</p>
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
