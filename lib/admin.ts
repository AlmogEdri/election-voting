import { prisma } from "./db";
import { NEW_ELECTIONS_ID, SETTING_KEYS, TOTAL_SEATS } from "./defaults";
import { getBallotConfig, orderCandidates } from "./config";
import { isLockMode } from "./lock";
import { thresholdApplies } from "./seats";
import { getSettings, settingsLocked, writeSetting } from "./settings";
import { invalidateStats } from "./stats";
import { validateBallot, type Result } from "./validation";

export type AdminResult<T = null> = { ok: true; value: T } | { ok: false; status: 400 | 404; error: string };

const bad = (error: string): { ok: false; status: 400; error: string } => ({ ok: false, status: 400, error });

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function getAdminState(now = new Date()) {
  const [settings, users] = await Promise.all([
    getSettings(prisma),
    prisma.user.findMany({ orderBy: { createdAt: "asc" }, include: { vote: { select: { id: true } } } }),
  ]);
  return {
    ...settings,
    locked: settingsLocked(settings, now),
    users: users.map((u) => ({ id: u.id, name: u.name, voted: u.vote !== null, createdAt: u.createdAt.toISOString() })),
  };
}

/** Rejects a threshold the current default allocation would violate. */
function checkDefaultsThreshold(defaults: { name: string; defaultSeats: number }[], minSeats: number) {
  if (!thresholdApplies(minSeats)) return null;
  const offender = defaults.find((p) => p.defaultSeats > 0 && p.defaultSeats < minSeats);
  return offender ? `ברירת המחדל של ${offender.name} (${offender.defaultSeats}) נמוכה מאחוז החסימה (${minSeats})` : null;
}

export async function updateSettings(input: unknown): Promise<AdminResult> {
  if (!isObject(input)) return bad("בקשה לא תקינה");
  const { lockMode, lockAt, minSeats } = input;

  if (lockMode !== undefined && !isLockMode(lockMode)) return bad("מצב נעילה לא תקין (scheduled / open / closed)");
  if (lockAt !== undefined && lockAt !== null && (typeof lockAt !== "string" || !Number.isFinite(Date.parse(lockAt)))) {
    return bad("מועד הנעילה אינו תאריך תקין");
  }
  if (minSeats !== undefined && (!Number.isInteger(minSeats) || (minSeats as number) < 0 || (minSeats as number) > TOTAL_SEATS)) {
    return bad("אחוז החסימה חייב להיות מספר שלם בין 0 ל-120 (0 = כבוי)");
  }

  return prisma.$transaction(async (tx) => {
    if (minSeats !== undefined) {
      const parties = await tx.party.findMany({ where: { active: true, withdrawn: false } });
      const error = checkDefaultsThreshold(parties, minSeats as number);
      if (error) return bad(error);
      await writeSetting(tx, SETTING_KEYS.minSeats, minSeats);
    }
    if (lockMode !== undefined) await writeSetting(tx, SETTING_KEYS.lockMode, lockMode);
    if (lockAt !== undefined) {
      await writeSetting(tx, SETTING_KEYS.lockedAt, lockAt === null ? null : new Date(lockAt as string).toISOString());
    }
    return { ok: true as const, value: null };
  });
}

export async function getConfiguration() {
  const [parties, pmCandidates] = await Promise.all([
    prisma.party.findMany({ orderBy: [{ sort: "asc" }, { id: "asc" }] }),
    prisma.pmCandidate.findMany(),
  ]);
  return { parties, pmCandidates: orderCandidates(pmCandidates) };
}

type PartyInput = {
  id: string;
  name: string;
  letters: string;
  leader: string;
  color: string;
  bloc: string;
  sort: number;
  active: boolean;
  withdrawn: boolean;
  defaultSeats: number;
};
type CandidateInput = { id: string; name: string; partyId: string | null; sort: number; active: boolean };

const ID_PATTERN = /^[a-z0-9-]{1,40}$/;
const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

function text(value: unknown, max: number, allowEmpty = false) {
  return typeof value === "string" && value.trim().length <= max && (allowEmpty || value.trim().length > 0);
}

