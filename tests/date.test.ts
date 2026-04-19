import { describe, expect, it } from "vitest";
import {
  enumerateDates,
  getMonthRange,
  getWeekRange,
  getWeekdayFromIsoDate,
  isValidTimezone,
} from "../src/lib/date";

describe("date helpers", () => {
  it("returns monday-start week ranges", () => {
    const week = getWeekRange("2026-04-22");
    expect(week.startDate).toBe("2026-04-20");
    expect(week.endDate).toBe("2026-04-26");
  });

  it("lists all dates in a range", () => {
    expect(enumerateDates("2026-04-01", "2026-04-03")).toEqual([
      "2026-04-01",
      "2026-04-02",
      "2026-04-03",
    ]);
  });

  it("builds month boundaries", () => {
    expect(getMonthRange("2026-02")).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });

  it("uses 1=Mon to 7=Sun weekday numbering", () => {
    expect(getWeekdayFromIsoDate("2026-04-20")).toBe(1);
    expect(getWeekdayFromIsoDate("2026-04-26")).toBe(7);
  });

  it("validates IANA timezones", () => {
    expect(isValidTimezone("Asia/Tokyo")).toBe(true);
    expect(isValidTimezone("Mars/Base")).toBe(false);
  });
});
