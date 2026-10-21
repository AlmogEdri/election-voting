import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  // Vitest starts a Vite server; an explicit IP avoids resolving "localhost".
  server: { host: "127.0.0.1" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    pool: "forks",
    poolOptions: { forks: { maxForks: 2, minForks: 1 } },
  },
});
