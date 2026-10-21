import { beforeEach, describe, expect, it } from "vitest";
import { getPublicConfig } from "@/lib/config";
import { getSettings } from "@/lib/settings";
import { validateSeats } from "@/lib/validation";
import { seed } from "@/prisma/seed";
import { PRD_PARTIES, PRD_PM_CANDIDATES, SEED_SEATS } from "./fixtures/prd";
import { prisma, resetDb } from "./helpers/db";

beforeEach(resetDb);

describe("seed", () => {
  it("seeds every PRD list with its fields, in table order", async () => {
    const parties = await prisma.party.findMany({ orderBy: { sort: "asc" } });
    expect(parties.map((p) => ({ name: p.name, letters: p.letters, leader: p.leader, bloc: p.bloc, seats: p.defaultSeats })))
      .toEqual(PRD_PARTIES);
    expect(parties.map((p) => p.defaultSeats)).toEqual([23, 21, 14, 10, 9, 8, 8, 7, 7, 7, 6, 0, 0, 0]);
    expect(parties.reduce((s, p) => s + p.defaultSeats, 0)).toBe(120);
    for (const p of parties) expect(p.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(parties.every((p) => p.active)).toBe(true);
  });

  it("marks Blue and White withdrawn, and it cannot receive seats", async () => {
    const withdrawn = await prisma.party.findMany({ where: { withdrawn: true } });
    expect(withdrawn.map((p) => p.name)).toEqual(["כחול לבן"]);
    const parties = await prisma.party.findMany();
    const seats = { ...SEED_SEATS, likud: 19, "blue-white": 4 };
    const result = validateSeats(seats, parties, 4);
    expect(result.ok).toBe(false);
  });

  it("seeds the nine PM choices with 'בחירות נוספות' last", async () => {
    const config = await getPublicConfig(prisma);
    expect(config.pmCandidates.map((c) => c.name)).toEqual(PRD_PM_CANDIDATES);
    expect(config.pmCandidates.at(-1)).toMatchObject({ id: "new-elections", partyId: null });
    expect(config.pmCandidates.find((c) => c.id === "lapid")?.partyName).toBe("ביחד (בנט–לפיד)");
  });

  it("stores the default settings", async () => {
    const settings = await getSettings(prisma);
    expect(settings).toEqual({
      lockMode: "scheduled",
      lockAt: "2026-10-27T20:00:00.000Z",
      minSeats: 4,
      realResults: null,
    });
  });

  it("is idempotent and keeps admin edits", async () => {
    await prisma.party.update({ where: { id: "likud" }, data: { leader: "edited" } });
    await prisma.setting.update({ where: { key: "min_seats" }, data: { value: "0" } });
    await seed(prisma);
    await seed(prisma);
    expect(await prisma.party.count()).toBe(14);
    expect(await prisma.pmCandidate.count()).toBe(9);
    expect(await prisma.setting.count()).toBe(4);
    expect((await prisma.party.findUnique({ where: { id: "likud" } }))?.leader).toBe("edited");
    expect((await getSettings(prisma)).minSeats).toBe(0);
  });
});
