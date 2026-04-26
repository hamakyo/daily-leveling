CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION is_valid_weekday_array(weekday_values smallint[])
RETURNS boolean AS $$
DECLARE
  day_value smallint;
BEGIN
  IF weekday_values IS NULL THEN
    RETURN true;
  END IF;

  FOREACH day_value IN ARRAY weekday_values
  LOOP
    IF day_value < 1 OR day_value > 7 THEN
      RETURN false;
    END IF;
  END LOOP;

  RETURN true;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  google_sub text NOT NULL UNIQUE,
  email text NOT NULL,
  display_name text NOT NULL,
  avatar_url text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE user_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  timezone text NOT NULL DEFAULT 'Asia/Tokyo',
  default_view text NOT NULL DEFAULT 'today',
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_user_settings_default_view
    CHECK (default_view IN ('today', 'month'))
);

CREATE TRIGGER trg_user_settings_updated_at
BEFORE UPDATE ON user_settings
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  last_seen_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_sessions_expiry_valid
    CHECK (expires_at > created_at)
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);

CREATE TRIGGER trg_sessions_updated_at
BEFORE UPDATE ON sessions
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  emoji text,
  color text,
  frequency_type text NOT NULL,
  target_weekdays smallint[],
  is_active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_habits_frequency_type
    CHECK (frequency_type IN ('daily', 'weekly_days')),
  CONSTRAINT chk_habits_display_order
    CHECK (display_order >= 0),
  CONSTRAINT chk_habits_target_weekdays_required
    CHECK (
      (frequency_type = 'daily' AND target_weekdays IS NULL)
      OR
      (
        frequency_type = 'weekly_days'
        AND target_weekdays IS NOT NULL
        AND cardinality(target_weekdays) > 0
      )
    ),
  CONSTRAINT chk_habits_target_weekdays_range
    CHECK (is_valid_weekday_array(target_weekdays))
);

CREATE INDEX idx_habits_user_active_order
  ON habits(user_id, is_active, display_order);

CREATE TRIGGER trg_habits_updated_at
BEFORE UPDATE ON habits
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE TABLE habit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE RESTRICT,
  log_date date NOT NULL,
  status boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_habit_logs_user_habit_date
    UNIQUE (user_id, habit_id, log_date)
);

CREATE INDEX idx_habit_logs_user_date
  ON habit_logs(user_id, log_date);

CREATE INDEX idx_habit_logs_habit_date
  ON habit_logs(habit_id, log_date);

CREATE TRIGGER trg_habit_logs_updated_at
BEFORE UPDATE ON habit_logs
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION enforce_habit_log_user_match()
RETURNS trigger AS $$
DECLARE
  v_habit_user_id uuid;
BEGIN
  SELECT user_id INTO v_habit_user_id
  FROM habits
  WHERE id = NEW.habit_id;

  IF v_habit_user_id IS NULL THEN
    RAISE EXCEPTION 'Habit % does not exist', NEW.habit_id;
  END IF;

  IF v_habit_user_id <> NEW.user_id THEN
    RAISE EXCEPTION 'habit_logs.user_id (%) does not match habits.user_id (%) for habit_id %',
      NEW.user_id, v_habit_user_id, NEW.habit_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_habit_logs_user_match
BEFORE INSERT OR UPDATE ON habit_logs
FOR EACH ROW
EXECUTE FUNCTION enforce_habit_log_user_match();

CREATE OR REPLACE VIEW active_sessions AS
SELECT *
FROM sessions
WHERE revoked_at IS NULL
  AND expires_at > NOW();
