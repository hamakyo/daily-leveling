ALTER TABLE user_settings
  ADD COLUMN theme text NOT NULL DEFAULT 'light';

ALTER TABLE user_settings
  ADD CONSTRAINT chk_user_settings_theme
    CHECK (theme IN ('light', 'dark'));
