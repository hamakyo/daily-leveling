ALTER TABLE user_settings
  DROP CONSTRAINT chk_user_settings_default_view;

ALTER TABLE user_settings
  ADD CONSTRAINT chk_user_settings_default_view
    CHECK (default_view IN ('today', 'week', 'month'));
