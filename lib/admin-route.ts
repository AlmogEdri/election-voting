import { isAdminRequest } from "./auth";
import type { AdminResult } from "./admin";
import { errorJson, json } from "./http";

export const UNAUTHORIZED = "סיסמת ניהול שגויה";

/** Wraps an admin POST handler: secret check, JSON parsing, uniform responses. */
export function adminPost(action: (body: unknown) => Promise<AdminResult<unknown>>) {
  return async (request: Request) => {
    if (!isAdminRequest(request)) return errorJson(UNAUTHORIZED, 401);
    const raw = await request.text();
    let body: unknown;
    try {
      body = raw ? JSON.parse(raw) : undefined;
    } catch {
      return errorJson("JSON לא תקין", 400);
    }
    const result = await action(body);
    if (!result.ok) return errorJson(result.error, result.status);
    return json({ ok: true });
  };
}

export function adminGet(load: () => Promise<unknown>) {
  return async (request: Request) => {
    if (!isAdminRequest(request)) return errorJson(UNAUTHORIZED, 401);
    return json(await load());
  };
}
