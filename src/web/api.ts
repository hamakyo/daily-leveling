import type { CurrentUser, HabitRecord, MonthlyDashboard, TodayDashboard } from "../lib/types";
import type { DashboardData, HabitPayload, UserSettings } from "./types";

export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export async function apiFetch<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = response.statusText;
    let code = "INTERNAL_ERROR";

    try {
      const payload = (await response.json()) as {
        error?: {
          code?: string;
          message?: string;
        };
      };
      code = payload.error?.code || code;
      message = payload.error?.message || message;
    } catch {
      // Ignore JSON parse failures and keep the transport error.
    }

    throw new ApiError(response.status, code, message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

type AuthResponse = { user: CurrentUser };
type HabitsResponse = { habits: HabitRecord[] };
type SettingsResponse = { settings: UserSettings };

export async function loadCurrentUser(): Promise<CurrentUser | null> {
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

export async function applyOnboardingTemplate(templateId: string): Promise<void> {
  await apiFetch("/onboarding/templates/apply", {
    method: "POST",
    body: JSON.stringify({ templateId }),
  });
}

export async function completeOnboarding(): Promise<void> {
  await apiFetch("/onboarding/complete", {
    method: "POST",
    body: JSON.stringify({ completed: true }),
  });
}

export async function createHabit(payload: HabitPayload): Promise<void> {
  await apiFetch("/habits", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateHabit(habitId: string, payload: HabitPayload): Promise<void> {
  await apiFetch(`/habits/${habitId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function loadDashboardData(month: string, date: string): Promise<DashboardData> {
  const params = new URLSearchParams({
    month,
    date,
  });
  return apiFetch<DashboardData>(`/dashboard/bootstrap?${params.toString()}`);
}

export async function toggleHabitLog(habitId: string, date: string, status: boolean): Promise<void> {
  await apiFetch(`/habits/${habitId}/logs/${date}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function deleteHabit(habitId: string): Promise<void> {
  await apiFetch(`/habits/${habitId}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive: false }),
  });
}

export async function reorderHabits(habitIds: string[]): Promise<void> {
  await apiFetch("/habits/reorder", {
    method: "POST",
    body: JSON.stringify({ habitIds }),
  });
}

export async function saveSettings(settings: UserSettings): Promise<void> {
  await apiFetch("/settings", {
    method: "PATCH",
    body: JSON.stringify(settings),
  });
}

export async function logout(): Promise<void> {
  await apiFetch("/auth/logout", { method: "POST" });
}
