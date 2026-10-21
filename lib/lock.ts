/**
 * scheduled: voting closes automatically at lockAt (if set).
 * open:      always open, even after lockAt (admin reopened).
 * closed:    always closed.
 */
export const LOCK_MODES = ["scheduled", "open", "closed"] as const;
export type LockMode = (typeof LOCK_MODES)[number];

export type LockState = { mode: LockMode; lockAt: string | null };

export function isLockMode(value: unknown): value is LockMode {
  return typeof value === "string" && (LOCK_MODES as readonly string[]).includes(value);
}

/** Locked from the exact lockAt instant onwards. */
export function isLocked(state: LockState, now: Date = new Date()) {
  if (state.mode === "closed") return true;
  if (state.mode === "open") return false;
  if (!state.lockAt) return false;
  const at = Date.parse(state.lockAt);
  return Number.isFinite(at) && now.getTime() >= at;
}

/** e.g. "27.10.2026, 22:00" in Israel time. */
export function formatLockAt(lockAt: string) {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(lockAt));
}
