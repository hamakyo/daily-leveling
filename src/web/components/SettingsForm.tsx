import type { FormEvent } from "react";
import type { UserSettings } from "../types";
import { formatDefaultViewLabel } from "../utils/settings";
import { THEME_LABELS } from "../utils/theme";
import { buildTimezoneOptionGroups, formatTimezoneLabel, resolveBrowserTimezone } from "../utils/timezones";

export function SettingsForm({
  settings,
  onChange,
  onLogout,
  onReset,
  onSubmit,
  hasUnsavedChanges,
  isLoggingOut,
  isSaving,
  statusTone,
  statusMessage,
}: {
  settings: UserSettings | null;
  onChange: (settings: UserSettings) => void;
  onLogout?: () => void;
  onReset?: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  hasUnsavedChanges?: boolean;
  isLoggingOut?: boolean;
  isSaving?: boolean;
  statusTone?: "success" | "error" | null;
  statusMessage?: string | null;
}) {
  if (!settings) {
    return <p>設定を読み込んでいます。</p>;
  }

  const timezoneGroups = buildTimezoneOptionGroups(settings.timezone);
  const browserTimezone = resolveBrowserTimezone();
  const canApplyBrowserTimezone = Boolean(browserTimezone) && browserTimezone !== settings.timezone;
  const selectedTimezoneLabel = formatTimezoneLabel(settings.timezone);
  const browserTimezoneLabel = browserTimezone ? formatTimezoneLabel(browserTimezone) : null;

  return (
    <form className="stack-form" onSubmit={onSubmit}>
      <label>
        <span>タイムゾーン</span>
        <select
          value={settings.timezone}
          onChange={(event) =>
            onChange({
              ...settings,
              timezone: event.target.value,
            })
          }
        >
          {timezoneGroups.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((timezone) => (
                <option key={timezone.value} value={timezone.value}>
                  {timezone.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>
      {browserTimezone ? (
        <div className="toolbar settings-inline">
          <button
            className="pill"
            disabled={Boolean(isSaving) || !canApplyBrowserTimezone}
            onClick={() => {
              if (!browserTimezone) {
                return;
              }

              onChange({
                ...settings,
                timezone: browserTimezone,
              });
            }}
            type="button"
          >
            この端末のタイムゾーンを使う
          </button>
          <span className="status-text">{formatTimezoneLabel(browserTimezone)}</span>
        </div>
      ) : null}
      <section className="settings-preview" aria-label="設定プレビュー">
        <strong>この設定での表示</strong>
        <p className="status-text">表示テーマ: {THEME_LABELS[settings.theme]}</p>
        <p className="status-text">日付の区切り: {selectedTimezoneLabel}</p>
        <p className="status-text">ログイン後の初期表示: {formatDefaultViewLabel(settings.defaultView)}</p>
        {browserTimezoneLabel ? (
          <p className="status-text">
            端末のタイムゾーン: {browserTimezoneLabel}
            {canApplyBrowserTimezone ? " と異なります。" : " と同じです。"}
          </p>
        ) : null}
      </section>
      <label>
        <span>表示テーマ</span>
        <select
          value={settings.theme}
          onChange={(event) =>
            onChange({
              ...settings,
              theme: event.target.value as UserSettings["theme"],
            })
          }
        >
          <option value="light">{THEME_LABELS.light}</option>
          <option value="dark">{THEME_LABELS.dark}</option>
          <option value="system">{THEME_LABELS.system}</option>
        </select>
      </label>
      <label>
        <span>初期表示</span>
        <select
          value={settings.defaultView}
          onChange={(event) =>
            onChange({
              ...settings,
              defaultView: event.target.value as UserSettings["defaultView"],
            })
          }
        >
          <option value="today">今日</option>
          <option value="week">週間</option>
          <option value="month">月間</option>
        </select>
      </label>
      {!hasUnsavedChanges && !statusMessage ? <p className="status-text">変更はまだありません。</p> : null}
      {statusMessage ? (
        <p className={`status-text ${statusTone === "error" ? "status-text--error" : "status-text--success"}`}>
          {statusMessage}
        </p>
      ) : null}
      <div className="toolbar settings-actions">
        {hasUnsavedChanges ? (
          <button className="pill" disabled={Boolean(isSaving)} onClick={onReset} type="button">
            元に戻す
          </button>
        ) : null}
        <button
          className="secondary-button"
          disabled={Boolean(isSaving) || !hasUnsavedChanges}
          type="submit"
        >
          {isSaving ? "保存中..." : "設定を保存"}
        </button>
      </div>
      {onLogout ? (
        <section className="settings-account">
          <strong>アカウント</strong>
          <p className="status-text">この端末からログアウトします。</p>
          <button
            className="pill pill--danger settings-logout-button"
            disabled={Boolean(isLoggingOut)}
            onClick={onLogout}
            type="button"
          >
            {isLoggingOut ? "ログアウト中..." : "ログアウト"}
          </button>
        </section>
      ) : null}
    </form>
  );
}
