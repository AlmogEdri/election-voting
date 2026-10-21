import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as statsRoute } from "@/app/api/stats/route";
import { computeStats, getCachedStats, STATS_TTL_MS } from "@/lib/stats";
import { saveVote } from "@/lib/votes";
import { SEED_SEATS } from "./fixtures/prd";
import { prisma, resetDb } from "./helpers/db";
import { registerUser } from "./helpers/api";

beforeEach(resetDb);
afterEach(() => vi.useRealTimers());

const NOW = new Date("2026-10-22T10:00:00Z");

describe("stats", () => {
  it("is zero-filled before the first vote", async () => {
    await registerUser("לא הצביע");
    const stats = await computeStats();
    expect(stats.participants).toBe(0);
    expect(stats.names).toEqual([]);
    expect(Object.values(stats.avgSeats)).toHaveLength(14);
    expect(Object.values(stats.avgSeats).every((n) => n === 0)).toBe(true);
    expect(Object.keys(stats.pmShare)).toHaveLength(9);
  });

  it("averages two ballots and ignores unsubmitted registrations", async () => {
    const a = await registerUser("אבי", "10.0.0.1");
    const b = await registerUser("בתיה", "10.0.0.2");
    await registerUser("גיל", "10.0.0.3");
    await saveVote(a.userId, { seats: SEED_SEATS, pmCandidateId: "netanyahu" }, NOW);
    await saveVote(b.userId, { seats: { ...SEED_SEATS, likud: 18, yashar: 22, amcha: 4 }, pmCandidateId: "eisenkot" }, NOW);

    const stats = await computeStats();
    expect(stats.participants).toBe(2);
    expect(stats.avgSeats.likud).toBe(20.5);
    expect(stats.avgSeats.yashar).toBe(21.5);
    expect(stats.avgSeats.amcha).toBe(2);
    expect(stats.avgSeats["blue-white"]).toBe(0);
    expect(stats.pmShare).toMatchObject({ netanyahu: 50, eisenkot: 50, bennett: 0, "new-elections": 0 });
    expect(stats.names).toEqual(["אבי", "בתיה"]);
    expect(JSON.stringify(stats)).not.toContain(a.deviceToken);
  });

  it("caches for ten seconds and is invalidated by a vote", async () => {
    const a = await registerUser("אבי", "10.0.0.1");
    const t0 = NOW.getTime();
    expect((await getCachedStats(t0)).participants).toBe(0);

    // A direct DB write bypasses invalidation: the cache still answers.
    const b = await registerUser("בתיה", "10.0.0.2");
    await prisma.vote.create({ data: { userId: b.userId, seats: JSON.stringify(SEED_SEATS), pmCandidateId: "bennett" } });
    expect((await getCachedStats(t0 + STATS_TTL_MS - 1)).participants).toBe(0);
    expect((await getCachedStats(t0 + STATS_TTL_MS)).participants).toBe(1);

    // Saving through saveVote invalidates immediately.
    await saveVote(a.userId, { seats: SEED_SEATS, pmCandidateId: "netanyahu" }, NOW);
    expect((await getCachedStats(t0 + STATS_TTL_MS + 1)).participants).toBe(2);
  });

  it("GET /api/stats returns the public shape", async () => {
    const res = await statsRoute();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Object.keys(body).sort()).toEqual(["avgSeats", "locked", "names", "participants", "pmShare"]);
  });
});
