import { PrismaClient } from "@prisma/client";
import { DEFAULT_PARTIES, DEFAULT_PM_CANDIDATES, DEFAULT_SETTINGS } from "../lib/defaults";

/**
 * Idempotent: creates missing rows only. Existing rows (possibly edited by the
 * admin) are never overwritten.
 */
export async function seed(prisma: PrismaClient) {
  for (const party of DEFAULT_PARTIES) {
    await prisma.party.upsert({ where: { id: party.id }, create: { ...party, active: true }, update: {} });
  }
  for (const candidate of DEFAULT_PM_CANDIDATES) {
    await prisma.pmCandidate.upsert({ where: { id: candidate.id }, create: { ...candidate, active: true }, update: {} });
  }
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, create: { key, value: JSON.stringify(value) }, update: {} });
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seed(prisma);
    console.log("seed: done");
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && /seed\.ts$/.test(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
