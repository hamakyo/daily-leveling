type SecurityEventDetails = Record<string, string | number | boolean | null | undefined>;

function normalizeDetails(details: SecurityEventDetails) {
  return Object.fromEntries(Object.entries(details).filter(([, value]) => value !== undefined));
}

export function logSecurityEvent(event: string, details: SecurityEventDetails) {
  console.warn(
    JSON.stringify({
      type: "security_event",
      event,
      timestamp: new Date().toISOString(),
      ...normalizeDetails(details),
    }),
  );
}