function parseParty(raw: unknown, index: number): Result<PartyInput> {
  const where = `רשימה #${index + 1}`;
  if (!isObject(raw)) return { ok: false, error: `${where}: חייבת להיות אובייקט` };
  const r = raw;
  if (typeof r.id !== "string" || !ID_PATTERN.test(r.id)) return { ok: false, error: `${where}: מזהה לא תקין (a-z, 0-9, -)` };
  if (!text(r.name, 80)) return { ok: false, error: `${where}: שם חסר` };
  if (!text(r.letters, 6)) return { ok: false, error: `${where}: אותיות פתק חסרות` };
  if (!text(r.leader, 80, true)) return { ok: false, error: `${where}: ראש רשימה לא תקין` };
  if (typeof r.color !== "string" || !COLOR_PATTERN.test(r.color)) return { ok: false, error: `${where}: צבע חייב להיות ‎#rrggbb` };
  if (!text(r.bloc, 40, true)) return { ok: false, error: `${where}: גוש לא תקין` };
  if (!Number.isInteger(r.sort)) return { ok: false, error: `${where}: sort חייב להיות מספר שלם` };
  if (r.active !== undefined && typeof r.active !== "boolean") return { ok: false, error: `${where}: active חייב להיות true/false` };
  if (r.withdrawn !== undefined && typeof r.withdrawn !== "boolean") return { ok: false, error: `${where}: withdrawn חייב להיות true/false` };
  const defaultSeats = r.defaultSeats ?? 0;
  if (!Number.isInteger(defaultSeats) || (defaultSeats as number) < 0 || (defaultSeats as number) > TOTAL_SEATS) {
    return { ok: false, error: `${where}: defaultSeats חייב להיות מספר שלם בין 0 ל-120` };
  }
  return {
    ok: true,
    value: {
      id: r.id,
      name: (r.name as string).trim(),
      letters: (r.letters as string).trim(),
      leader: (r.leader as string).trim(),
      color: r.color,
      bloc: (r.bloc as string).trim(),
      sort: r.sort as number,
      active: (r.active as boolean | undefined) ?? true,
      withdrawn: (r.withdrawn as boolean | undefined) ?? false,
      defaultSeats: defaultSeats as number,
    },
  };
}

function parseCandidate(raw: unknown, index: number): Result<CandidateInput> {
  const where = `מועמד #${index + 1}`;
  if (!isObject(raw)) return { ok: false, error: `${where}: חייב להיות אובייקט` };
  const r = raw;
  if (typeof r.id !== "string" || !ID_PATTERN.test(r.id)) return { ok: false, error: `${where}: מזהה לא תקין (a-z, 0-9, -)` };
  if (!text(r.name, 80)) return { ok: false, error: `${where}: שם חסר` };
  if (r.partyId !== undefined && r.partyId !== null && typeof r.partyId !== "string") {
    return { ok: false, error: `${where}: partyId לא תקין` };
  }
  if (!Number.isInteger(r.sort)) return { ok: false, error: `${where}: sort חייב להיות מספר שלם` };
  if (r.active !== undefined && typeof r.active !== "boolean") return { ok: false, error: `${where}: active חייב להיות true/false` };
  return {
    ok: true,
    value: {
      id: r.id,
      name: (r.name as string).trim(),
      partyId: (r.partyId as string | null | undefined) ?? null,
      sort: r.sort as number,
      active: (r.active as boolean | undefined) ?? true,
    },
  };
}

/**
 * Replaces the party and candidate lists. IDs are stable: rows missing from the
 * payload are deactivated, never deleted, so existing votes keep their references.
 * All-or-nothing: any validation error leaves the database untouched.
 */
