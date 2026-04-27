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
            <label className={!habit.isTargetDay ? "checkbox-toggle checkbox-toggle--disabled" : "checkbox-toggle"}>
              <input
                checked={habit.status === true}
                disabled={!habit.isTargetDay || isBusy}
                onChange={() => onToggle(habit.habitId, !habit.status)}
                type="checkbox"
              />
              <span className={habit.status ? "checkbox-indicator checkbox-indicator--checked" : "checkbox-indicator"} />
              <span className="checkbox-toggle__text">
                {!habit.isTargetDay ? "対象外" : habit.status ? "達成" : "未達"}
              </span>
            </label>
          </article>
        ))}
      </div>
    </>
  );
}
