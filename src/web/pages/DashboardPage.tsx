import { type FormEvent, startTransition, useDeferredValue, useEffect, useState } from "react";
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

  async function refreshDashboardData() {
    setIsBusy(true);
    try {
      const data = await loadDashboardData(deferredMonth);
      setToday(data.today);
      setMonthly(data.monthly);
      setHabits(data.habits);
      setSettings(data.settings);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void refreshDashboardData();
  }, [deferredMonth]);

  async function reloadAll(message?: string) {
    await Promise.all([refreshDashboardData(), onUserReload()]);
    if (message) {
      setNotice(message);
    }
  }

  async function toggleHabit(habitId: string, status: boolean) {
    if (!today) {
      return;
    }

    await toggleHabitLog(habitId, today.date, status);
    await refreshDashboardData();
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
      </section>

      {notice ? <p className="status-text">{notice}</p> : null}

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
              <MonthlyHabitGrid month={deferredMonth} monthly={monthly} />
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
