import { type FormEvent, startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import type { CurrentUser, HabitRecord, MonthlyDashboard, TodayDashboard } from "../../lib/types";
import {
  archiveHabit as archiveHabitApi,
  createHabit,
  loadDashboardData,
  logout,
  reorderHabits,
  saveSettings,
  toggleHabitLog,
} from "../api";
import { HabitForm } from "../components/HabitForm";
import { HabitList } from "../components/HabitList";
import { MonthlyHabitGrid } from "../components/MonthlyHabitGrid";
import { SettingsForm } from "../components/SettingsForm";
import { TodayHabitList } from "../components/TodayHabitList";
import type { CreateHabitInput, UserSettings } from "../types";
import { createEmptyHabitForm, toHabitPayload } from "../utils/habitForm";
import { currentMonthString, shiftMonth } from "../utils/month";

export function DashboardPage({
  user,
  onUserReload,
  onLogout,
}: {
  user: CurrentUser;
  onUserReload: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [view, setView] = useState<"today" | "month">(user.defaultView);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString());
  const deferredMonth = useDeferredValue(selectedMonth);
  const [today, setToday] = useState<TodayDashboard | null>(null);
  const [monthly, setMonthly] = useState<MonthlyDashboard | null>(null);
  const [habits, setHabits] = useState<HabitRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [form, setForm] = useState<CreateHabitInput>(createEmptyHabitForm);
  const [displayedLevelProgress, setDisplayedLevelProgress] = useState(0);
  const [levelUpState, setLevelUpState] = useState<{ id: number; level: number } | null>(null);
  const [streakToast, setStreakToast] = useState<{ id: number; streak: number } | null>(null);
  const [todayCompleteState, setTodayCompleteState] = useState<{ id: number } | null>(null);
  const feedbackIdRef = useRef(0);
  const levelTransitionTimeoutRef = useRef<number | null>(null);
  const previousLevelRef = useRef<{ level: number; progressRate: number } | null>(null);

  async function refreshDashboardData(month = deferredMonth) {
    setIsBusy(true);
    try {
      const data = await loadDashboardData(month);
      setToday(data.today);
      setMonthly(data.monthly);
      setHabits(data.habits);
      setSettings(data.settings);
      return data;
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void refreshDashboardData();
  }, [deferredMonth]);

  useEffect(() => {
    if (!today) {
      return;
    }

    const previous = previousLevelRef.current;
    if (!previous) {
      setDisplayedLevelProgress(today.level.progressRate);
      previousLevelRef.current = {
        level: today.level.level,
        progressRate: today.level.progressRate,
      };
      return;
    }

    if (levelTransitionTimeoutRef.current !== null) {
      window.clearTimeout(levelTransitionTimeoutRef.current);
      levelTransitionTimeoutRef.current = null;
    }

    if (today.level.level > previous.level) {
      setDisplayedLevelProgress(100);
      levelTransitionTimeoutRef.current = window.setTimeout(() => {
        setDisplayedLevelProgress(today.level.progressRate);
        levelTransitionTimeoutRef.current = null;
      }, 260);
    } else {
      setDisplayedLevelProgress(today.level.progressRate);
    }

    previousLevelRef.current = {
      level: today.level.level,
      progressRate: today.level.progressRate,
    };
  }, [today]);

  useEffect(() => {
    return () => {
      if (levelTransitionTimeoutRef.current !== null) {
        window.clearTimeout(levelTransitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!levelUpState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLevelUpState((current) => (current?.id === levelUpState.id ? null : current));
    }, 1800);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [levelUpState]);

  useEffect(() => {
    if (!streakToast) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setStreakToast((current) => (current?.id === streakToast.id ? null : current));
    }, 2400);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [streakToast]);

  useEffect(() => {
    if (!todayCompleteState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setTodayCompleteState((current) => (current?.id === todayCompleteState.id ? null : current));
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [todayCompleteState]);

  async function reloadAll(message?: string) {
    await Promise.all([refreshDashboardData(), onUserReload()]);
    if (message) {
      setNotice(message);
    }
  }

  async function toggleHabit(habitId: string, status: boolean) {
    if (!today || !monthly) {
      return;
    }

    const previousToday = today;
    const feedbackMonth = currentMonthString();

    await toggleHabitLog(habitId, today.date, status);
    if (selectedMonth !== feedbackMonth) {
      startTransition(() => setSelectedMonth(feedbackMonth));
    }

    const nextData = await refreshDashboardData(feedbackMonth);
    if (!status) {
      return;
    }

    const nextFeedbackId = feedbackIdRef.current + 1;
    feedbackIdRef.current = nextFeedbackId;

    if (nextData.today.level.level > previousToday.level.level) {
      setLevelUpState({
        id: nextFeedbackId,
        level: nextData.today.level.level,
      });
    }

    const previousCompleted =
      previousToday.summary.targetCount > 0 &&
      previousToday.summary.completedCount === previousToday.summary.targetCount;
    const nextCompleted =
      nextData.today.summary.targetCount > 0 &&
      nextData.today.summary.completedCount === nextData.today.summary.targetCount;

    if (!previousCompleted && nextCompleted && nextData.monthly.summary.currentStreak > 0) {
      setStreakToast({
        id: nextFeedbackId,
        streak: nextData.monthly.summary.currentStreak,
      });
    }

    if (!previousCompleted && nextCompleted) {
      setTodayCompleteState({ id: nextFeedbackId });
    }
  }

  async function createNewHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await createHabit(toHabitPayload(form));
    setForm(createEmptyHabitForm());
    await reloadAll("習慣を作成しました。");
  }

  async function archiveHabit(habitId: string) {
    await archiveHabitApi(habitId);
    await reloadAll("習慣をアーカイブしました。");
  }

  async function moveHabit(habitId: string, direction: -1 | 1) {
    const ordered = [...habits].sort((left, right) => left.displayOrder - right.displayOrder);
    const index = ordered.findIndex((habit) => habit.id === habitId);

    if (index < 0) {
      return;
    }

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= ordered.length) {
      return;
    }

    const [selected] = ordered.splice(index, 1);
    ordered.splice(nextIndex, 0, selected);

    await reorderHabits(ordered.map((habit) => habit.id));
    await reloadAll("習慣の並び順を更新しました。");
  }

  async function handleSettingsSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) {
      return;
    }

    await saveSettings(settings);
    await reloadAll("設定を更新しました。");
  }

  async function handleLogout() {
    await logout();
    await onLogout();
  }

  return (
    <div className="page-shell">
      <section className="hero-card hero-card--compact">
        <div>
          <p className="eyebrow">{user.displayName} としてログイン中</p>
          <h1>Daily Leveling</h1>
          <p className="lede">
            モバイルでは今日、デスクトップでは月全体を中心に振り返れます。
          </p>
        </div>
        <div className="dashboard-hero-side">
          <div className="toolbar">
            <button
              className={view === "today" ? "pill pill--active" : "pill"}
              onClick={() => setView("today")}
              type="button"
            >
              今日
            </button>
            <button
              className={view === "month" ? "pill pill--active" : "pill"}
              onClick={() => setView("month")}
              type="button"
            >
              月間
            </button>
            <button className="pill" onClick={() => void handleLogout()} type="button">
              ログアウト
            </button>
          </div>
          <section className="level-panel" aria-label="レベル進捗">
            {levelUpState ? <div className="level-up-badge">LEVEL UP! Lv {levelUpState.level}</div> : null}
            <div className="level-panel__heading">
              <span className="eyebrow">Level</span>
              <strong>{today ? `レベル ${today.level.level}` : "読み込み中"}</strong>
            </div>
            <div className="level-panel__stats">
              <span>{today ? `${today.level.totalXp} XP` : "-- XP"}</span>
              <span>{today ? `次まで ${today.level.xpToNextLevel} XP` : "--"}</span>
            </div>
            <div className="level-meter" aria-hidden="true">
              <span
                className={levelUpState ? "level-meter__fill level-meter__fill--level-up" : "level-meter__fill"}
                style={{ width: `${displayedLevelProgress}%` }}
              />
            </div>
            <p className="level-panel__note">
              {today ? `累計達成 ${today.level.completedCount} 回` : "レベルを計算しています。"}
            </p>
          </section>
        </div>
      </section>

      {notice ? <p className="status-text">{notice}</p> : null}
      <div aria-live="polite" className="toast-stack">
        {streakToast ? <div className="toast-card">連続達成 {streakToast.streak} 日</div> : null}
      </div>

      <section className="panel-grid panel-grid--dashboard">
        <div className="panel panel--wide">
          {view === "today" ? (
            <div className="stack-space">
              <header className="section-header">
                <h2>今日の記録</h2>
                {today ? (
                  <span>
                    {today.summary.completedCount}/{today.summary.targetCount} 達成
                  </span>
                ) : null}
              </header>
              {todayCompleteState ? (
                <div className="today-complete-banner">
                  <strong>今日の習慣をすべて達成しました</strong>
                  <span>そのまま streak と XP を積み上げましょう。</span>
                </div>
              ) : null}
              <TodayHabitList
                isBusy={isBusy}
                onToggle={(habitId, status) => void toggleHabit(habitId, status)}
                today={today}
              />
            </div>
          ) : (
            <div className="stack-space">
              <header className="section-header">
                <h2>月間ビュー</h2>
                <div className="toolbar">
                  <button
                    className="pill"
                    onClick={() => {
                      startTransition(() => setSelectedMonth((current) => shiftMonth(current, -1)));
                    }}
                    type="button"
                  >
                    前月
                  </button>
                  <span className="month-chip">{deferredMonth}</span>
                  <button
                    className="pill"
                    onClick={() => {
                      startTransition(() => setSelectedMonth((current) => shiftMonth(current, 1)));
                    }}
                    type="button"
                  >
                    次月
                  </button>
                </div>
              </header>
              <MonthlyHabitGrid
                month={deferredMonth}
                monthly={monthly}
                timezone={settings?.timezone ?? user.timezone}
              />
            </div>
          )}
        </div>

        <aside className="side-stack">
          <section className="panel">
            <h2>新しい習慣</h2>
            <HabitForm
              buttonLabel="作成"
              form={form}
              onChange={setForm}
              onSubmit={createNewHabit}
            />
          </section>

          <section className="panel">
            <h2>習慣一覧</h2>
            <HabitList
              habits={habits}
              onArchive={(habitId) => void archiveHabit(habitId)}
              onMove={(habitId, direction) => void moveHabit(habitId, direction)}
            />
          </section>

          <section className="panel">
            <h2>設定</h2>
            <SettingsForm
              onChange={setSettings}
              onSubmit={handleSettingsSave}
              settings={settings}
            />
          </section>
        </aside>
      </section>
    </div>
  );
}
