import { beforeEach, describe, expect, it } from "vitest";
import * as settingsRoute from "@/app/api/admin/settings/route";
import * as configurationRoute from "@/app/api/admin/configuration/route";
import * as realResultsRoute from "@/app/api/admin/real-results/route";
import * as deleteUserRoute from "@/app/api/admin/delete-user/route";
import { GET as parties } from "@/app/api/parties/route";
import { PUT as vote } from "@/app/api/vote/route";
import { getConfiguration } from "@/lib/admin";
import { getSettings } from "@/lib/settings";
import { getCachedStats } from "@/lib/stats";
import { saveVote } from "@/lib/votes";
import { SEED_SEATS } from "./fixtures/prd";
import { prisma, resetDb } from "./helpers/db";
import { registerUser, request } from "./helpers/api";

beforeEach(resetDb);

const SECRET = { "x-admin-secret": "test-admin-secret" };
const post = (handler: (r: Request) => Promise<Response>, body: unknown, headers: Record<string, string> = SECRET) =>
  handler(request("/api/admin", { method: "POST", body, headers }));
const get = (handler: (r: Request) => Promise<Response>, headers: Record<string, string> = SECRET) =>
  handler(request("/api/admin", { headers }));

async function currentConfiguration() {
  const config = await getConfiguration();
  return JSON.parse(JSON.stringify(config)) as {
    parties: Array<Record<string, unknown> & { id: string; defaultSeats: number }>;
    pmCandidates: Array<Record<string, unknown> & { id: string }>;
  };
}

describe("admin authentication", () => {
  const handlers = [settingsRoute.POST, configurationRoute.POST, realResultsRoute.POST, deleteUserRoute.POST];

  it("every endpoint returns 401 without the correct secret", async () => {
    for (const handler of handlers) {
      expect((await post(handler, {}, {})).status).toBe(401);
      expect((await post(handler, {}, { "x-admin-secret": "wrong" })).status).toBe(401);
    }
    expect((await get(settingsRoute.GET, {})).status).toBe(401);
    expect((await get(configurationRoute.GET, { "x-admin-secret": "wrong" })).status).toBe(401);
  });

  it("returns 401 for everyone when ADMIN_SECRET is unset", async () => {
    const saved = process.env.ADMIN_SECRET;
    delete process.env.ADMIN_SECRET;
    try {
      expect((await get(settingsRoute.GET)).status).toBe(401);
    } finally {
      process.env.ADMIN_SECRET = saved;
    }
  });

  it("rejects invalid JSON with 400", async () => {
    expect((await post(settingsRoute.POST, "{oops")).status).toBe(400);
  });
});

describe("settings", () => {
  it("locks, reopens after the deadline and reschedules", async () => {
    const { deviceToken } = await registerUser("דנה");
    const ballot = { seats: SEED_SEATS, pmCandidateId: "netanyahu" };
    const putVote = () => vote(request("/api/vote", { method: "PUT", body: ballot, headers: { "x-device-token": deviceToken } }));

    expect((await post(settingsRoute.POST, { lockMode: "closed" })).status).toBe(200);
    expect((await putVote()).status).toBe(423);
    expect((await (await parties()).json()).locked).toBe(true);

    expect((await post(settingsRoute.POST, { lockMode: "scheduled", lockAt: "2020-01-01T00:00:00Z" })).status).toBe(200);
    expect((await putVote()).status).toBe(423);
    expect((await post(settingsRoute.POST, { lockMode: "open" })).status).toBe(200);
    expect((await putVote()).status).toBe(200);

    const state = await (await get(settingsRoute.GET)).json();
    expect(state).toMatchObject({ lockMode: "open", lockAt: "2020-01-01T00:00:00.000Z", locked: false, minSeats: 4 });
    expect(state.users).toEqual([expect.objectContaining({ name: "דנה", voted: true })]);
  });

  it("changes and disables the threshold", async () => {
    expect((await post(settingsRoute.POST, { minSeats: 0 })).status).toBe(200);
    expect((await getSettings(prisma)).minSeats).toBe(0);
    // Defaults include 6 seats (Ra'am), so a threshold of 7 is rejected.
    expect((await post(settingsRoute.POST, { minSeats: 7 })).status).toBe(400);
    expect((await getSettings(prisma)).minSeats).toBe(0);
  });

  it("rejects invalid values without partial writes", async () => {
    for (const body of [{ lockMode: "maybe" }, { lockAt: "not a date" }, { minSeats: -1 }, { minSeats: 2.5 }, [], null]) {
      expect((await post(settingsRoute.POST, body)).status).toBe(400);
    }
    const res = await post(settingsRoute.POST, { lockMode: "closed", minSeats: "x" });
    expect(res.status).toBe(400);
    expect((await getSettings(prisma)).lockMode).toBe("scheduled");
  });
});

