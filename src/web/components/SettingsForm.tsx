import type { FormEvent } from "react";
import type { UserSettings } from "../types";

export function SettingsForm({
  settings,
  onChange,
  onSubmit,
}: {
  settings: UserSettings | null;
  onChange: (settings: UserSettings) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!settings) {
    return <p>設定を読み込んでいます。</p>;
  }

  return (
    <form className="stack-form" onSubmit={onSubmit}>
      <label>
        <span>タイムゾーン</span>
        <input
          value={settings.timezone}
          onChange={(event) =>
            onChange({
              ...settings,
              timezone: event.target.value,
            })
          }
        />
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
          <option value="month">月間</option>
        </select>
      </label>
      <button className="secondary-button" type="submit">
        設定を保存
      </button>
    </form>
  );
}
