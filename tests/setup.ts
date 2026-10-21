import { copyFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { inject } from "vitest";

const dir = inject("testDbDir");
const file = path.join(dir, `${randomUUID()}.db`);
copyFileSync(path.join(dir, "template.db"), file);
process.env.DATABASE_URL = `file:${file}`;
process.env.ADMIN_SECRET = "test-admin-secret";
delete (globalThis as { prisma?: unknown }).prisma;
