import { AppError } from "./errors";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SKIPPED_PATH_PREFIXES = ["/__e2e/"];

function getExpectedOrigin(baseUrl: string): string {
  return new URL(baseUrl).origin;
}

function isSkippedPath(pathname: string): boolean {
  return SKIPPED_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function getSourceOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (origin) {
    return new URL(origin).origin;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    return new URL(referer).origin;
  }

  return null;
}

export function assertTrustedOrigin(request: Request, baseUrl: string): void {
  if (SAFE_METHODS.has(request.method.toUpperCase())) {
    return;
  }

  const requestUrl = new URL(request.url);
  if (isSkippedPath(requestUrl.pathname)) {
    return;
  }

  const sourceOrigin = getSourceOrigin(request);
  if (!sourceOrigin || sourceOrigin !== getExpectedOrigin(baseUrl)) {
    throw new AppError(403, "FORBIDDEN", "不正なリクエスト元です。");
  }
}

export function applySecurityHeaders(response: Response): Response {
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; img-src 'self' https: data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'",
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  return response;
}
