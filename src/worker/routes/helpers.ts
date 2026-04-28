import { z, type ZodSchema } from "zod";
import { isSecureCookie } from "../../lib/config";
import { getClientIp } from "../../lib/request";

export const pathUuidSchema = z.string().uuid("UUID の形式が不正です。");

export function getOAuthCookieOptions(env: Env) {
  return {
    httpOnly: true,
    path: "/auth/google",
    sameSite: "Lax" as const,
    secure: isSecureCookie(env.APP_BASE_URL),
    maxAge: 60 * 10,
  };
}

export function parseBody<T>(schema: ZodSchema<T>, body: unknown): T {
  return schema.parse(body);
}

export function getClientMetadata(request: Request) {
  return {
    ipAddress: getClientIp(request),
    userAgent: request.headers.get("user-agent"),
  };
}
