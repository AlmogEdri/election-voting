#!/bin/sh
# Container start: check configuration, migrate, seed (idempotent), then serve.
set -eu

fail() {
  echo "container-entrypoint: $*" >&2
  exit 1
}

[ -n "${ADMIN_SECRET:-}" ] || fail "ADMIN_SECRET is not set. Set it in .env (see .env.example)."
[ "${#ADMIN_SECRET}" -ge 12 ] || fail "ADMIN_SECRET is too short (use at least 12 characters)."
[ -n "${DATABASE_URL:-}" ] || fail "DATABASE_URL is not set."

APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$APP_DIR"
# file:./data/app.db resolves relative to prisma/schema.prisma -> /app/prisma/data/app.db (the volume).
DATA_DIR="$APP_DIR/prisma/data"
mkdir -p "$DATA_DIR" 2>/dev/null || true
touch "$DATA_DIR/.write-test" 2>/dev/null || fail "$DATA_DIR is not writable by uid $(id -u). Fix the volume ownership (see docs/DEPLOY.md)."
rm -f "$DATA_DIR/.write-test"

echo "container-entrypoint: applying migrations"
./node_modules/.bin/prisma migrate deploy || fail "migrations failed; not starting"

echo "container-entrypoint: seeding defaults (existing rows are kept)"
./node_modules/.bin/tsx prisma/seed.ts || fail "seed failed; not starting"

echo "container-entrypoint: starting on port ${PORT:-3000}"
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
