import { describe, expect, it } from "vitest";
import { formatLockAt, isLocked } from "@/lib/lock";

const lockAt = "2026-10-27T20:00:00.000Z";

describe("lock", () => {
  it("scheduled: open until the exact instant, locked from it", () => {
    expect(isLocked({ mode: "scheduled", lockAt }, new Date("2026-10-27T19:59:59.999Z"))).toBe(false);
    expect(isLocked({ mode: "scheduled", lockAt }, new Date(lockAt))).toBe(true);
    expect(isLocked({ mode: "scheduled", lockAt }, new Date("2026-10-28T00:00:00Z"))).toBe(true);
  });

  it("scheduled without a date never locks", () => {
    expect(isLocked({ mode: "scheduled", lockAt: null }, new Date("2030-01-01"))).toBe(false);
  });

  it("open overrides a past deadline; closed overrides a future one", () => {
    expect(isLocked({ mode: "open", lockAt }, new Date("2026-11-01"))).toBe(false);
    expect(isLocked({ mode: "closed", lockAt }, new Date("2026-10-01"))).toBe(true);
  });

  it("formats the deadline in Israel time (22:00)", () => {
    expect(formatLockAt(lockAt)).toContain("22:00");
    expect(formatLockAt(lockAt)).toContain("27.10.2026");
  });
});
