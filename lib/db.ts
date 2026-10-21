import { PrismaClient } from "@prisma/client";

// One client per process. Next.js bundles each route separately, so module
// state is not shared between routes; globalThis is.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();
globalForPrisma.prisma = prisma;