describe("configuration", () => {
  it("returns and accepts the current configuration", async () => {
    const config = await (await get(configurationRoute.GET)).json();
    expect(config.parties).toHaveLength(14);
    expect(config.pmCandidates.at(-1).id).toBe("new-elections");
    expect((await post(configurationRoute.POST, config)).status).toBe(200);
  });

  it("edits fields, deactivates missing rows and keeps referenced records", async () => {
    const { userId } = await registerUser("דנה");
    await saveVote(userId, { seats: SEED_SEATS, pmCandidateId: "lapid" }, new Date("2026-10-22"));

    const config = await currentConfiguration();
    config.parties = config.parties.filter((p) => p.id !== "amcha");
    config.parties.find((p) => p.id === "likud")!.leader = "בנימין נתניהו (עודכן)";
    config.pmCandidates = config.pmCandidates.filter((c) => c.id !== "lapid");
    expect((await post(configurationRoute.POST, config)).status).toBe(200);

    expect(await prisma.party.findUnique({ where: { id: "amcha" } })).toMatchObject({ active: false });
    expect(await prisma.pmCandidate.findUnique({ where: { id: "lapid" } })).toMatchObject({ active: false });
    expect(await prisma.vote.findUnique({ where: { userId } })).toMatchObject({ pmCandidateId: "lapid" });

    const publicConfig = await (await parties()).json();
    expect(publicConfig.parties).toHaveLength(13);
    expect(publicConfig.pmCandidates).toHaveLength(8);
    expect(publicConfig.parties[0].leader).toBe("בנימין נתניהו (עודכן)");
  });

  it("adds a new list", async () => {
    const config = await currentConfiguration();
    const likud = config.parties.find((p) => p.id === "likud")!;
    likud.defaultSeats = 19;
    config.parties.push({ ...likud, id: "new-list", name: "רשימה חדשה", sort: 15, defaultSeats: 4 });
    expect((await post(configurationRoute.POST, config)).status).toBe(200);
    expect(await prisma.party.count({ where: { active: true } })).toBe(15);
  });

  it("rejects invalid configurations without partial writes", async () => {
    const mutate = async (fn: (c: Awaited<ReturnType<typeof currentConfiguration>>) => void) => {
      const config = await currentConfiguration();
      config.parties.find((p) => p.id === "likud")!.leader = "SHOULD NOT BE SAVED";
      fn(config);
      return config;
    };
    const invalid = [
      await mutate((c) => { c.parties.find((p) => p.id === "likud")!.defaultSeats = 22; }), // total 119
      await mutate((c) => { c.parties.find((p) => p.id === "blue-white")!.defaultSeats = 4; c.parties.find((p) => p.id === "likud")!.defaultSeats = 19; }),
      await mutate((c) => { c.parties.find((p) => p.id === "amcha")!.defaultSeats = 2; c.parties.find((p) => p.id === "likud")!.defaultSeats = 21; }),
      await mutate((c) => { c.pmCandidates = c.pmCandidates.filter((x) => x.id !== "new-elections"); }),
      await mutate((c) => { c.pmCandidates.find((x) => x.id === "new-elections")!.active = false; }),
      await mutate((c) => { c.parties.push({ ...c.parties[0] }); }), // duplicate id
      await mutate((c) => { c.parties[0].color = "blue"; }),
      await mutate((c) => { c.pmCandidates[0].partyId = "ghost"; }),
      { parties: "nope", pmCandidates: [] },
    ];
    for (const body of invalid) {
      const res = await post(configurationRoute.POST, body);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    }
    expect((await prisma.party.findUniqueOrThrow({ where: { id: "likud" } })).leader).toBe("בנימין נתניהו");
    expect(await prisma.pmCandidate.count({ where: { active: true } })).toBe(9);
  });
});

describe("real results", () => {
  it("stores valid results, rejects invalid ones and clears", async () => {
    expect((await post(realResultsRoute.POST, { seats: { ...SEED_SEATS, likud: 22 }, pmCandidateId: "netanyahu" })).status).toBe(400);
    expect((await post(realResultsRoute.POST, { seats: SEED_SEATS, pmCandidateId: "bennett" })).status).toBe(200);
    expect((await getSettings(prisma)).realResults).toMatchObject({ seats: SEED_SEATS, pmCandidateId: "bennett" });
    expect((await post(realResultsRoute.POST, { clear: true })).status).toBe(200);
    expect((await getSettings(prisma)).realResults).toBeNull();
  });
});

describe("delete user", () => {
  it("removes the user and their vote and updates aggregates", async () => {
    const a = await registerUser("אבי", "10.0.0.1");
    const b = await registerUser("בתיה", "10.0.0.2");
    const now = new Date("2026-10-22");
    await saveVote(a.userId, { seats: SEED_SEATS, pmCandidateId: "netanyahu" }, now);
    await saveVote(b.userId, { seats: SEED_SEATS, pmCandidateId: "bennett" }, now);
    expect((await getCachedStats()).participants).toBe(2);

    expect((await post(deleteUserRoute.POST, { userId: a.userId })).status).toBe(200);
    expect(await prisma.user.findUnique({ where: { id: a.userId } })).toBeNull();
    expect(await prisma.vote.count()).toBe(1);
    const stats = await getCachedStats();
    expect(stats.participants).toBe(1);
    expect(stats.names).toEqual(["בתיה"]);

    expect((await post(deleteUserRoute.POST, { userId: a.userId })).status).toBe(404);
    expect((await post(deleteUserRoute.POST, {})).status).toBe(400);
  });
});
