import { describe, expect, it } from "vitest";
import { areSettingsEqual, formatDefaultViewLabel, reconcileSettingsAfterRefresh } from "../src/web/utils/settings";

describe("settings equality", () => {
  it("treats identical settings as unchanged", () => {
    expect(
      areSettingsEqual(
        { timezone: "Asia/Tokyo", defaultView: "today" },
        { timezone: "Asia/Tokyo", defaultView: "today" },
      ),
    ).toBe(true);
  });

  it("detects timezone changes", () => {
    expect(
      areSettingsEqual(
        { timezone: "Asia/Tokyo", defaultView: "today" },
        { timezone: "UTC", defaultView: "today" },
      ),
    ).toBe(false);
  });

  it("detects default view changes", () => {
    expect(
      areSettingsEqual(
        { timezone: "Asia/Tokyo", defaultView: "today" },
        { timezone: "Asia/Tokyo", defaultView: "week" },
      ),
    ).toBe(false);
  });
});

describe("settings refresh reconciliation", () => {
  it("applies refreshed settings when there are no local edits", () => {
    const refreshed = { timezone: "UTC", defaultView: "week" } as const;

    expect(
      reconcileSettingsAfterRefresh({
        currentSettings: { timezone: "Asia/Tokyo", defaultView: "today" },
        refreshedSettings: refreshed,
        savedSettings: { timezone: "Asia/Tokyo", defaultView: "today" },
      }),
    ).toEqual({
      nextSettings: refreshed,
      nextSavedSettings: refreshed,
    });
  });

  it("preserves unsaved local edits while updating the saved snapshot", () => {
    const current = { timezone: "America/New_York", defaultView: "week" } as const;
    const refreshed = { timezone: "Asia/Tokyo", defaultView: "today" } as const;

    expect(
      reconcileSettingsAfterRefresh({
        currentSettings: current,
        refreshedSettings: refreshed,
        savedSettings: { timezone: "UTC", defaultView: "today" },
      }),
    ).toEqual({
      nextSettings: current,
      nextSavedSettings: refreshed,
    });
  });

  it("uses refreshed settings on the initial load", () => {
    const refreshed = { timezone: "Asia/Tokyo", defaultView: "month" } as const;

    expect(
      reconcileSettingsAfterRefresh({
        currentSettings: null,
        refreshedSettings: refreshed,
        savedSettings: null,
      }),
    ).toEqual({
      nextSettings: refreshed,
      nextSavedSettings: refreshed,
    });
  });
});

describe("default view labels", () => {
  it("formats each default view for display", () => {
    expect(formatDefaultViewLabel("today")).toBe("今日");
    expect(formatDefaultViewLabel("week")).toBe("週間");
    expect(formatDefaultViewLabel("month")).toBe("月間");
  });
});
