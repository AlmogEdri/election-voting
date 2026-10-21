import { TOTAL_SEATS } from "./defaults";
import { sumSeats, thresholdApplies, type SeatMap } from "./seats";

export const NAME_MIN = 2;
export const NAME_MAX = 30;

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** Display form: trimmed, inner whitespace collapsed. Comparison form: also case-folded. */
export function normalizeName(raw: string) {
  const display = raw.normalize("NFC").replace(/\s+/gu, " ").trim();
  return { display, norm: display.toLocaleLowerCase("he") };
}

export function validateName(raw: unknown): Result<{ name: string; nameNorm: string }> {
  if (typeof raw !== "string") return { ok: false, error: "יש להזין שם" };
  const { display, norm } = normalizeName(raw);
  const length = [...display].length;
  if (length < NAME_MIN || length > NAME_MAX) {
    return { ok: false, error: `השם צריך להכיל ${NAME_MIN}–${NAME_MAX} תווים` };
  }
  return { ok: true, value: { name: display, nameNorm: norm } };
}

export function takenNameMessage(name: string) {
  const base = [...name].slice(0, NAME_MAX - 3).join("");
  return `השם תפוס, נסה '${base} כ.'`;
}

export type BallotParty = { id: string; name: string; active: boolean; withdrawn: boolean };
export type BallotCandidate = { id: string; active: boolean };
export type BallotConfig = {
  parties: BallotParty[];
  pmCandidates: BallotCandidate[];
  minSeats: number;
};
export type Ballot = { seats: SeatMap; pmCandidateId: string };

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Seat map rules: an entry for every active list, no unknown lists, integers
 * 0–120, total exactly 120, each value 0 or ≥ minSeats, withdrawn/inactive lists 0.
 * The returned map contains active lists only.
 */
export function validateSeats(input: unknown, parties: BallotParty[], minSeats: number): Result<SeatMap> {
  if (!isPlainObject(input)) return { ok: false, error: "חלוקת המנדטים חסרה או לא תקינה" };

  const byId = new Map(parties.map((p) => [p.id, p]));
  for (const id of Object.keys(input)) {
    if (!byId.has(id)) return { ok: false, error: `רשימה לא מוכרת: ${id}` };
  }

  const seats: SeatMap = {};
  for (const party of parties) {
    const value = input[party.id];
    if (value === undefined) {
      if (party.active) return { ok: false, error: `חסר מספר מנדטים עבור ${party.name}` };
      continue;
    }
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > TOTAL_SEATS) {
      return { ok: false, error: `מספר המנדטים של ${party.name} חייב להיות מספר שלם בין 0 ל-${TOTAL_SEATS}` };
    }
    if (!party.active || party.withdrawn) {
      if (value !== 0) return { ok: false, error: `${party.name} אינה מתמודדת ולא יכולה לקבל מנדטים` };
      if (!party.active) continue;
    }
    if (thresholdApplies(minSeats) && value > 0 && value < minSeats) {
      return { ok: false, error: `רשימה מקבלת 0 או לפחות ${minSeats} מנדטים (${party.name}: ${value})` };
    }
    seats[party.id] = value;
  }

  const total = sumSeats(seats);
  if (total !== TOTAL_SEATS) {
    return { ok: false, error: `סכום המנדטים חייב להיות בדיוק ${TOTAL_SEATS} (כרגע ${total})` };
  }
  return { ok: true, value: seats };
}

export function validateBallot(input: unknown, config: BallotConfig): Result<Ballot> {
  if (!isPlainObject(input)) return { ok: false, error: "בקשה לא תקינה" };
  const seats = validateSeats(input.seats, config.parties, config.minSeats);
  if (!seats.ok) return seats;
  const pmCandidateId = input.pmCandidateId;
  const candidate = config.pmCandidates.find((c) => c.id === pmCandidateId);
  if (typeof pmCandidateId !== "string" || !candidate || !candidate.active) {
    return { ok: false, error: "יש לבחור מועמד לראשות הממשלה מהרשימה" };
  }
  return { ok: true, value: { seats: seats.value, pmCandidateId } };
}
