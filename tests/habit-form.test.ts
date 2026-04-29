import { describe, expect, it } from "vitest";
import type { HabitRecord } from "../src/lib/types";
import {
  buildIntervalSchedulePreview,
  createHabitFormFromRecord,
  createEmptyHabitForm,
  hasHabitFormChanges,
  normalizeWeekdays,
  toHabitPayload,
  validateHabitForm,
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

  it("builds an edit form state from an existing habit", () => {
    expect(
      createHabitFormFromRecord({
        id: "habit-id",
        userId: "user-id",
        name: "洗濯",
        emoji: null,
        color: null,
        frequencyType: "every_n_days",
        targetWeekdays: null,
        intervalDays: 3,
        isActive: true,
        displayOrder: 0,
        createdAt: "2026-04-29T00:00:00.000Z",
        updatedAt: "2026-04-29T00:00:00.000Z",
      }),
    ).toEqual({
      name: "洗濯",
      frequencyType: "every_n_days",
      targetWeekdays: [],
      intervalDays: "3",
    });
  });

  it("validates missing weekdays and invalid intervals", () => {
    expect(
      validateHabitForm({
        name: "読書",
        frequencyType: "weekly_days",
        targetWeekdays: [],
        intervalDays: "3",
      }),
    ).toBe("1つ以上の曜日を選択してください。");

    expect(
      validateHabitForm({
        name: "洗濯",
        frequencyType: "every_n_days",
        targetWeekdays: [],
        intervalDays: "1",
      }),
    ).toBe("間隔日数は 2 から 365 の整数で指定してください。");
  });

  it("detects whether an edit form changed the habit", () => {
    const habit: HabitRecord = {
      id: "habit-id",
      userId: "user-id",
      name: "読書",
      emoji: null,
      color: null,
      frequencyType: "weekly_days",
      targetWeekdays: [1, 3, 5],
      intervalDays: null,
      isActive: true,
      displayOrder: 0,
      createdAt: "2026-04-29T00:00:00.000Z",
      updatedAt: "2026-04-29T00:00:00.000Z",
    };

    expect(
      hasHabitFormChanges(
        {
          name: "読書",
          frequencyType: "weekly_days",
          targetWeekdays: [1, 3, 5],
          intervalDays: "3",
        },
        habit,
      ),
    ).toBe(false);

    expect(
      hasHabitFormChanges(
        {
          name: "夜の読書",
          frequencyType: "weekly_days",
          targetWeekdays: [2, 4],
          intervalDays: "3",
        },
        habit,
      ),
    ).toBe(true);
  });
});
