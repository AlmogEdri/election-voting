import type { Prisma, PrismaClient } from "@prisma/client";
import { NEW_ELECTIONS_ID, OTHER_LISTS_COUNT, TOTAL_SEATS } from "./defaults";
import { getSettings, settingsLocked } from "./settings";
import type { BallotConfig } from "./validation";

type Db = PrismaClient | Prisma.TransactionClient;

export type PublicParty = {
  id: string;
  name: string;
  letters: string;
  leader: string;
  color: string;
  bloc: string;
  withdrawn: boolean;
  defaultSeats: number;
};

export type PublicCandidate = { id: string; name: string; partyId: string | null; partyName: string | null };

export type PublicConfig = {
  totalSeats: number;
  otherListsCount: number;
  minSeats: number;
  lockMode: string;
  lockAt: string | null;
  locked: boolean;
  parties: PublicParty[];
  pmCandidates: PublicCandidate[];
};

/** "בחירות נוספות" is always the last option regardless of its sort value. */
export function orderCandidates<T extends { id: string; sort: number }>(candidates: T[]) {
  return [...candidates].sort((a, b) => {
    const fixed = Number(a.id === NEW_ELECTIONS_ID) - Number(b.id === NEW_ELECTIONS_ID);
    return fixed || a.sort - b.sort || a.id.localeCompare(b.id);
  });
}

export async function getPublicConfig(db: Db, now = new Date()): Promise<PublicConfig> {
  const [settings, parties, candidates] = await Promise.all([
    getSettings(db),
    db.party.findMany({ where: { active: true }, orderBy: [{ sort: "asc" }, { id: "asc" }] }),
    db.pmCandidate.findMany({ where: { active: true }, include: { party: true } }),
  ]);
  return {
    totalSeats: TOTAL_SEATS,
    otherListsCount: OTHER_LISTS_COUNT,
    minSeats: settings.minSeats,
    lockMode: settings.lockMode,
    lockAt: settings.lockAt,
    locked: settingsLocked(settings, now),
    parties: parties.map((p) => ({
      id: p.id,
      name: p.name,
      letters: p.letters,
      leader: p.leader,
      color: p.color,
      bloc: p.bloc,
      withdrawn: p.withdrawn,
      defaultSeats: p.withdrawn ? 0 : p.defaultSeats,
    })),
    pmCandidates: orderCandidates(candidates).map((c) => ({
      id: c.id,
      name: c.name,
      partyId: c.partyId,
      partyName: c.party?.name ?? null,
    })),
  };
}

/** Everything ballot validation needs, including inactive rows. */
export async function getBallotConfig(db: Db): Promise<BallotConfig> {
  const [settings, parties, pmCandidates] = await Promise.all([
    getSettings(db),
    db.party.findMany({ select: { id: true, name: true, active: true, withdrawn: true } }),
    db.pmCandidate.findMany({ select: { id: true, active: true } }),
  ]);
  return { parties, pmCandidates, minSeats: settings.minSeats };
}
