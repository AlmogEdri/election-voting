import type { PublicConfig } from "@/lib/config";
import { DEFAULT_PARTIES, DEFAULT_PM_CANDIDATES } from "@/lib/defaults";

export function publicConfig(overrides: Partial<PublicConfig> = {}): PublicConfig {
  const partyName = new Map(DEFAULT_PARTIES.map((p) => [p.id, p.name]));
  return {
    totalSeats: 120,
    otherListsCount: 24,
    minSeats: 4,
    lockMode: "scheduled",
    lockAt: "2026-10-27T20:00:00.000Z",
    locked: false,
    parties: DEFAULT_PARTIES.map((p) => ({
      id: p.id,
      name: p.name,
      letters: p.letters,
      leader: p.leader,
      color: p.color,
      bloc: p.bloc,
      withdrawn: p.withdrawn,
      defaultSeats: p.defaultSeats,
    })),
    pmCandidates: DEFAULT_PM_CANDIDATES.map((c) => ({
      id: c.id,
      name: c.name,
      partyId: c.partyId,
      partyName: c.partyId ? (partyName.get(c.partyId) ?? null) : null,
    })),
    ...overrides,
  };
}
