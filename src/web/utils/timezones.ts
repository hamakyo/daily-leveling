const PRIORITY_TIMEZONES = [
  "UTC",
  "Asia/Tokyo",
  "Asia/Seoul",
  "Asia/Shanghai",
  "Asia/Singapore",
  "Asia/Bangkok",
  "Australia/Sydney",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Toronto",
];

const FALLBACK_TIMEZONES = [
  ...PRIORITY_TIMEZONES,
  "Asia/Hong_Kong",
  "Asia/Jakarta",
  "Asia/Kolkata",
  "Pacific/Auckland",
  "Europe/Berlin",
];

const TIMEZONE_LABEL_OVERRIDES: Record<string, string> = {
  UTC: "UTC (協定世界時)",
  "Asia/Tokyo": "日本 - 東京",
  "Asia/Seoul": "韓国 - ソウル",
  "Asia/Shanghai": "中国 - 上海",
  "Asia/Singapore": "シンガポール",
  "Asia/Bangkok": "タイ - バンコク",
  "Asia/Hong_Kong": "香港",
  "Asia/Jakarta": "インドネシア - ジャカルタ",
  "Asia/Kolkata": "インド - コルカタ",
  "Australia/Sydney": "オーストラリア - シドニー",
  "Pacific/Auckland": "ニュージーランド - オークランド",
  "Europe/London": "イギリス - ロンドン",
  "Europe/Paris": "フランス - パリ",
  "Europe/Berlin": "ドイツ - ベルリン",
  "America/New_York": "アメリカ東部 - ニューヨーク",
  "America/Chicago": "アメリカ中部 - シカゴ",
  "America/Denver": "アメリカ山岳部 - デンバー",
  "America/Los_Angeles": "アメリカ西部 - ロサンゼルス",
  "America/Toronto": "カナダ - トロント",
};

export type TimezoneOption = {
  value: string;
  label: string;
};

export type TimezoneOptionGroup = {
  label: string;
  options: TimezoneOption[];
};

export function resolveBrowserTimezone(): string | null {
  try {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof timeZone === "string" && timeZone.trim().length > 0 ? timeZone : null;
  } catch {
    return null;
  }
}

function getSupportedTimezones(): string[] {
  if (typeof Intl.supportedValuesOf === "function") {
    const values = Intl.supportedValuesOf("timeZone");
    return values.filter((value) => value !== "UTC");
  }

  return FALLBACK_TIMEZONES.filter((value) => value !== "UTC");
}

const supportedTimezones = getSupportedTimezones();

function sortTimezones(timezones: string[]) {
  return [...timezones].sort((left, right) => left.localeCompare(right));
}

function titleizeTimezonePart(value: string) {
  return value
    .split("_")
    .join(" ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function formatTimezoneLabel(timezone: string): string {
  const override = TIMEZONE_LABEL_OVERRIDES[timezone];
  if (override) {
    return override;
  }

  const parts = timezone.split("/");
  const city = parts.at(-1);
  if (!city) {
    return timezone;
  }

  return `${titleizeTimezonePart(city)} (${timezone})`;
}

export function buildTimezoneOptions(currentTimezone?: string): TimezoneOption[] {
  const unique = new Set<string>();

  for (const timezone of PRIORITY_TIMEZONES) {
    unique.add(timezone);
  }

  for (const timezone of sortTimezones(supportedTimezones)) {
    unique.add(timezone);
  }

  if (currentTimezone && currentTimezone.trim().length > 0) {
    unique.add(currentTimezone);
  }

  return Array.from(unique).map((timezone) => ({
    value: timezone,
    label: formatTimezoneLabel(timezone),
  }));
}

export function buildTimezoneOptionGroups(currentTimezone?: string): TimezoneOptionGroup[] {
  const options = buildTimezoneOptions(currentTimezone);
  const prioritySet = new Set(PRIORITY_TIMEZONES);
  const featured = options.filter((option) => prioritySet.has(option.value));
  const others = options.filter((option) => !prioritySet.has(option.value));

  const groups: TimezoneOptionGroup[] = [];
  if (featured.length > 0) {
    groups.push({
      label: "よく使うタイムゾーン",
      options: featured,
    });
  }

  if (others.length > 0) {
    groups.push({
      label: "その他のタイムゾーン",
      options: others,
    });
  }

  return groups;
}
