import {
  Fragment,
  FormEvent,
  startTransition,
  useDeferredValue,
  useEffect,
  useState,
} from "react";
import { templateLabels, templates } from "../domain/templates";
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
        <h1>習慣ボードを読み込んでいます。</h1>
        <p>認証状態とダッシュボードを確認中です。</p>
      </div>
    </div>
  );
}

function LoginScreen() {
  return (
    <div className="page-shell">
      <section className="hero-card">
        <p className="eyebrow">習慣トラッカー MVP</p>
        <h1>Daily Leveling</h1>
        <p className="lede">
          毎日の記録を素早く続けられる、月間グリッド中心の習慣トラッカーです。
        </p>
        <a className="primary-button" href="/auth/google/start">
          Google でログイン
        </a>
      </section>
      <section className="feature-ribbon">
        <article>
          <strong>モバイルは今日中心</strong>
          <span>ワンタップで記録し、進捗をすぐ確認できます。</span>
        </article>
        <article>
          <strong>デスクトップは月間中心</strong>
          <span>月全体をグリッドで俯瞰できます。</span>
        </article>
        <article>
          <strong>再開しやすい設計</strong>
          <span>抜けた日があっても、すぐに戻って続けられます。</span>
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
      setMessage(`テンプレート「${templateLabels[templateId as keyof typeof templateLabels] ?? templateId}」を適用しました。`);
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
      setMessage("習慣を追加しました。");
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
        <p className="eyebrow">初回ログイン</p>
        <h1>まずは小さく始めましょう。</h1>
        <p className="lede">
          テンプレートを適用するか、自分の習慣を追加してダッシュボードに進みます。
        </p>
        {message ? <p className="status-text">{message}</p> : null}
      </section>
      <section className="panel-grid">
        <div className="panel">
          <h2>テンプレート</h2>
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
                <strong>{templateLabels[templateId as keyof typeof templateLabels] ?? templateId}</strong>
                <span>{habits.map((habit) => habit.name).join(" / ")}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="panel">
          <h2>手動で追加</h2>
          <form className="stack-form" onSubmit={addHabit}>
            <label>
              <span>名前</span>
              <input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="読書"
                required
              />
            </label>
            <label>
              <span>絵文字</span>
              <input
                value={form.emoji}
                onChange={(event) => setForm((current) => ({ ...current, emoji: event.target.value }))}
                placeholder="📚"
              />
            </label>
            <label>
              <span>色</span>
              <input
                value={form.color}
                onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                placeholder="teal または #0f766e"
              />
            </label>
            <label>
              <span>頻度</span>
              <select
                value={form.frequencyType}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    frequencyType: event.target.value as CreateHabitInput["frequencyType"],
                  }))
                }
              >
                <option value="daily">毎日</option>
                <option value="weekly_days">曜日指定</option>
              </select>
            </label>
            {form.frequencyType === "weekly_days" ? (
              <label>
                <span>対象曜日</span>
                <input
                  value={form.targetWeekdays}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, targetWeekdays: event.target.value }))
                  }
                  placeholder="1,3,5  （月・水・金）"
                />
              </label>
            ) : null}
            <button className="secondary-button" disabled={isSubmitting} type="submit">
              習慣を追加
            </button>
          </form>
        </div>
      </section>
      <div className="action-row">
        <button className="primary-button" disabled={isSubmitting} onClick={() => void finishOnboarding()} type="button">
          ダッシュボードを始める
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
    await reloadAll("習慣を作成しました。");
  }

  async function archiveHabit(habitId: string) {
    await apiFetch(`/habits/${habitId}`, {
      method: "PATCH",
      body: JSON.stringify({ isActive: false }),
    });
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

    await apiFetch("/habits/reorder", {
      method: "POST",
      body: JSON.stringify({
        habitIds: ordered.map((habit) => habit.id),
      }),
    });

    await reloadAll("習慣の並び順を更新しました。");
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
    await reloadAll("設定を更新しました。");
  }

  async function handleLogout() {
    await apiFetch("/auth/logout", { method: "POST" });
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
                          <p>{habit.isTargetDay ? "対象日" : "休みの日"}</p>
                        </div>
                        <button
                          className={habit.status ? "toggle-button toggle-button--done" : "toggle-button"}
                          disabled={!habit.isTargetDay || isBusy}
                          onClick={() => void toggleHabit(habit.habitId, !habit.status)}
                          type="button"
                        >
                          {habit.status ? "達成" : "記録する"}
                        </button>
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <p>今日の記録を読み込んでいます。</p>
              )}
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
              {monthly ? (
                <>
                  <div className="summary-grid">
                    <article>
                      <strong>{monthly.summary.progressRate}%</strong>
                      <span>月間達成率</span>
                    </article>
                    <article>
                      <strong>{monthly.summary.currentStreak}</strong>
                      <span>現在の連続達成日数</span>
                    </article>
                    <article>
                      <strong>{monthly.summary.completedCount}</strong>
                      <span>達成数</span>
                    </article>
                  </div>
                  <div className="monthly-grid">
                    <div className="monthly-grid__header monthly-grid__corner">習慣</div>
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
              ) : (
                <p>月間ビューを読み込んでいます。</p>
              )}
            </div>
          )}
        </div>

        <aside className="side-stack">
          <section className="panel">
            <h2>新しい習慣</h2>
            <form className="stack-form" onSubmit={createNewHabit}>
              <label>
                <span>名前</span>
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                />
              </label>
              <label>
                <span>絵文字</span>
                <input
                  value={form.emoji}
                  onChange={(event) => setForm((current) => ({ ...current, emoji: event.target.value }))}
                />
              </label>
              <label>
                <span>色</span>
                <input
                  value={form.color}
                  onChange={(event) => setForm((current) => ({ ...current, color: event.target.value }))}
                />
              </label>
              <label>
                <span>頻度</span>
                <select
                  value={form.frequencyType}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      frequencyType: event.target.value as CreateHabitInput["frequencyType"],
                    }))
                  }
                >
                  <option value="daily">毎日</option>
                  <option value="weekly_days">曜日指定</option>
                </select>
              </label>
              {form.frequencyType === "weekly_days" ? (
                <label>
                  <span>対象曜日</span>
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
                作成
              </button>
            </form>
          </section>

          <section className="panel">
            <h2>習慣一覧</h2>
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
                      <p>{habit.isActive ? "有効" : "アーカイブ済み"}</p>
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
                          アーカイブ
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
            </div>
          </section>

          <section className="panel">
            <h2>設定</h2>
            {settings ? (
              <form className="stack-form" onSubmit={saveSettings}>
                <label>
                  <span>タイムゾーン</span>
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
                  <span>初期表示</span>
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
                    <option value="today">今日</option>
                    <option value="month">月間</option>
                  </select>
                </label>
                <button className="secondary-button" type="submit">
                  設定を保存
                </button>
              </form>
            ) : (
              <p>設定を読み込んでいます。</p>
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
      setFatalError(error instanceof Error ? error.message : "ユーザー情報の読み込みに失敗しました。");
    }
  }

  useEffect(() => {
    void refreshUser();
  }, []);

  if (fatalError) {
    return (
      <div className="page-shell">
        <section className="hero-card">
          <p className="eyebrow">エラー</p>
          <h1>アプリを読み込めませんでした。</h1>
          <p className="lede">{fatalError}</p>
          <button className="primary-button" onClick={() => void refreshUser()} type="button">
            再試行
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
