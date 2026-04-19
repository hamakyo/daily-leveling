import {
  Fragment,
  FormEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { templates } from "../domain/templates";
import type { CurrentUser, HabitRecord, MonthlyDashboard, TodayDashboard } from "../lib/types";
import { enumerateDates, getMonthRange } from "../lib/date";
import { apiFetch, ApiError } from "./api";

type AuthResponse = { user: CurrentUser };
type HabitsResponse = { habits: HabitRecord[] };
type SettingsResponse = { settings: { timezone: string; defaultView: "today" | "month" } };

type ScreenState =
  | { kind: "loading" }
  | { kind: "guest" }
  | { kind: "ready"; user: CurrentUser };

type CreateHabitInput = {
  name: string;
  emoji: string;
  color: string;
  frequencyType: "daily" | "weekly_days";
  targetWeekdays: string;
};

function currentMonthString() {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

function toWeekdaysInput(value: string): number[] | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isFinite(item));
}

function isTargetDay(
  habit: {
    frequencyType: "daily" | "weekly_days";
    targetWeekdays: number[] | null;
  },
  date: string,
): boolean {
  if (habit.frequencyType === "daily") {
    return true;
  }

  const jsDate = new Date(`${date}T12:00:00Z`);
  const weekday = jsDate.getUTCDay() === 0 ? 7 : jsDate.getUTCDay();
  return habit.targetWeekdays?.includes(weekday) ?? false;
}

async function loadCurrentUser(): Promise<CurrentUser | null> {
  try {
    const response = await apiFetch<AuthResponse>("/auth/me");
    return response.user;
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      return null;
    }

    throw error;
  }
}

function LoadingShell() {
  return (
    <div className="page-shell">
      <div className="hero-card hero-card--loading">
        <p className="eyebrow">Daily Leveling</p>
        <h1>Booting the habit board.</h1>
        <p>Loading auth state and dashboard data.</p>
      </div>
    </div>
  );
}

function LoginScreen() {
  return (
    <div className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">Habit tracker MVP</p>
        <h1>Daily Leveling</h1>
        <p className="lede">
          A month-grid habit tracker with a fast daily loop and light game feel.
        </p>
        <a className="primary-button" href="/auth/google/start">
          Continue with Google
        </a>
      </section>
      <section className="feature-ribbon">
        <article>
          <strong>Today-first on mobile</strong>
          <span>One-tap check-ins with progress feedback.</span>
        </article>
        <article>
          <strong>Month-first on desktop</strong>
          <span>Grid visibility across the whole month.</span>
        </article>
        <article>
          <strong>Soft restarts</strong>
          <span>Misses are visible, but the UI stays easy to re-enter.</span>
        </article>
      </section>
    </div>
  );
}

