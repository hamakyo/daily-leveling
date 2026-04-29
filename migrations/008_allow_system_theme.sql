ALTER TABLE user_settings
  DROP CONSTRAINT chk_user_settings_theme;

ALTER TABLE user_settings
  ADD CONSTRAINT chk_user_settings_theme
    CHECK (theme IN ('light', 'dark', 'system'));
