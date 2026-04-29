import type { UserSettings } from "../types";

const DEFAULT_VIEW_LABELS: Record<UserSettings["defaultView"], string> = {
  today: "今日",
  week: "週間",
  month: "月間",
};

export function areSettingsEqual(left: UserSettings | null, right: UserSettings | null): boolean {
  if (!left || !right) {
    return false;
  }

  return left.timezone === right.timezone && left.defaultView === right.defaultView;
}

export function reconcileSettingsAfterRefresh({
  currentSettings,
  refreshedSettings,
  savedSettings,
}: {
  currentSettings: UserSettings | null;
  refreshedSettings: UserSettings;
  savedSettings: UserSettings | null;
}): {
  nextSettings: UserSettings;
  nextSavedSettings: UserSettings;
} {
  if (!currentSettings || !savedSettings || areSettingsEqual(currentSettings, savedSettings)) {
    return {
      nextSettings: refreshedSettings,
      nextSavedSettings: refreshedSettings,
    };
  }

  return {
    nextSettings: currentSettings,
    nextSavedSettings: refreshedSettings,
  };
}

export function formatDefaultViewLabel(defaultView: UserSettings["defaultView"]): string {
  return DEFAULT_VIEW_LABELS[defaultView];
}
