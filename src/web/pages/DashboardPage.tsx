import { type FormEvent, startTransition, useDeferredValue, useEffect, useRef, useState } from "react";
import type { CurrentUser, HabitRecord, MonthlyDashboard, TodayDashboard, WeeklyDashboard } from "../../lib/types";
import {
  createHabit,
  deleteHabit as deleteHabitApi,
  loadDashboardData,
  logout,
  reorderHabits,
  saveSettings,
  toggleHabitLog,
  updateHabit as updateHabitApi,
} from "../api";
import { HabitForm } from "../components/HabitForm";
import { HabitList } from "../components/HabitList";
import { MonthlyHabitGrid } from "../components/MonthlyHabitGrid";
import { SettingsForm } from "../components/SettingsForm";
import { TodayHabitList } from "../components/TodayHabitList";
import { WeeklySummary } from "../components/WeeklySummary";
import type { CreateHabitInput, UserSettings } from "../types";
import { createEmptyHabitForm, toHabitPayload } from "../utils/habitForm";
import { currentDateString, currentMonthString, shiftDate, shiftMonth } from "../utils/month";
import { areSettingsEqual, reconcileSettingsAfterRefresh } from "../utils/settings";
import { watchThemePreference } from "../utils/theme";
import { moveItem } from "../utils/todayOrder";