function OnboardingScreen({
  onComplete,
}: {
  onComplete: () => Promise<void>;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<CreateHabitInput>({
    name: "",
    emoji: "",
    color: "teal",
    frequencyType: "daily",
    targetWeekdays: "",
  });

  async function applyTemplate(templateId: string) {
    setIsSubmitting(true);
    setMessage(null);
    try {
      await apiFetch("/onboarding/templates/apply", {
        method: "POST",
        body: JSON.stringify({ templateId }),
      });
      setMessage(`Template "${templateId}" applied.`);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function addHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    try {
      await apiFetch("/habits", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          emoji: form.emoji || null,
          color: form.color || null,
          frequencyType: form.frequencyType,
          targetWeekdays: form.frequencyType === "weekly_days" ? toWeekdaysInput(form.targetWeekdays) : null,
        }),
      });
      setForm({
        name: "",
        emoji: "",
        color: "teal",
        frequencyType: "daily",
        targetWeekdays: "",
      });
      setMessage("Habit added.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function finishOnboarding() {
    setIsSubmitting(true);
    try {
      await apiFetch("/onboarding/complete", {
        method: "POST",
        body: JSON.stringify({ completed: true }),
      });
      await onComplete();
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">First login</p>
        <h1>Start with a small system.</h1>
        <p className="lede">
          Apply a template, add a custom habit, then move into the dashboard.
        </p>
        {message ? <p className="status-text">{message}</p> : null}
      </section>
      <section className="panel-grid">
        <div className="panel">
          <h2>Templates</h2>
          <div className="template-stack">
            {Object.entries(templates).map(([templateId, habits]) => (
              <button
                key={templateId}
                className="template-card"
                disabled={isSubmitting}
                onClick={() => {
                  void applyTemplate(templateId);
                }}
                type="button"
              >
                <strong>{templateId}</strong>
                <span>{habits.map((habit) => habit.name).join(" / ")}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>Manual habit</h2>
          <form className="stack-form" onSubmit={addHabit}>
            <label>
              <span>Name</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="Reading"
                required
              />
            </label>
            <label>
              <span>Emoji</span>
              <input
                value={form.emoji}
                onChange={(event) => setForm((current) => ({ ...current, emoji: event.target.value }))}
                placeholder="📚"
              />
            </label>
            <label>
              <span>Color</span>
              <input
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                placeholder="teal"
              />
            </label>
            <label>
              <span>Frequency</span>
              <select
                value={form.frequencyType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    frequencyType: event.target.value as CreateHabitInput["frequencyType"],
                  }))
                }
              >
                <option value="daily">Daily</option>
                <option value="weekly_days">Weekly days</option>
              </select>
            </label>
            {form.frequencyType === "weekly_days" ? (
              <label>
                <span>Target weekdays</span>
                <input
                  value={form.targetWeekdays}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, targetWeekdays: event.target.value }))
                  }
                  placeholder="1,3,5"
                />
              </label>
            ) : null}
            <button className="secondary-button" disabled={isSubmitting} type="submit">
              Add habit
            </button>
          </form>
        </div>
      </section>
      <div className="action-row">
        <button className="primary-button" disabled={isSubmitting} onClick={() => void finishOnboarding()} type="button">
          Start the dashboard
        </button>
      </div>
    </div>
  );
}

