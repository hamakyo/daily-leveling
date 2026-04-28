export function getClientIp(request: Request): string {
  const cfConnectingIp = request.headers.get("CF-Connecting-IP")?.trim();
  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  const forwardedFor = request.headers.get("X-Forwarded-For");
  if (forwardedFor) {
    const firstIp = forwardedFor
      .split(",")
      .map((value) => value.trim())
      .find((value) => value.length > 0);

    if (firstIp) {
      return firstIp;
    }
  }

  return "unknown";
}

export function getRequestId(request: Request): string {
  const cfRay = request.headers.get("CF-Ray")?.trim();
  if (cfRay) {
    return cfRay;
  }

  const requestId = request.headers.get("X-Request-Id")?.trim();
  if (requestId) {
    return requestId;
  }

  return "unknown";
}
