import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";

export const DEVICE_TOKEN_HEADER = "x-device-token";
export const ADMIN_SECRET_HEADER = "x-admin-secret";

/** 256 random bits, URL-safe. */
export function generateDeviceToken() {
  return randomBytes(32).toString("base64url");
}

/** Only the hash is stored, so a leaked database does not leak device tokens. */
export function hashDeviceToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function userFromRequest(request: Request) {
  const token = request.headers.get(DEVICE_TOKEN_HEADER)?.trim();
  if (!token || token.length > 200) return null;
  return prisma.user.findUnique({ where: { deviceToken: hashDeviceToken(token) } });
}

/** Constant-time check of x-admin-secret against ADMIN_SECRET. Unset secret = no admin access. */
export function isAdminRequest(request: Request) {
  const expected = process.env.ADMIN_SECRET;
  const given = request.headers.get(ADMIN_SECRET_HEADER);
  if (!expected || !given) return false;
  const a = createHash("sha256").update(expected).digest();
  const b = createHash("sha256").update(given).digest();
  return timingSafeEqual(a, b);
}