export function DashboardPage({
  user,
  onUserReload,
  onLogout,
}: {
  user: CurrentUser;
  onUserReload: () => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [view, setView] = useState<"today" | "week" | "month">(user.defaultView);
  const [selectedMonth, setSelectedMonth] = useState(currentMonthString());
  const [selectedWeekDate, setSelectedWeekDate] = useState(currentDateString());
  const deferredMonth = useDeferredValue(selectedMonth);
  const deferredWeekDate = useDeferredValue(selectedWeekDate);
  const [today, setToday] = useState<TodayDashboard | null>(null);
  const [weekly, setWeekly] = useState<WeeklyDashboard | null>(null);
  const [monthly, setMonthly] = useState<MonthlyDashboard | null>(null);
  const [habits, setHabits] = useState<HabitRecord[]>([]);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [savedSettings, setSavedSettings] = useState<UserSettings | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [settingsStatusMessage, setSettingsStatusMessage] = useState<string | null>(null);
  const [settingsStatusTone, setSettingsStatusTone] = useState<"success" | "error" | null>(null);
  const [form, setForm] = useState<CreateHabitInput>(createEmptyHabitForm);
  const [displayedLevelProgress, setDisplayedLevelProgress] = useState(0);
  const [levelUpState, setLevelUpState] = useState<{ id: number; level: number } | null>(null);
  const [streakToast, setStreakToast] = useState<{ id: number; streak: number } | null>(null);
  const [todayCompleteState, setTodayCompleteState] = useState<{ id: number } | null>(null);
  const [isTodayReorderMode, setIsTodayReorderMode] = useState(false);
  const [draftTodayHabitIds, setDraftTodayHabitIds] = useState<string[]>([]);
  const [isSavingTodayOrder, setIsSavingTodayOrder] = useState(false);
  const feedbackIdRef = useRef(0);
  const levelTransitionTimeoutRef = useRef<number | null>(null);
  const previousLevelRef = useRef<{ level: number; progressRate: number } | null>(null);

  async function refreshDashboardData(month = deferredMonth, weekDate = deferredWeekDate) {
    setIsBusy(true);
    try {
      const data = await loadDashboardData(month, weekDate);
      setToday(data.today);
      setWeekly(data.weekly);
      setMonthly(data.monthly);
      setHabits(data.habits);
      const nextSettingsState = reconcileSettingsAfterRefresh({
        currentSettings: settings,
        refreshedSettings: data.settings,
        savedSettings,
      });
      setSettings(nextSettingsState.nextSettings);
      setSavedSettings(nextSettingsState.nextSavedSettings);
      setDashboardError(null);
      return data;
    } catch (error) {
      setDashboardError(error instanceof Error ? error.message : "ダッシュボードの読み込みに失敗しました。");
      return null;
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void refreshDashboardData();
  }, [deferredMonth, deferredWeekDate]);

  useEffect(() => {
    return watchThemePreference(settings?.theme ?? user.theme);
  }, [settings?.theme, user.theme]);

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

  useEffect(() => {
    if (!today || isTodayReorderMode) {
      return;
    }

    setDraftTodayHabitIds(today.habits.map((habit) => habit.habitId));
  }, [today, isTodayReorderMode]);

  async function reloadAll(message?: string) {
    const [dashboardData] = await Promise.all([refreshDashboardData(), onUserReload()]);
    if (message && dashboardData) {
      setNotice(message);
    }
  }

  async function toggleHabit(habitId: string, status: boolean) {
    if (!today || !monthly || isTodayReorderMode) {
      return;
    }

    const previousToday = today;
    const feedbackMonth = currentMonthString();

    await toggleHabitLog(habitId, today.date, status);
    if (selectedMonth !== feedbackMonth) {
      startTransition(() => setSelectedMonth(feedbackMonth));
    }

    const nextData = await refreshDashboardData(feedbackMonth);
    if (!status || !nextData) {
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

  async function updateExistingHabit(habitId: string, payload: CreateHabitInput) {
    await updateHabitApi(habitId, toHabitPayload(payload));
    await reloadAll("習慣を更新しました。");
  }

  async function deleteHabit(habitId: string) {
    await deleteHabitApi(habitId);
    await reloadAll("習慣を削除しました。累計XPは維持されます。");
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

  function startTodayReorder() {
    if (!today) {
      return;
    }

    setDraftTodayHabitIds(today.habits.map((habit) => habit.habitId));
    setIsTodayReorderMode(true);
  }

  function cancelTodayReorder() {
    if (today) {
      setDraftTodayHabitIds(today.habits.map((habit) => habit.habitId));
    }
    setIsTodayReorderMode(false);
  }

  function moveTodayHabit(habitId: string, direction: -1 | 1) {
    setDraftTodayHabitIds((current) => {
      const index = current.indexOf(habitId);
      if (index < 0) {
        return current;
      }

      const nextIndex = index + direction;
      return moveItem(current, index, nextIndex);
    });
  }

  async function saveTodayOrder() {
    if (!today || draftTodayHabitIds.length === 0) {
      return;
    }

    setIsSavingTodayOrder(true);
    try {
      await reorderHabits(draftTodayHabitIds);
      setIsTodayReorderMode(false);
      await reloadAll("今日の記録の並び順を更新しました。");
    } finally {
      setIsSavingTodayOrder(false);
    }
  }

  const hasTodayOrderChanges = today
    ? draftTodayHabitIds.length === today.habits.length &&
      draftTodayHabitIds.some((habitId, index) => habitId !== today.habits[index]?.habitId)
    : false;

  async function handleSettingsSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings || !savedSettings || areSettingsEqual(settings, savedSettings)) {
      return;
    }

    setIsSavingSettings(true);
    setSettingsStatusMessage(null);
    setSettingsStatusTone(null);

    try {
      await saveSettings(settings);
      await reloadAll("設定を更新しました。");
      setSavedSettings(settings);
      setSettingsStatusMessage("設定を保存しました。");
      setSettingsStatusTone("success");
    } catch (error) {
      setSettingsStatusMessage(error instanceof Error ? error.message : "設定の保存に失敗しました。");
      setSettingsStatusTone("error");
    } finally {
      setIsSavingSettings(false);
    }
  }

  const hasUnsavedSettingsChanges = !areSettingsEqual(settings, savedSettings);

  function resetSettingsChanges() {
    if (!savedSettings) {
      return;
    }

    setSettings(savedSettings);
    setSettingsStatusMessage(null);
    setSettingsStatusTone(null);
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <div className="page-shell">
      <section className="hero-card hero-card--compact">
        <div className="hero-card__main">
          <p className="eyebrow">{user.displayName} としてログイン中</p>
          <h1>Daily Leveling</h1>
          <p className="lede">
            週間を、今日の一歩に変える。
          </p>
        </div>
        <div className="dashboard-hero-side">
          <div className="dashboard-nav">
            <div className="dashboard-nav__views" aria-label="表示切り替え">
              <button
                className={view === "today" ? "pill pill--active" : "pill"}
                onClick={() => setView("today")}
                type="button"
              >
                今日
              </button>
              <button
                className={view === "week" ? "pill pill--active" : "pill"}
                onClick={() => setView("week")}
                type="button"
              >
                週間
              </button>
              <button
                className={view === "month" ? "pill pill--active" : "pill"}
                onClick={() => setView("month")}
                type="button"
              >
                月間
              </button>
            </div>
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
        <div className="dashboard-main-stack">
          <div className="panel panel--wide dashboard-primary">
            {dashboardError ? (
              <div className="stack-space">
                <header className="section-header">
                  <h2>ダッシュボードを読み込めませんでした</h2>
                </header>
                <p className="status-text status-text--error">{dashboardError}</p>
                <div className="toolbar">
                  <button className="primary-button" onClick={() => void refreshDashboardData()} type="button">
                    再試行
                  </button>
                </div>
              </div>
            ) : view === "today" ? (
              <div className="stack-space">
                <header className="section-header">
                  <h2>今日の記録</h2>
                  <div className="toolbar">
                    {today ? (
                      <span>
                        {today.summary.completedCount}/{today.summary.targetCount} 達成
                      </span>
                    ) : null}
                    {isTodayReorderMode ? (
                      <>
                        <button
                          className="pill"
                          disabled={isSavingTodayOrder}
                          onClick={cancelTodayReorder}
                          type="button"
                        >
                          キャンセル
                        </button>
                        <button
                          className="secondary-button"
                          disabled={isSavingTodayOrder || !hasTodayOrderChanges}
                          onClick={() => void saveTodayOrder()}
                          type="button"
                        >
                          {isSavingTodayOrder ? "保存中..." : "順番を保存"}
                        </button>
                      </>
                    ) : (
                      <button className="pill" onClick={startTodayReorder} type="button">
                        並び替え
                      </button>
                    )}
                  </div>
                </header>
                {isTodayReorderMode ? (
                  <p className="status-text status-text--warning">
                    今日の記録の順番を調整しています。保存すると他の一覧にも反映されます。
                  </p>
                ) : null}
                {todayCompleteState ? (
                  <div className="today-complete-banner">
                    <strong>今日の習慣をすべて達成しました</strong>
                    <span>そのまま streak と XP を積み上げましょう。</span>
                  </div>
                ) : null}
                <TodayHabitList
                  isBusy={isBusy || isTodayReorderMode}
                  isReorderMode={isTodayReorderMode}
                  isSavingOrder={isSavingTodayOrder}
                  onToggle={(habitId, status) => void toggleHabit(habitId, status)}
                  onMove={moveTodayHabit}
                  orderedHabitIds={draftTodayHabitIds}
                  today={today}
                />
              </div>
            ) : view === "week" ? (
              <div className="stack-space">
                <header className="section-header">
                  <h2>週間ビュー</h2>
                  <div className="toolbar">
                    <button
                      className="pill"
                      onClick={() => {
                        startTransition(() => setSelectedWeekDate((current) => shiftDate(current, -7)));
                      }}
                      type="button"
                    >
                      前週
                    </button>
                    <span className="month-chip">
                      {weekly ? `${weekly.week.startDate} - ${weekly.week.endDate}` : deferredWeekDate}
                    </span>
                    <button
                      className="pill"
                      onClick={() => {
                        startTransition(() => setSelectedWeekDate((current) => shiftDate(current, 7)));
                      }}
                      type="button"
                    >
                      次週
                    </button>
                  </div>
                </header>
                <WeeklySummary weekly={weekly} />
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

          <section className="panel dashboard-settings">
            <h2>設定</h2>
            <SettingsForm
              hasUnsavedChanges={hasUnsavedSettingsChanges}
              isLoggingOut={isLoggingOut}
              isSaving={isSavingSettings}
              onChange={(nextSettings) => {
                setSettings(nextSettings);
                setSettingsStatusMessage(null);
                setSettingsStatusTone(null);
              }}
              onLogout={() => void handleLogout()}
              onReset={resetSettingsChanges}
              onSubmit={handleSettingsSave}
              settings={settings}
              statusTone={settingsStatusTone}
              statusMessage={settingsStatusMessage}
            />
          </section>
        </div>

        <aside className="side-stack dashboard-side">
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
              onDelete={(habitId) => deleteHabit(habitId)}
              onMove={(habitId, direction) => void moveHabit(habitId, direction)}
              onSaveEdit={(habitId, payload) => updateExistingHabit(habitId, payload)}
            />
          </section>

        </aside>
      </section>
    </div>
  );
}
