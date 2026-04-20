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
      name: "水を飲む",
      emoji: "💧",
      color: "teal",
      frequencyType: "daily",
      targetWeekdays: null,
    },
    {
      name: "ストレッチ",
      emoji: "🧘",
      color: "amber",
      frequencyType: "daily",
      targetWeekdays: null,
    },
    {
      name: "運動する",
      emoji: "🏃",
      color: "rose",
      frequencyType: "weekly_days",
      targetWeekdays: [1, 3, 5],
    },
  ],
  focus_basic: [
    {
      name: "一日の計画を立てる",
      emoji: "🗺️",
      color: "blue",
      frequencyType: "daily",
      targetWeekdays: null,
    },
    {
      name: "20分読書する",
      emoji: "📚",
      color: "violet",
      frequencyType: "daily",
      targetWeekdays: null,
    },
    {
      name: "週次レビュー",
      emoji: "📝",
      color: "indigo",
      frequencyType: "weekly_days",
      targetWeekdays: [7],
    },
  ],
} satisfies Record<string, HabitTemplate[]>;

export const templateLabels = {
  health_basic: "健康の基本",
  focus_basic: "集中の基本",
} satisfies Record<keyof typeof templates, string>;

export type TemplateId = keyof typeof templates;

export function isTemplateId(value: string): value is TemplateId {
  return value in templates;
}