export async function updateConfiguration(input: unknown): Promise<AdminResult> {
  if (!isObject(input) || !Array.isArray(input.parties) || !Array.isArray(input.pmCandidates)) {
    return bad("נדרש JSON בצורה {\"parties\": [...], \"pmCandidates\": [...]}");
  }

  const parties: PartyInput[] = [];
  for (const [i, raw] of input.parties.entries()) {
    const parsed = parseParty(raw, i);
    if (!parsed.ok) return bad(parsed.error);
    parties.push(parsed.value);
  }
  const candidates: CandidateInput[] = [];
  for (const [i, raw] of input.pmCandidates.entries()) {
    const parsed = parseCandidate(raw, i);
    if (!parsed.ok) return bad(parsed.error);
    candidates.push(parsed.value);
  }

  const partyIds = new Set(parties.map((p) => p.id));
  if (partyIds.size !== parties.length) return bad("מזהה רשימה מופיע פעמיים");
  if (new Set(candidates.map((c) => c.id)).size !== candidates.length) return bad("מזהה מועמד מופיע פעמיים");

  const seatTaking = parties.filter((p) => p.active && !p.withdrawn);
  if (seatTaking.length === 0) return bad("נדרשת לפחות רשימה פעילה אחת");
  const blocked = parties.find((p) => (!p.active || p.withdrawn) && p.defaultSeats !== 0);
  if (blocked) return bad(`${blocked.name}: רשימה שפרשה או שאינה פעילה חייבת לקבל 0 מנדטים`);
  const total = seatTaking.reduce((sum, p) => sum + p.defaultSeats, 0);
  if (total !== TOTAL_SEATS) return bad(`סכום ברירות המחדל חייב להיות ${TOTAL_SEATS} (כרגע ${total})`);

  const newElections = candidates.find((c) => c.id === NEW_ELECTIONS_ID);
  if (!newElections || !newElections.active) return bad("האפשרות \"בחירות נוספות\" (new-elections) חייבת להישאר פעילה");
  if (newElections.partyId !== null) return bad("\"בחירות נוספות\" אינה משויכת לרשימה");

  return prisma.$transaction(async (tx) => {
    const settings = await getSettings(tx);
    const thresholdError = checkDefaultsThreshold(seatTaking, settings.minSeats);
    if (thresholdError) return bad(thresholdError);

    const existingParties = await tx.party.findMany({ select: { id: true } });
    const knownPartyIds = new Set([...existingParties.map((p) => p.id), ...partyIds]);
    const orphan = candidates.find((c) => c.partyId !== null && !knownPartyIds.has(c.partyId));
    if (orphan) return bad(`${orphan.name}: רשימה לא מוכרת ${orphan.partyId}`);

    for (const party of parties) {
      await tx.party.upsert({ where: { id: party.id }, create: party, update: party });
    }
    await tx.party.updateMany({ where: { id: { notIn: [...partyIds] } }, data: { active: false, defaultSeats: 0 } });
    for (const candidate of candidates) {
      await tx.pmCandidate.upsert({ where: { id: candidate.id }, create: candidate, update: candidate });
    }
    await tx.pmCandidate.updateMany({ where: { id: { notIn: candidates.map((c) => c.id) } }, data: { active: false } });
    return { ok: true as const, value: null };
  }).then((result) => {
    if (result.ok) invalidateStats();
    return result;
  });
}

/** Stores the official results (phase 2 scoring will read them). `null` clears them. */
export async function saveRealResults(input: unknown): Promise<AdminResult> {
  if (input === null || (isObject(input) && input.clear === true)) {
    await writeSetting(prisma, SETTING_KEYS.realResults, null);
    return { ok: true, value: null };
  }
  const ballot = validateBallot(input, await getBallotConfig(prisma));
  if (!ballot.ok) return bad(ballot.error);
  await writeSetting(prisma, SETTING_KEYS.realResults, { ...ballot.value, enteredAt: new Date().toISOString() });
  return { ok: true, value: null };
}

export async function deleteUser(input: unknown): Promise<AdminResult> {
  const userId = isObject(input) ? input.userId : undefined;
  if (typeof userId !== "string" || !userId) return bad("נדרש userId");
  const deleted = await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) return false;
    await tx.vote.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
    return true;
  });
  if (!deleted) return { ok: false, status: 404, error: "המשתמש לא נמצא" };
  invalidateStats();
  return { ok: true, value: null };
}
