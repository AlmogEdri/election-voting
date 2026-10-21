import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { TestProject } from "vitest/node";

// Builds one migrated SQLite template; every test file gets its own copy (tests/setup.ts).
export default function setup(project: TestProject) {
  const dir = mkdtempSync(path.join(tmpdir(), "ev-tests-"));
  const template = path.join(dir, "template.db");
  execFileSync("npx", ["prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: `file:${template}` },
    stdio: "pipe",
  });
  project.provide("testDbDir", dir);
  return () => rmSync(dir, { recursive: true, force: true });
}

declare module "vitest" {
  export interface ProvidedContext {
    testDbDir: string;
  }
}
