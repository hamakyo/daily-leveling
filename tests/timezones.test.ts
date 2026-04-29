import { describe, expect, it } from "vitest";
import {
  buildTimezoneOptionGroups,
  buildTimezoneOptions,
  formatTimezoneLabel,
  resolveBrowserTimezone,
} from "../src/web/utils/timezones";

describe("timezone options", () => {
  it("includes common timezones for the settings dropdown", () => {
    const options = buildTimezoneOptions();

    expect(options).toContainEqual({
      value: "UTC",
      label: "UTC (協定世界時)",
    });
    expect(options).toContainEqual({
      value: "Asia/Tokyo",
      label: "日本 - 東京",
    });
    expect(options).toContainEqual({
      value: "America/New_York",
      label: "アメリカ東部 - ニューヨーク",
    });
  });

  it("preserves the current timezone even if it is not in the supported list", () => {
    const options = buildTimezoneOptions("Etc/GMT+9");

    expect(options).toContainEqual({
      value: "Etc/GMT+9",
      label: "GMT+9 (Etc/GMT+9)",
    });
  });

  it("formats unknown timezones into a readable fallback label", () => {
    expect(formatTimezoneLabel("America/Indiana/Indianapolis")).toBe(
      "Indianapolis (America/Indiana/Indianapolis)",
    );
  });

  it("splits timezone options into featured and other groups", () => {
    const groups = buildTimezoneOptionGroups("Etc/GMT+9");

    expect(groups[0]?.label).toBe("よく使うタイムゾーン");
    expect(groups[0]?.options).toContainEqual({
      value: "Asia/Tokyo",
      label: "日本 - 東京",
    });
    expect(groups[1]?.label).toBe("その他のタイムゾーン");
    expect(groups[1]?.options).toContainEqual({
      value: "Etc/GMT+9",
      label: "GMT+9 (Etc/GMT+9)",
    });
  });

  it("resolves a browser timezone when Intl exposes one", () => {
    expect(resolveBrowserTimezone()).toBeTypeOf("string");
  });
});
