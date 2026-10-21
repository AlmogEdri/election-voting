import { beforeEach, describe, expect, it } from "vitest";
import { GET as parties } from "@/app/api/parties/route";
import { PUT as vote } from "@/app/api/vote/route";
import { GET as me } from "@/app/api/me/route";
import { writeSetting } from "@/lib/settings";
import { saveVote } from "@/lib/votes";
import { SEED_SEATS } from "./fixtures/prd";
import { prisma, resetDb } from "./helpers/db";
import { registerUser, request } from "./helpers/api";

beforeEach(resetDb);

const put = (token: string | null, body: unknown) =>
  vote(request("/api/vote", { method: "PUT", body, headers: token ? { "x-device-token": token } : {} }));

describe("GET /api/parties", () => {
  it("returns fourteen lists, nine candidates, threshold and lock state", async () => {
    const res = await parties();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const body = await res.json();
    expect(body.parties).toHaveLength(14);
    expect(body.pmCandidates).toHaveLength(9);
    expect(body).toMatchObject({ totalSeats: 120, minSeats: 4, lockMode: "scheduled", lockAt: "2026-10-27T20:00:00.000Z" });
    expect(typeof body.locked).toBe("boolean");
    expect(Object.fromEntries(body.parties.map((p: { id: string; defaultSeats: number }) => [p.id, p.defaultSeats]))).toEqual(SEED_SEATS);
  });
});

describe("PUT /api/vote", () => {
  it("saves the seed allocation and updates on resubmission", async () => {
    const { deviceToken, userId } = await registerUser("דנה");
    const res = await put(deviceToken, { seats: SEED_SEATS, pmCandidateId: "netanyahu" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const changed = { ...SEED_SEATS, likud: 19, amcha: 4 };
    expect((await put(deviceToken, { seats: changed, pmCandidateId: "new-elections" })).status).toBe(200);
    expect(await prisma.vote.count()).toBe(1);

    const mine = await (await me(request("/api/me", { headers: { "x-device-token": deviceToken } }))).json();
    expect(mine.user.id).toBe(userId);
    expect(mine.vote).toMatchObject({ seats: changed, pmCandidateId: "new-elections" });
  });

  it("returns 401 without a valid token", async () => {
    expect((await put(null, { seats: SEED_SEATS, pmCandidateId: "netanyahu" })).status).toBe(401);
    expect((await put("bogus", { seats: SEED_SEATS, pmCandidateId: "netanyahu" })).status).toBe(401);
  });

  it("returns 400 for malformed ballots", async () => {
    const { deviceToken } = await registerUser("דנה");
    const cases = [
      "{not json",
      {},
      { seats: { ...SEED_SEATS, likud: 22 }, pmCandidateId: "netanyahu" },
      { seats: { ...SEED_SEATS, likud: 21, amcha: 2 }, pmCandidateId: "netanyahu" },
      { seats: { ...SEED_SEATS, likud: 19, "blue-white": 4 }, pmCandidateId: "netanyahu" },
      { seats: SEED_SEATS, pmCandidateId: "nobody" },
    ];
    for (const body of cases) {
      const res = await put(deviceToken, body);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    }
    expect(await prisma.vote.count()).toBe(0);
  });

  it("returns 423 once locked and keeps the previous vote", async () => {
    const { deviceToken, userId } = await registerUser("דנה");
    await put(deviceToken, { seats: SEED_SEATS, pmCandidateId: "netanyahu" });
    await writeSetting(prisma, "lock_mode", "closed");
    const res = await put(deviceToken, { seats: SEED_SEATS, pmCandidateId: "bennett" });
    expect(res.status).toBe(423);
    expect((await prisma.vote.findUniqueOrThrow({ where: { userId } })).pmCandidateId).toBe("netanyahu");

    await writeSetting(prisma, "lock_mode", "open");
    expect((await put(deviceToken, { seats: SEED_SEATS, pmCandidateId: "bennett" })).status).toBe(200);
  });

  it("locks at the scheduled instant", async () => {
    const { userId } = await registerUser("דנה");
    const body = { seats: SEED_SEATS, pmCandidateId: "netanyahu" };
    expect((await saveVote(userId, body, new Date("2026-10-27T19:59:59Z"))).ok).toBe(true);
    expect(await saveVote(userId, body, new Date("2026-10-27T20:00:00Z"))).toMatchObject({ ok: false, status: 423 });
  });
});
