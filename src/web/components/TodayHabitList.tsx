import { useEffect, useRef, useState } from "react";
import type { TodayDashboard } from "../../lib/types";

const XP_PER_COMPLETION = 10;

export function TodayHabitList({
  today,
  isBusy,
  isReorderMode,
  isSavingOrder,
  onToggle,
  onMove,
  orderedHabitIds,
}: {
  today: TodayDashboard | null;
  isBusy: boolean;
  isReorderMode?: boolean;
  isSavingOrder?: boolean;
  onToggle: (habitId: string, status: boolean) => void;
  onMove?: (habitId: string, direction: -1 | 1) => void;
  orderedHabitIds?: string[];
}) {
  const [celebratingHabitId, setCelebratingHabitId] = useState<string | null>(null);
  const [xpBursts, setXpBursts] = useState<Array<{ id: number; habitId: string }>>([]);
  const burstIdRef = useRef(0);
  const burstTimeoutIdsRef = useRef<number[]>([]);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      for (const timeoutId of burstTimeoutIdsRef.current) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  if (!today) {
    return <p>今日の記録を読み込んでいます。</p>;
  }

  const orderedHabits =
    orderedHabitIds && orderedHabitIds.length > 0
      ? [
          ...orderedHabitIds
            .map((habitId) => today.habits.find((habit) => habit.habitId === habitId))
            .filter((habit): habit is NonNullable<typeof habit> => Boolean(habit)),
          ...today.habits.filter((habit) => !orderedHabitIds.includes(habit.habitId)),
        ]
      : today.habits;

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

  function spawnXpBurst(habitId: string) {
    const burstId = burstIdRef.current + 1;
    burstIdRef.current = burstId;
    setXpBursts((current) => [...current, { id: burstId, habitId }]);
    const timeoutId = window.setTimeout(() => {
      setXpBursts((current) => current.filter((burst) => burst.id !== burstId));
      burstTimeoutIdsRef.current = burstTimeoutIdsRef.current.filter((id) => id !== timeoutId);
    }, 900);
    burstTimeoutIdsRef.current = [...burstTimeoutIdsRef.current, timeoutId];
  }

  return (
    <>
      <div className="summary-band">
        <strong>{today.summary.progressRate}%</strong>
        <span>{today.date}</span>
      </div>
      <div className="today-list">
        {orderedHabits.map((habit, index) => (
          <article
            className={
              celebratingHabitId === habit.habitId
                ? "today-card today-card--celebrate"
                : isReorderMode
                  ? "today-card today-card--reorder"
                  : "today-card"
            }
            key={habit.habitId}
          >
            <div className="today-card__main">
              <div className="today-card__content">
                <strong>
                  {habit.emoji ? `${habit.emoji} ` : ""}
                  {habit.name}
                </strong>
                <p>{habit.isTargetDay ? "対象日" : "休みの日"}</p>
              </div>
              {isReorderMode ? (
                <div className="today-card__actions">
                  <span className="today-reorder-badge">並び替え</span>
                  <div className="toolbar">
                    <button
                      aria-label={`${habit.name} を上へ移動`}
                      className="pill icon-button"
                      disabled={Boolean(isSavingOrder) || index === 0}
                      onClick={() => onMove?.(habit.habitId, -1)}
                      type="button"
                    >
                      ↑
                    </button>
                    <button
                      aria-label={`${habit.name} を下へ移動`}
                      className="pill icon-button"
                      disabled={Boolean(isSavingOrder) || index === orderedHabits.length - 1}
                      onClick={() => onMove?.(habit.habitId, 1)}
                      type="button"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              ) : (
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
                        spawnXpBurst(habit.habitId);
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
              )}
            </div>
            <div className="xp-burst-layer" aria-hidden="true">
              {xpBursts
                .filter((burst) => burst.habitId === habit.habitId)
                .map((burst) => (
                  <span className="xp-burst" key={burst.id}>
                    +{XP_PER_COMPLETION} XP
                  </span>
                ))}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
