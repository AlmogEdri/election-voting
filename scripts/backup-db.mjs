// Consistent online backup of the SQLite database (SQLite VACUUM INTO), safe while the app runs.
//   node scripts/backup-db.mjs [output-file]
// Default output: prisma/data/backups/app-<timestamp>.db (inside the data volume).
import { mkdirSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const out = path.resolve(process.argv[2] ?? `prisma/data/backups/app-${stamp}.db`);
mkdirSync(path.dirname(out), { recursive: true });

const prisma = new PrismaClient();
try {
  await prisma.$executeRawUnsafe(`VACUUM INTO '${out.replaceAll("'", "''")}'`);
  console.log(`backup written: ${out}`);
} finally {
  await prisma.$disconnect();
}
