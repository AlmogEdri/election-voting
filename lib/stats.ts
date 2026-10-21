import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import { rankScores, scoreBallot, type Score } from "./scoring";
import { getSettings, settingsLocked, type RealResults } from "./settings";
import { parseSeats, type SeatMap } from "./seats";

type Db = PrismaClient | Prisma.TransactionClient;

export type BallotEntry = {
  name: string;
  seats: SeatMap;
  pmCandidateId: string;
  updatedAt: string;
  /** Present once the official results are entered. */
  score: (Score & { rank: number }) | null;
};

export type Stats = {
  participants: number;
  /** partyId → average seats (2 decimals), active lists only. */
  avgSeats: Record<string, number>;
  /** candidateId → percent of participants (1 decimal), active candidates only. */
  pmShare: Record<string, number>;
  /** Names of users who submitted a vote, Hebrew order. */
  names: string[];
  /** Every submitted ballot (owner decision 2026-10-21: ballots are public). Ranked when results exist, else by name. */
  ballots: BallotEntry[];
  realResults: RealResults;
};

export const STATS_TTL_MS = 10_000;

const round = (n: number, digits: number) => Math.round(n * 10 ** digits) / 10 ** digits;
const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "he");

export async function computeStats(db: Db = prisma): Promise<Stats> {
  const [parties, candidates, votes, settings] = await Promise.all([
    db.party.findMany({ where: { active: true }, select: { id: true } }),
    db.pmCandidate.findMany({ where: { active: true }, select: { id: true } }),
    db.vote.findMany({ select: { seats: true, pmCandidateId: true, updatedAt: true, user: { select: { name: true } } } }),
    getSettings(db),
  ]);

  const participants = votes.length;
  const seatTotals = new Map(parties.map((p) => [p.id, 0]));
  const pmCounts = new Map(candidates.map((c) => [c.id, 0]));
  const parsed = votes.map((vote) => ({
    name: vote.user.name,
    seats: parseSeats(vote.seats),
    pmCandidateId: vote.pmCandidateId,
    updatedAt: vote.updatedAt.toISOString(),
  }));
  for (const vote of parsed) {
    for (const [id, total] of seatTotals) seatTotals.set(id, total + (vote.seats[id] ?? 0));
    if (pmCounts.has(vote.pmCandidateId)) pmCounts.set(vote.pmCandidateId, pmCounts.get(vote.pmCandidateId)! + 1);
  }

  const real = settings.realResults;
  const ballots: BallotEntry[] = real
    ? rankScores(parsed.map((v) => ({ ...v, score: scoreBallot(v.seats, v.pmCandidateId, real) })))
        .map(({ rank, score, ...v }) => ({ ...v, score: { ...score, rank } }))
        .sort((a, b) => a.score!.rank - b.score!.rank || byName(a, b))
    : parsed.map((v) => ({ ...v, score: null })).sort(byName);

  return {
    participants,
    avgSeats: Object.fromEntries(
      [...seatTotals].map(([id, total]) => [id, participants ? round(total / participants, 2) : 0]),
    ),
    pmShare: Object.fromEntries(
      [...pmCounts].map(([id, count]) => [id, participants ? round((count / participants) * 100, 1) : 0]),
    ),
    names: parsed.map((v) => v.name).sort((a, b) => a.localeCompare(b, "he")),
    ballots,
    realResults: real,
  };
}

// Cache on globalThis: route bundles do not share module state in Next.js.
type Cache = { value: Stats; expiresAt: number } | null;
const holder = globalThis as unknown as { __statsCache?: Cache };

export async function getCachedStats(now = Date.now()): Promise<Stats> {
  const cached = holder.__statsCache;
  if (cached && cached.expiresAt > now) return cached.value;
  const value = await computeStats();
  holder.__statsCache = { value, expiresAt: now + STATS_TTL_MS };
  return value;
}

export function invalidateStats() {
  holder.__statsCache = null;
}
export const clearStatsCache = invalidateStats;

/** Stats plus the live lock state (not cached, so the lock flips exactly on time). */
export async function getPublicStats(now = new Date()) {
  const [stats, settings] = await Promise.all([getCachedStats(now.getTime()), getSettings(prisma)]);
  return { ...stats, locked: settingsLocked(settings, now) };
}
