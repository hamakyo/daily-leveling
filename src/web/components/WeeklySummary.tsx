import type { WeeklyDashboard } from "../../lib/types";
import { MetricCard } from "./MetricCard";

const weekdayLabels = ["月", "火", "水", "木", "金", "土", "日"];

function formatWeekday(date: string): string {
  const value = new Date(`${date}T12:00:00Z`).getUTCDay();
  return weekdayLabels[(value + 6) % 7];
}

export function WeeklySummary({
  weekly,
}: {
  weekly: WeeklyDashboard | null;
}) {
  if (!weekly) {
    return <p>週間ビューを読み込んでいます。</p>;
  }

  return (
    <div className="stack-space">
      <div className="summary-grid">
        <MetricCard label="週間達成率" value={`${weekly.summary.progressRate}%`} />
        <MetricCard label="達成数" value={weekly.summary.completedCount} />
        <MetricCard label="対象数" value={weekly.summary.targetCount} />
      </div>

      <div className="week-strip" role="list" aria-label="週間達成率">
        {weekly.dailyStats.map((stat) => (
          <article className="week-day-card" key={stat.date} role="listitem">
            <span className="week-day-card__label">{formatWeekday(stat.date)}</span>
            <strong>{stat.progressRate}%</strong>
            <span>{stat.date.slice(5)}</span>
            <span>
              {stat.completedCount}/{stat.targetCount}
            </span>
          </article>
        ))}
      </div>

      <div className="stats-columns">
        <div>
          <h3>日別達成率</h3>
          <ul className="data-list">
            {weekly.dailyStats.map((stat) => (
              <li key={stat.date}>
                <span>{`${stat.date} (${formatWeekday(stat.date)})`}</span>
                <strong>{stat.progressRate}%</strong>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3>習慣別達成率</h3>
          <ul className="data-list">
            {weekly.habitStats.map((stat) => (
              <li key={stat.habitId}>
                <span>{stat.name}</span>
                <strong>{stat.progressRate}%</strong>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
