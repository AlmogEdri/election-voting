import { prisma } from "@/lib/db";
import { seed } from "@/prisma/seed";
import { clearStatsCache } from "@/lib/stats";
import { resetRateLimits } from "@/lib/rate-limit";

/** Empties the test database and re-seeds the PRD defaults. */
export async function resetDb() {
  await prisma.vote.deleteMany();
  await prisma.user.deleteMany();
  await prisma.pmCandidate.deleteMany();
  await prisma.party.deleteMany();
  await prisma.setting.deleteMany();
  await seed(prisma);
  clearStatsCache();
  resetRateLimits();
}

export { prisma };
