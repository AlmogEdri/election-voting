import type { SeatMap } from "./seats";

/** Seat-equivalents taken off the deviation for naming the right prime minister (or "new elections"). */
export const PM_BONUS = 10;

export type RealBallot = { seats: SeatMap; pmCandidateId: string };
export type Score = {
  /** Sum of |predicted − actual| over the lists in the official results. */
  deviation: number;
  pmCorrect: boolean;
  /** deviation − PM_BONUS when the PM call was right. Lower is better. */
  total: number;
};

export function scoreBallot(seats: SeatMap, pmCandidateId: string, real: RealBallot): Score {
  let deviation = 0;
  for (const [partyId, actual] of Object.entries(real.seats)) deviation += Math.abs((seats[partyId] ?? 0) - actual);
  const pmCorrect = pmCandidateId === real.pmCandidateId;
  return { deviation, pmCorrect, total: deviation - (pmCorrect ? PM_BONUS : 0) };
}

/** Competition ranking (1, 1, 3): equal totals share a rank. Input order is kept. */
export function rankScores<T extends { score: Score }>(entries: T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort((a, b) => a.score.total - b.score.total || a.score.deviation - b.score.deviation);
  const rankOf = new Map<T, number>();
  sorted.forEach((entry, i) => {
    const prev = sorted[i - 1];
    rankOf.set(entry, prev && prev.score.total === entry.score.total && prev.score.deviation === entry.score.deviation ? rankOf.get(prev)! : i + 1);
  });
  return entries.map((entry) => ({ ...entry, rank: rankOf.get(entry)! }));
}
