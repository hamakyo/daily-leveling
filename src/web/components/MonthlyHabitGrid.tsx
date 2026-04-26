import { Fragment } from "react";
import type { MonthlyDashboard } from "../../lib/types";
import { enumerateDates, getMonthRange } from "../../lib/date";
import { isTargetDay } from "../utils/month";
import { MetricCard } from "./MetricCard";

export function MonthlyHabitGrid({
  monthly,
  month,
}: {
  monthly: MonthlyDashboard | null;
  month: string;
}) {
  if (!monthly) {
    return <p>月間ビューを読み込んでいます。</p>;
  }

  const range = getMonthRange(month);
  const monthDates = enumerateDates(range.startDate, range.endDate);
  const logLookup = new Map(monthly.logs.map((log) => [`${log.habitId}:${log.date}`, log.status]));

  return (
    <>
      <div className="summary-grid">
        <MetricCard label="月間達成率" value={`${monthly.summary.progressRate}%`} />
        <MetricCard label="現在の連続達成日数" value={monthly.summary.currentStreak} />
        <MetricCard label="達成数" value={monthly.summary.completedCount} />
      </div>
      <div className="monthly-grid">
        <div className="monthly-grid__header monthly-grid__corner">習慣</div>
        {monthDates.map((date) => (
          <div className="monthly-grid__header" key={date}>
            {date.slice(-2)}
          </div>
        ))}
        {monthly.habits.map((habit) => (
          <Fragment key={habit.habitId}>
            <div className="monthly-grid__habit" key={`${habit.habitId}:label`}>
              {habit.emoji ? `${habit.emoji} ` : ""}
              {habit.name}
            </div>
            {monthDates.map((date) => {
              const isScheduled = isTargetDay(habit, date);
              const isDone = logLookup.get(`${habit.habitId}:${date}`) === true;
              const className = isDone
                ? "grid-cell grid-cell--done"
                : isScheduled
                  ? "grid-cell grid-cell--target"
                  : "grid-cell";

              return <div className={className} key={`${habit.habitId}:${date}`} />;
            })}
          </Fragment>
        ))}
      </div>
      <div className="stats-columns">
        <div>
          <h3>日別達成率</h3>
          <ul className="data-list">
            {monthly.dailyStats.map((stat) => (
              <li key={stat.date}>
                <span>{stat.date}</span>
                <strong>{stat.progressRate}%</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>習慣別達成率</h3>
          <ul className="data-list">
            {monthly.habitStats.map((stat) => (
              <li key={stat.habitId}>
                <span>{stat.name}</span>
                <strong>{stat.progressRate}%</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </>
  );
}
