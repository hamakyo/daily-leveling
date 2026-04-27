import { useEffect, useRef, useState } from "react";
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
  const [celebratingHabitId, setCelebratingHabitId] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  if (!today) {
    return <p>今日の記録を読み込んでいます。</p>;
  }

  function triggerCelebrate(habitId: string) {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
    }

    setCelebratingHabitId(habitId);
    timeoutRef.current = window.setTimeout(() => {
      setCelebratingHabitId((current) => (current === habitId ? null : current));
      timeoutRef.current = null;
    }, 700);
  }

  return (
    <>
      <div className="summary-band">
        <strong>{today.summary.progressRate}%</strong>
        <span>{today.date}</span>
      </div>
      <div className="today-list">
        {today.habits.map((habit) => (
          <article
            className={celebratingHabitId === habit.habitId ? "today-card today-card--celebrate" : "today-card"}
            key={habit.habitId}
          >
            <div>
              <strong>
                {habit.emoji ? `${habit.emoji} ` : ""}
                {habit.name}
              </strong>
              <p>{habit.isTargetDay ? "対象日" : "休みの日"}</p>
            </div>
            <label
              aria-label={!habit.isTargetDay ? `${habit.name} は対象外` : habit.status ? `${habit.name} を未達にする` : `${habit.name} を達成にする`}
              className={!habit.isTargetDay ? "checkbox-toggle checkbox-toggle--disabled" : "checkbox-toggle"}
            >
              <input
                checked={habit.status === true}
                disabled={!habit.isTargetDay || isBusy}
                onChange={() => {
                  const nextStatus = !habit.status;
                  if (nextStatus) {
                    triggerCelebrate(habit.habitId);
                  }
                  onToggle(habit.habitId, nextStatus);
                }}
                type="checkbox"
              />
              <span
                className={
                  habit.status
                    ? celebratingHabitId === habit.habitId
                      ? "checkbox-indicator checkbox-indicator--checked checkbox-indicator--celebrate"
                      : "checkbox-indicator checkbox-indicator--checked"
                    : "checkbox-indicator"
                }
              />
            </label>
          </article>
        ))}
      </div>
    </>
  );
}
