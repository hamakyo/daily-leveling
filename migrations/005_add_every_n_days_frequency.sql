ALTER TABLE habits
  ADD COLUMN interval_days integer;

ALTER TABLE habits
  DROP CONSTRAINT chk_habits_frequency_type,
  DROP CONSTRAINT chk_habits_target_weekdays_required;

ALTER TABLE habits
  ADD CONSTRAINT chk_habits_frequency_type
    CHECK (frequency_type IN ('daily', 'weekly_days', 'every_n_days')),
  ADD CONSTRAINT chk_habits_interval_days_range
    CHECK (interval_days IS NULL OR interval_days BETWEEN 2 AND 365),
  ADD CONSTRAINT chk_habits_schedule_required
    CHECK (
      (frequency_type = 'daily' AND target_weekdays IS NULL AND interval_days IS NULL)
      OR
      (
        frequency_type = 'weekly_days'
        AND target_weekdays IS NOT NULL
        AND cardinality(target_weekdays) > 0
        AND interval_days IS NULL
      )
      OR
      (
        frequency_type = 'every_n_days'
        AND target_weekdays IS NULL
        AND interval_days IS NOT NULL
      )
    );
