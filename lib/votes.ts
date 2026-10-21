import { prisma } from "./db";
import { getBallotConfig } from "./config";
import { getSettings, settingsLocked } from "./settings";
import { invalidateStats } from "./stats";
import { validateBallot } from "./validation";
import { parseSeats, type SeatMap } from "./seats";

export type SaveVoteResult = { ok: true } | { ok: false; status: 400 | 423; error: string };

export const LOCKED_MESSAGE = "ההצבעה נעולה ואי אפשר לשנות אותה";

/** Validates against the current configuration and upserts the user's single vote. */
export async function saveVote(userId: string, input: unknown, now = new Date()): Promise<SaveVoteResult> {
  const result = await prisma.$transaction(async (tx): Promise<SaveVoteResult> => {
    // Lock and configuration are read inside the same transaction as the write.
    const settings = await getSettings(tx);
    if (settingsLocked(settings, now)) return { ok: false, status: 423, error: LOCKED_MESSAGE };

    const ballot = validateBallot(input, await getBallotConfig(tx));
    if (!ballot.ok) return { ok: false, status: 400, error: ballot.error };

    const data = { seats: JSON.stringify(ballot.value.seats), pmCandidateId: ballot.value.pmCandidateId };
    await tx.vote.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    return { ok: true };
  });
  if (result.ok) invalidateStats();
  return result;
}

export type SavedVote = { seats: SeatMap; pmCandidateId: string; updatedAt: string };

export async function getVote(userId: string): Promise<SavedVote | null> {
  const vote = await prisma.vote.findUnique({ where: { userId } });
  if (!vote) return null;
  return { seats: parseSeats(vote.seats), pmCandidateId: vote.pmCandidateId, updatedAt: vote.updatedAt.toISOString() };
}
