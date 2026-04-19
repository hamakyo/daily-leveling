import { z } from "zod";

const frequencyTypeSchema = z.enum(["daily", "weekly_days"]);

const uniqueWeekdays = (weekdays: number[]) => new Set(weekdays).size === weekdays.length;

const normalizedWeekdaySchema = z
  .array(z.number().int().min(1).max(7))
  .refine(uniqueWeekdays, "targetWeekdays must be unique.")
  .transform((weekdays) => [...weekdays].sort((left, right) => left - right));

export const habitCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    emoji: z.string().trim().min(1).max(16).nullable().optional(),
    color: z.string().trim().min(1).max(32).nullable().optional(),
    frequencyType: frequencyTypeSchema,
    targetWeekdays: normalizedWeekdaySchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.frequencyType === "daily" && value.targetWeekdays) {
      ctx.addIssue({
        code: "custom",
        path: ["targetWeekdays"],
        message: "targetWeekdays must be empty for daily habits.",
      });
    }

    if (value.frequencyType === "weekly_days" && (!value.targetWeekdays || value.targetWeekdays.length === 0)) {
      ctx.addIssue({
        code: "custom",
        path: ["targetWeekdays"],
        message: "targetWeekdays is required for weekly_days habits.",
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
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const onboardingTemplateSchema = z.object({
  templateId: z.string().trim().min(1),
});

export const onboardingCompleteSchema = z.object({
  completed: z.literal(true),
});

export const reorderHabitsSchema = z.object({
  habitIds: z.array(z.string().uuid()).min(1).refine((ids) => new Set(ids).size === ids.length, {
    message: "habitIds must be unique.",
  }),
});

export const logBodySchema = z.object({
  status: z.boolean(),
});

export const settingsSchema = z.object({
  timezone: z.string().trim().min(1).optional(),
  defaultView: z.enum(["today", "month"]).optional(),
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
