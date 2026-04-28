import { describe, expect, it } from "vitest";
import { buildTimezoneOptions } from "../src/web/utils/timezones";

describe("timezone options", () => {
  it("includes common timezones for the settings dropdown", () => {
    const options = buildTimezoneOptions();

    expect(options).toContain("UTC");
    expect(options).toContain("Asia/Tokyo");
    expect(options).toContain("America/New_York");
  });

  it("preserves the current timezone even if it is not in the supported list", () => {
    const options = buildTimezoneOptions("Etc/GMT+9");

    expect(options).toContain("Etc/GMT+9");
  });
});