function DashboardScreen({
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
  const [settings, setSettings] = useState<{ timezone: string; defaultView: "today" | "month" } | null>(
    null,
  );
  const [notice, setNotice] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [form, setForm] = useState<CreateHabitInput>({
    name: "",
    emoji: "",
    color: "teal",
    frequencyType: "daily",
    targetWeekdays: "",
  });

  async function loadDashboardData() {
    setIsBusy(true);
    try {
      const [todayResponse, monthlyResponse, habitsResponse, settingsResponse] = await Promise.all([
        apiFetch<TodayDashboard>("/dashboard/today"),
        apiFetch<MonthlyDashboard>(`/dashboard/monthly?month=${deferredMonth}`),
        apiFetch<HabitsResponse>("/habits"),
        apiFetch<SettingsResponse>("/settings"),
      ]);

      setToday(todayResponse);
      setMonthly(monthlyResponse);
      setHabits(habitsResponse.habits);
      setSettings(settingsResponse.settings);
    } finally {
      setIsBusy(false);
    }
  }

  useEffect(() => {
    void loadDashboardData();
  }, [deferredMonth]);

  const monthDates = (() => {
    const range = getMonthRange(deferredMonth);
    return enumerateDates(range.startDate, range.endDate);
  })();

  async function reloadAll(message?: string) {
    await Promise.all([loadDashboardData(), onUserReload()]);
    if (message) {
      setNotice(message);
    }
  }

  async function toggleHabit(habitId: string, status: boolean) {
    if (!today) {
      return;
    }

    await apiFetch(`/habits/${habitId}/logs/${today.date}`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    await loadDashboardData();
  }

  async function createNewHabit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await apiFetch("/habits", {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        emoji: form.emoji || null,
        color: form.color || null,
        frequencyType: form.frequencyType,
        targetWeekdays: form.frequencyType === "weekly_days" ? toWeekdaysInput(form.targetWeekdays) : null,
      }),
    });

    setForm({
      name: "",
      emoji: "",
      color: "teal",
      frequencyType: "daily",
      targetWeekdays: "",
    });
    await reloadAll("Habit created.");
  }

  async function archiveHabit(habitId: string) {
    await apiFetch(`/habits/${habitId}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    });
    await reloadAll("Habit archived.");
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

    await apiFetch("/habits/reorder", {
      method: "POST",
      body: JSON.stringify({
        habitIds: ordered.map((habit) => habit.id),
      }),
    });

    await reloadAll("Habit order updated.");
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!settings) {
      return;
    }

    await apiFetch("/settings", {
      method: "PATCH",
      body: JSON.stringify(settings),
    });
    await reloadAll("Settings updated.");
  }

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
    await onLogout();
  }

  return (
    <div className="page-shell">
      <section className="hero-card hero-card--compact">
        <div>
          <p className="eyebrow">Signed in as {user.displayName}</p>
          <h1>Daily Leveling</h1>
          <p className="lede">
            Mobile stays anchored on today. Desktop stays anchored on the month.
          </p>
        </div>
        <div className="toolbar">
          <button
            className={view === "today" ? "pill pill--active" : "pill"}
            onClick={() => setView("today")}
            type="button"
          >
            Today
          </button>
          <button
            className={view === "month" ? "pill pill--active" : "pill"}
            onClick={() => setView("month")}
            type="button"
          >
            Month
          </button>
          <button className="pill" onClick={() => void handleLogout()} type="button">
            Logout
          </button>
        </div>
      </section>

      {notice ? <p className="status-text">{notice}</p> : null}

      <section className="panel-grid panel-grid--dashboard">
        <div className="panel panel--wide">
          {view === "today" ? (
            <div className="stack-space">
              <header className="section-header">
                <h2>Today view</h2>
                {today ? (
                  <span>
                    {today.summary.completedCount}/{today.summary.targetCount} complete
                  </span>
                ) : null}
              </header>
              {today ? (
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
                          <p>{habit.isTargetDay ? "Target day" : "Off day"}</p>
                        </div>
                        <button
                          className={habit.status ? "toggle-button toggle-button--done" : "toggle-button"}
                          disabled={!habit.isTargetDay || isBusy}
                          onClick={() => void toggleHabit(habit.habitId, !habit.status)}
                          type="button"
                        >
                          {habit.status ? "Done" : "Mark"}
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p>Loading today view.</p>
              )}
            </div>
          ) : (
            <div className="stack-space">
              <header className="section-header">
                <h2>Month view</h2>
                <div className="toolbar">
                  <button
                    className="pill"
                    onClick={() => {
                      startTransition(() => setSelectedMonth((current) => shiftMonth(current, -1)));
                    }}
                    type="button"
                  >
                    Prev
                  </button>
                  <span className="month-chip">{deferredMonth}</span>
                  <button
                    className="pill"
                    onClick={() => {
                      startTransition(() => setSelectedMonth((current) => shiftMonth(current, 1)));
                    }}
                    type="button"
                  >
                    Next
                  </button>
                </div>
              </header>
              {monthly ? (
                <>
                  <div className="summary-grid">
                    <article>
                      <strong>{monthly.summary.progressRate}%</strong>
                      <span>Monthly progress</span>
                    </article>
                    <article>
                      <strong>{monthly.summary.currentStreak}</strong>
                      <span>Current streak</span>
                    </article>
                    <article>
                      <strong>{monthly.summary.completedCount}</strong>
                      <span>Completed slots</span>
                    </article>
                  </div>
                  <div className="monthly-grid">
                    <div className="monthly-grid__header monthly-grid__corner">Habit</div>
                    {monthDates.map((date) => (
                      <div className="monthly-grid__header" key={date}>
                        {date.slice(-2)}
                      </div>
                    ))}
                    {monthly.habits.map((habit) => {
                      const logLookup = new Map(monthly.logs.map((log) => [`${log.habitId}:${log.date}`, log.status]));

                      return (
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
                      );
                    })}
                  </div>
                  <div className="stats-columns">
                    <div>
                      <h3>Daily stats</h3>
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
                      <h3>Habit stats</h3>
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
              ) : (
                <p>Loading month view.</p>
              )}
            </div>
          )}
        </div>

        <aside className="side-stack">
          <section className="panel">
            <h2>New habit</h2>
            <form className="stack-form" onSubmit={createNewHabit}>
              <label>
                <span>Name</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                <span>Emoji</span>
                <input
                  value={form.emoji}
                  onChange={(event) => setForm((current) => ({ ...current, emoji: event.target.value }))}
                />
              </label>
              <label>
                <span>Color</span>
                <input
                  value={form.color}
                  onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                />
              </label>
              <label>
                <span>Frequency</span>
                <select
                  value={form.frequencyType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      frequencyType: event.target.value as CreateHabitInput["frequencyType"],
                    }))
                  }
                >
                  <option value="daily">Daily</option>
                  <option value="weekly_days">Weekly days</option>
                </select>
              </label>
              {form.frequencyType === "weekly_days" ? (
                <label>
                  <span>Weekdays</span>
                  <input
                    value={form.targetWeekdays}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, targetWeekdays: event.target.value }))
                    }
                    placeholder="1,3,5"
                  />
                </label>
              ) : null}
              <button className="secondary-button" type="submit">
                Create
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>Habit list</h2>
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
                      <p>{habit.isActive ? "Active" : "Archived"}</p>
                    </div>
                    <div className="toolbar">
                      <button className="pill" onClick={() => void moveHabit(habit.id, -1)} type="button">
                        ↑
                      </button>
                      <button className="pill" onClick={() => void moveHabit(habit.id, 1)} type="button">
                        ↓
                      </button>
                      {habit.isActive ? (
                        <button className="pill" onClick={() => void archiveHabit(habit.id)} type="button">
                          Archive
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
            </div>
          </section>

          <section className="panel">
            <h2>Settings</h2>
            {settings ? (
              <form className="stack-form" onSubmit={saveSettings}>
                <label>
                  <span>Timezone</span>
                  <input
                    value={settings.timezone}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              timezone: event.target.value,
                            }
                          : current,
                      )
                    }
                  />
                </label>
                <label>
                  <span>Default view</span>
                  <select
                    value={settings.defaultView}
                    onChange={(event) =>
                      setSettings((current) =>
                        current
                          ? {
                              ...current,
                              defaultView: event.target.value as "today" | "month",
                            }
                          : current,
                      )
                    }
                  >
                    <option value="today">Today</option>
                    <option value="month">Month</option>
                  </select>
                </label>
                <button className="secondary-button" type="submit">
                  Save settings
                </button>
              </form>
            ) : (
              <p>Loading settings.</p>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}

export function App() {
  const [screen, setScreen] = useState<ScreenState>({ kind: "loading" });
  const [fatalError, setFatalError] = useState<string | null>(null);

  async function refreshUser() {
    try {
      const user = await loadCurrentUser();
      if (!user) {
        setScreen({ kind: "guest" });
        return;
      }

      setScreen({ kind: "ready", user });
      setFatalError(null);
    } catch (error) {
      setFatalError(error instanceof Error ? error.message : "Failed to load user.");
    }
  }

  useEffect(() => {
    void refreshUser();
  }, []);

  if (fatalError) {
    return (
      <div className="page-shell">
        <section className="hero-card">
          <p className="eyebrow">Fatal error</p>
          <h1>Unable to load the app.</h1>
          <p className="lede">{fatalError}</p>
          <button className="primary-button" onClick={() => void refreshUser()} type="button">
            Retry
          </button>
        </section>
      </div>
    );
  }

  if (screen.kind === "loading") {
    return <LoadingShell />;
  }

  if (screen.kind === "guest") {
    return <LoginScreen />;
  }

  if (!screen.user.onboardingCompleted) {
    return <OnboardingScreen onComplete={refreshUser} />;
  }

  return (
    <DashboardScreen
      onLogout={refreshUser}
      onUserReload={refreshUser}
      user={screen.user}
    />
  );
}
