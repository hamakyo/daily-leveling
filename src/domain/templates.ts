import type { FrequencyType } from "../lib/types";

export interface HabitTemplate {
  name: string;
  emoji: string | null;
  color: string | null;
  frequencyType: FrequencyType;
  targetWeekdays: number[] | null;
}

export const templates = {
  health_basic: [
    {
      name: "Drink water",
      emoji: "💧",
      color: "teal",
      frequencyType: "daily",
      targetWeekdays: null,
    },
    {
      name: "Stretch",
      emoji: "🧘",
      color: "amber",
      frequencyType: "daily",
      targetWeekdays: null,
    },
    {
      name: "Workout",
      emoji: "🏃",
      color: "rose",
      frequencyType: "weekly_days",
      targetWeekdays: [1, 3, 5],
    },
  ],
  focus_basic: [
    {
      name: "Plan the day",
      emoji: "🗺️",
      color: "blue",
      frequencyType: "daily",
      targetWeekdays: null,
    },
    {
      name: "Read for 20 min",
      emoji: "📚",
      color: "violet",
      frequencyType: "daily",
      targetWeekdays: null,
    },
    {
      name: "Weekly review",
      emoji: "📝",
      color: "indigo",
      frequencyType: "weekly_days",
      targetWeekdays: [7],
    },
  ],
} satisfies Record<string, HabitTemplate[]>;

export type TemplateId = keyof typeof templates;

export function isTemplateId(value: string): value is TemplateId {
  return value in templates;
}
