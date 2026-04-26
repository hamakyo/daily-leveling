import type { TodayDashboard } from "../../lib/types";

export function TodayHabitList({
  today,
  isBusy,
  onToggle,
}: {
  today: TodayDashboard | null;
  isBusy: boolean;
  onToggle: (habitId: string, status: boolean) => void;
}) {
  if (!today) {
    return <p>今日の記録を読み込んでいます。</p>;
  }

  return (
    <>
      <div className="summary-band">
        <strong>{today.summary.progressRate}%</strong>
        <span>{today.date}</span>
      </div>
      <div className="today-list">
        {today.habits.map((habit) => (
          <article className="today-card" key={habit.habitId}>
            <div>
              <strong>
                {habit.emoji ? `${habit.emoji} ` : ""}
                {habit.name}
              </strong>
              <p>{habit.isTargetDay ? "対象日" : "休みの日"}</p>
            </div>
            <button
              className={habit.status ? "toggle-button toggle-button--done" : "toggle-button"}
              disabled={!habit.isTargetDay || isBusy}
              onClick={() => onToggle(habit.habitId, !habit.status)}
              type="button"
            >
              {habit.status ? "達成" : "記録する"}
            </button>
          </article>
        ))}
      </div>
    </>
  );
}
