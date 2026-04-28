import { z } from "zod";

const frequencyTypeSchema = z.enum(["daily", "weekly_days", "every_n_days"]);

const uniqueWeekdays = (weekdays: number[]) => new Set(weekdays).size === weekdays.length;

const normalizedWeekdaySchema = z
  .array(z.number().int().min(1).max(7))
  .refine(uniqueWeekdays, "targetWeekdays に重複した曜日は指定できません。")
  .transform((weekdays) => [...weekdays].sort((left, right) => left - right));

const intervalDaysSchema = z.number().int().min(2).max(365);

export const habitCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    emoji: z.string().trim().min(1).max(16).nullable().optional(),
    color: z.string().trim().min(1).max(32).nullable().optional(),
    frequencyType: frequencyTypeSchema,
    targetWeekdays: normalizedWeekdaySchema.nullable().optional(),
    intervalDays: intervalDaysSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.frequencyType === "daily" && value.targetWeekdays) {
      ctx.addIssue({
        code: "custom",
        path: ["targetWeekdays"],
        message: "daily の習慣では targetWeekdays を指定できません。",
      });
    }

    if (value.frequencyType === "daily" && value.intervalDays != null) {
      ctx.addIssue({
        code: "custom",
        path: ["intervalDays"],
        message: "daily の習慣では intervalDays を指定できません。",
      });
    }

    if (value.frequencyType === "weekly_days" && (!value.targetWeekdays || value.targetWeekdays.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["targetWeekdays"],
        message: "weekly_days の習慣では targetWeekdays が必須です。",
      });
    }

    if (value.frequencyType === "weekly_days" && value.intervalDays != null) {
      ctx.addIssue({
        code: "custom",
        path: ["intervalDays"],
        message: "weekly_days の習慣では intervalDays を指定できません。",
      });
    }

    if (value.frequencyType === "every_n_days" && value.targetWeekdays) {
      ctx.addIssue({
        code: "custom",
        path: ["targetWeekdays"],
        message: "every_n_days の習慣では targetWeekdays を指定できません。",
      });
    }

    if (value.frequencyType === "every_n_days" && value.intervalDays == null) {
      ctx.addIssue({
        code: "custom",
        path: ["intervalDays"],
        message: "every_n_days の習慣では intervalDays が必須です。",
      });
    }
  });

export const habitUpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    emoji: z.string().trim().min(1).max(16).nullable().optional(),
    color: z.string().trim().min(1).max(32).nullable().optional(),
    frequencyType: frequencyTypeSchema.optional(),
    targetWeekdays: normalizedWeekdaySchema.nullable().optional(),
    intervalDays: intervalDaysSchema.nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "少なくとも1項目は指定してください。");

export const onboardingTemplateSchema = z.object({
  templateId: z.string().trim().min(1),
});

export const onboardingCompleteSchema = z.object({
  completed: z.literal(true),
});

export const reorderHabitsSchema = z.object({
  habitIds: z.array(z.string().uuid()).min(1).refine((ids) => new Set(ids).size === ids.length, {
    message: "habitIds に重複は指定できません。",
  }),
});

export const logBodySchema = z.object({
  status: z.boolean(),
});

export const settingsSchema = z.object({
  timezone: z.string().trim().min(1).optional(),
  defaultView: z.enum(["today", "week", "month"]).optional(),
});

export const logsRangeQuerySchema = z.object({
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
});

export const monthQuerySchema = z.object({
  month: z.string().trim().min(1),
});

export const weekQuerySchema = z.object({
  date: z.string().trim().min(1),
});

export const activeOnlyQuerySchema = z.object({
  activeOnly: z.enum(["true", "false"]).optional(),
});
