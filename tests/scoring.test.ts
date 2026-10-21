import { describe, expect, it } from "vitest";
import { PM_BONUS, rankScores, scoreBallot } from "@/lib/scoring";

const real = { seats: { likud: 24, yashar: 22, shas: 9 }, pmCandidateId: "netanyahu" };

describe("scoring", () => {
  it("sums absolute seat deviations over the official lists only", () => {
    const s = scoreBallot({ likud: 21, yashar: 25, shas: 9, amcha: 4 }, "eisenkot", real);
    expect(s).toEqual({ deviation: 6, pmCorrect: false, total: 6 });
  });

  it("takes the PM bonus off the total when the call was right", () => {
    const s = scoreBallot({ likud: 24, yashar: 22, shas: 9 }, "netanyahu", real);
    expect(s).toEqual({ deviation: 0, pmCorrect: true, total: -PM_BONUS });
  });

  it("treats a missing list as zero seats", () => {
    expect(scoreBallot({}, "x", real).deviation).toBe(55);
  });

  it("ranks by total with shared ranks for ties, keeping input order", () => {
    const ranked = rankScores([
      { name: "a", score: { deviation: 12, pmCorrect: false, total: 12 } },
      { name: "b", score: { deviation: 14, pmCorrect: true, total: 4 } },
      { name: "c", score: { deviation: 12, pmCorrect: false, total: 12 } },
      { name: "d", score: { deviation: 20, pmCorrect: false, total: 20 } },
    ]);
    expect(ranked.map((r) => `${r.name}:${r.rank}`)).toEqual(["a:2", "b:1", "c:2", "d:4"]);
  });
});
