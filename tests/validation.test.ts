import { describe, expect, it } from "vitest";
import { normalizeName, takenNameMessage, validateBallot, validateName, validateSeats, type BallotConfig } from "@/lib/validation";
import { DEFAULT_PARTIES, DEFAULT_PM_CANDIDATES } from "@/lib/defaults";
import { SEED_SEATS } from "./fixtures/prd";

const parties = DEFAULT_PARTIES.map((p) => ({ id: p.id, name: p.name, active: true, withdrawn: p.withdrawn }));
const config: BallotConfig = {
  parties,
  pmCandidates: DEFAULT_PM_CANDIDATES.map((c) => ({ id: c.id, active: true })),
  minSeats: 4,
};
const ballot = (seats: Record<string, unknown>, pmCandidateId: unknown = "netanyahu") => ({ seats, pmCandidateId });
const err = (r: { ok: boolean; error?: string }) => (r.ok ? null : r.error);

describe("names", () => {
  it("trims, collapses whitespace and case-folds for comparison", () => {
    expect(normalizeName("  Dani   K  ")).toEqual({ display: "Dani K", norm: "dani k" });
    expect(normalizeName("דני\tכהן").norm).toBe(normalizeName("דני כהן").norm);
  });

  it("accepts 2–30 characters after trimming", () => {
    expect(validateName("דנ").ok).toBe(true);
    expect(validateName("א".repeat(30)).ok).toBe(true);
    expect(validateName("  א  ").ok).toBe(false);
    expect(validateName("א".repeat(31)).ok).toBe(false);
    expect(validateName("").ok).toBe(false);
    expect(validateName(42).ok).toBe(false);
    expect(validateName(undefined).ok).toBe(false);
  });

  it("suggests an alternative in Hebrew", () => {
    expect(takenNameMessage("דני")).toBe("השם תפוס, נסה 'דני כ.'");
  });
});

describe("seat maps", () => {
  it("accepts the seed allocation", () => {
    const result = validateSeats(SEED_SEATS, parties, 4);
    expect(result).toEqual({ ok: true, value: SEED_SEATS });
  });

  it("rejects malformed maps", () => {
    for (const input of [null, undefined, [], "x", 5]) expect(validateSeats(input, parties, 4).ok).toBe(false);
  });

  it("rejects unknown and missing lists", () => {
    expect(err(validateSeats({ ...SEED_SEATS, nope: 0 }, parties, 4))).toContain("רשימה לא מוכרת");
    const missing: Record<string, number> = { ...SEED_SEATS };
    delete missing.likud;
    expect(err(validateSeats(missing, parties, 4))).toContain("חסר");
  });

  it("rejects fractions, negatives, strings and values above 120", () => {
    for (const bad of [10.5, -1, "10", 121, NaN, null]) {
      expect(validateSeats({ ...SEED_SEATS, amcha: bad }, parties, 4).ok).toBe(false);
    }
  });

  it("requires a total of exactly 120", () => {
    expect(err(validateSeats({ ...SEED_SEATS, likud: 22 }, parties, 4))).toContain("כרגע 119");
    expect(err(validateSeats({ ...SEED_SEATS, likud: 24 }, parties, 4))).toContain("כרגע 121");
  });

  it("rejects 1–3 seats while the threshold applies", () => {
    for (const n of [1, 2, 3]) {
      const seats = { ...SEED_SEATS, likud: 23 - n, amcha: n };
      expect(err(validateSeats(seats, parties, 4))).toContain("0 או לפחות 4");
    }
    expect(validateSeats({ ...SEED_SEATS, likud: 19, amcha: 4 }, parties, 4).ok).toBe(true);
  });

  it("allows small values when the threshold is disabled", () => {
    expect(validateSeats({ ...SEED_SEATS, likud: 22, amcha: 1 }, parties, 0).ok).toBe(true);
  });

  it("keeps withdrawn and inactive lists at zero", () => {
    expect(validateSeats({ ...SEED_SEATS, likud: 19, "blue-white": 4 }, parties, 4).ok).toBe(false);
    const withInactive = [...parties, { id: "old", name: "ישנה", active: false, withdrawn: false }];
    expect(validateSeats(SEED_SEATS, withInactive, 4).ok).toBe(true);
    expect(validateSeats({ ...SEED_SEATS, old: 0 }, withInactive, 4)).toEqual({ ok: true, value: SEED_SEATS });
    expect(validateSeats({ ...SEED_SEATS, likud: 19, old: 4 }, withInactive, 4).ok).toBe(false);
  });
});

describe("ballots", () => {
  it("accepts a full ballot", () => {
    expect(validateBallot(ballot(SEED_SEATS, "new-elections"), config).ok).toBe(true);
  });

  it("requires an active configured PM candidate", () => {
    expect(err(validateBallot(ballot(SEED_SEATS, "someone"), config))).toContain("ראשות הממשלה");
    expect(validateBallot({ seats: SEED_SEATS }, config).ok).toBe(false);
    expect(validateBallot(ballot(SEED_SEATS, 3), config).ok).toBe(false);
    const inactive = { ...config, pmCandidates: [{ id: "netanyahu", active: false }] };
    expect(validateBallot(ballot(SEED_SEATS), inactive).ok).toBe(false);
  });

  it("rejects non-object bodies", () => {
    expect(validateBallot(null, config).ok).toBe(false);
    expect(validateBallot("x", config).ok).toBe(false);
  });
});
