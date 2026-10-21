import { TOTAL_SEATS } from "./defaults";

export type SeatMap = Record<string, number>;

export type SeatParty = {
  id: string;
  withdrawn: boolean;
  defaultSeats?: number;
};

/** The threshold rule (0 or at least minSeats) is off when minSeats is 0 or 1. */
export function thresholdApplies(minSeats: number) {
  return minSeats > 1;
}

export function sumSeats(seats: SeatMap) {
  return Object.values(seats).reduce((total, n) => total + n, 0);
}

export function remainingSeats(seats: SeatMap) {
  return TOTAL_SEATS - sumSeats(seats);
}

/** Highest value a party may reach: its current seats plus whatever is still unallocated. */
export function seatCap(seats: SeatMap, partyId: string) {
  return (seats[partyId] ?? 0) + Math.max(0, remainingSeats(seats));
}

/**
 * Applies a slider/button change for one party. Clamps to [0, cap] and, when the
 * threshold applies, jumps over 1..minSeats-1: moving up from 0 lands on
 * minSeats (if it fits), moving down below minSeats lands on 0.
 */
export function adjustSeats(seats: SeatMap, partyId: string, requested: number, minSeats: number): SeatMap {
  const current = seats[partyId] ?? 0;
  const cap = seatCap(seats, partyId);
  let next = Math.round(Number.isFinite(requested) ? requested : current);
  next = Math.min(Math.max(next, 0), cap);

  if (thresholdApplies(minSeats) && next > 0 && next < minSeats) {
    if (next > current) next = cap >= minSeats ? minSeats : current;
    else next = 0;
  }
  if (next === current) return seats;
  return { ...seats, [partyId]: next };
}

export function zeroSeats(parties: SeatParty[]): SeatMap {
  return Object.fromEntries(parties.map((p) => [p.id, 0]));
}

export function defaultSeatMap(parties: SeatParty[]): SeatMap {
  return Object.fromEntries(parties.map((p) => [p.id, p.withdrawn ? 0 : (p.defaultSeats ?? 0)]));
}

/** Maps a saved ballot onto the current parties (drops removed lists, zeroes withdrawn ones). */
export function restoreSeatMap(saved: SeatMap, parties: SeatParty[]): SeatMap {
  return Object.fromEntries(
    parties.map((p) => {
      const n = saved[p.id];
      return [p.id, p.withdrawn || !Number.isInteger(n) || n < 0 ? 0 : n];
    }),
  );
}

/** Parses a stored seats JSON column; keeps integer entries only. */
export function parseSeats(json: string): SeatMap {
  try {
    const value: unknown = JSON.parse(json);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter((entry): entry is [string, number] => Number.isInteger(entry[1])),
    );
  } catch {
    return {};
  }
}
