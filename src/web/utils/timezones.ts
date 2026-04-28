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

export function buildTimezoneOptions(currentTimezone?: string): string[] {
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

  return Array.from(unique);
}
