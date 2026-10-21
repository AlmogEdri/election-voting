import type { Prisma, PrismaClient } from "@prisma/client";
import { DEFAULT_SETTINGS, SETTING_KEYS } from "./defaults";
import { isLockMode, isLocked, type LockMode } from "./lock";
import type { SeatMap } from "./seats";

export type RealResults = { seats: SeatMap; pmCandidateId: string; enteredAt: string } | null;

export type Settings = {
  lockMode: LockMode;
  lockAt: string | null;
  minSeats: number;
  realResults: RealResults;
};

type Db = PrismaClient | Prisma.TransactionClient;

function parse(value: string | undefined, fallback: unknown) {
  if (value === undefined) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function getSettings(db: Db): Promise<Settings> {
  const rows = await db.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const read = (key: string) => parse(map.get(key), DEFAULT_SETTINGS[key]);

  const lockMode = read(SETTING_KEYS.lockMode);
  const lockAt = read(SETTING_KEYS.lockedAt);
  const minSeats = read(SETTING_KEYS.minSeats);
  return {
    lockMode: isLockMode(lockMode) ? lockMode : "scheduled",
    lockAt: typeof lockAt === "string" ? lockAt : null,
    minSeats: Number.isInteger(minSeats) && minSeats >= 0 ? minSeats : 0,
    realResults: (read(SETTING_KEYS.realResults) as RealResults) ?? null,
  };
}

export function settingsLocked(settings: Settings, now = new Date()) {
  return isLocked({ mode: settings.lockMode, lockAt: settings.lockAt }, now);
}

export async function writeSetting(db: Db, key: string, value: unknown) {
  const json = JSON.stringify(value);
  await db.setting.upsert({ where: { key }, create: { key, value: json }, update: { value: json } });
}
