import { describe, expect, it } from "vitest";
import {
  buildIntervalSchedulePreview,
  createEmptyHabitForm,
  normalizeWeekdays,
  toHabitPayload,
} from "../src/web/utils/habitForm";

describe("habit form helpers", () => {
  it("creates an empty form without color input state", () => {
    expect(createEmptyHabitForm()).toEqual({
      name: "",
      frequencyType: "daily",
      targetWeekdays: [],
      intervalDays: "3",
    });
  });

  it("normalizes weekdays into unique ascending values", () => {
    expect(normalizeWeekdays([5, 1, 3, 3, 9, 0])).toEqual([1, 3, 5]);
  });

  it("builds a weekly habit payload with null color", () => {
    expect(
      toHabitPayload({
        name: "  読書  ",
        frequencyType: "weekly_days",
        targetWeekdays: [5, 1, 3, 3],
        intervalDays: "3",
      }),
    ).toEqual({
      name: "読書",
      emoji: null,
      color: null,
      frequencyType: "weekly_days",
      targetWeekdays: [1, 3, 5],
      intervalDays: null,
    });
  });

  it("omits weekdays for daily habits", () => {
    expect(
      toHabitPayload({
        name: "筋トレ",
        frequencyType: "daily",
        targetWeekdays: [1, 3, 5],
        intervalDays: "4",
      }),
    ).toEqual({
      name: "筋トレ",
      emoji: null,
      color: null,
      frequencyType: "daily",
      targetWeekdays: null,
      intervalDays: null,
    });
  });

  it("builds an every_n_days payload with parsed interval days", () => {
    expect(
      toHabitPayload({
        name: "洗濯",
        frequencyType: "every_n_days",
        targetWeekdays: [1, 3, 5],
        intervalDays: "3",
      }),
    ).toEqual({
      name: "洗濯",
      emoji: null,
      color: null,
      frequencyType: "every_n_days",
      targetWeekdays: null,
      intervalDays: 3,
    });
  });

  it("builds a human-readable interval preview", () => {
    expect(
      buildIntervalSchedulePreview("3", {
        baseDate: new Date("2026-04-27T00:00:00.000Z"),
        timeZone: "UTC",
      }),
    ).toEqual({
      intervalDays: 3,
      description: "作成すると、今日を起点に 3 日間隔で対象日になります。",
      targetDateLabels: ["今日", "4/30(木)", "5/3(日)", "5/6(水)"],
    });
  });
});
