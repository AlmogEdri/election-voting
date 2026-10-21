# election-voting — מנדטים 2026

אתר מובייל להצבעת תחזיות לבחירות לכנסת ה-26 (27.10.2026): חלוקת 120 מנדטים בסליידרים + בחירת ראש ממשלה. ללא התחברות, רישום בשם בלבד.

- אפיון: [docs/PRD.md](docs/PRD.md)
- פריסה: [docs/DEPLOY.md](docs/DEPLOY.md)
- Stack: Next.js 15 (App Router), TypeScript, Tailwind 4, Recharts, SQLite (Prisma 6), Vitest, Docker Compose
- Deploy: almog-server, Docker Compose on port 7332, Cloudflare Tunnel → `vote.almog.uk`

## Run locally

Requires Node 24.

```bash
npm ci
cp .env.example .env          # set ADMIN_SECRET
npm run db:setup              # migrations + seed → prisma/data/app.db
npm run dev                   # http://localhost:3000
```

`DATABASE_URL=file:./data/app.db` is resolved relative to `prisma/schema.prisma`, so the
database file is `prisma/data/app.db` (ignored by git).

| Script | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | Vitest: validation, API routes against a throwaway SQLite copy, and UI components (jsdom) |
| `npm run lint` | ESLint + `tsc --noEmit` |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | Idempotent seed: inserts missing lists, candidates and settings only |
| `npm run db:setup` | Both |

Run builds and test runs one at a time; the server has little memory.

## Test

```bash
npm test                                            # unit, API and component tests
npm run build
DATABASE_URL=file:/tmp/smoke.db npm run db:setup
DATABASE_URL=file:/tmp/smoke.db ADMIN_SECRET=smoke-secret npm start &
ADMIN_SECRET=smoke-secret scripts/smoke.sh http://127.0.0.1:3000
```

`scripts/smoke.sh` uses curl to check pages (RTL markup, labelled controls), registration and
duplicate names, `/api/me`, voting rules (sum ≠ 120, below threshold, withdrawn list,
unknown candidate), a valid vote and an edit, stats, admin lock → 423 → reopen, scheduled
lock, cleanup, and the 11th registration attempt → 429. There are no browser tests.

## Deploy

```bash
cp .env.example .env && $EDITOR .env   # ADMIN_SECRET
docker compose up -d --build           # http://<host>:7332
```

See [docs/DEPLOY.md](docs/DEPLOY.md) for the Cloudflare route, volume permissions,
backup and restore, upgrades and rollback, CI/CD and post-deploy checks.

## How it works

- **Identity:** `POST /api/register {name}` returns a random 256-bit `deviceToken`, which the
  browser keeps in localStorage. The database stores only its SHA-256 hash. Names are unique
  after trimming, collapsing spaces and case folding. A unique index settles races between
  simultaneous registrations.
- **Ballot rules** (`lib/validation.ts`, checked on the server and mirrored in the UI by
  `lib/seats.ts`): every active list is present, values are whole numbers from 0 to 120, the
  total is exactly 120, each list has 0 or at least `min_seats` (default 4; 0 turns the rule
  off), withdrawn lists (כחול לבן) have 0, and the PM choice is an active candidate.
- **Lock:** `lock_mode` is `scheduled`, `open` or `closed`, and `locked_at` defaults to
  27.10.2026 22:00 Israel time. The vote write checks the lock inside the same transaction
  and returns 423 when voting is locked.
- **Results:** `/api/stats` returns participants, average seats, PM shares and voter names,
  never individual ballots. It is cached for 10 s, the cache is cleared on every vote or admin
  change, and the results page polls every 30 s.
- **Admin** (`/admin`, `x-admin-secret` header): lock, open, schedule, threshold, JSON
  editing of lists and candidates, real results, and deleting users. Lists and candidates are
  never deleted, only deactivated, so existing votes keep valid references. "בחירות נוספות"
  must stay active and is always listed last.
- **Rate limit:** registration allows 10 requests per minute per IP, held in memory. Behind
  Cloudflare the IP comes from `cf-connecting-ip` (`TRUST_PROXY_HEADER`). Without a trusted
  proxy header the limit relies on `x-forwarded-for`, which clients can spoof.

### API

```
POST /api/register        {name} → 201 {userId, deviceToken} | 400 | 409 | 429
GET  /api/me              x-device-token → {user, vote} | 401
PUT  /api/vote            x-device-token, {seats, pmCandidateId} → 200 {ok:true} | 400 | 401 | 423
GET  /api/parties         → lists, PM candidates, threshold, lock state
GET  /api/stats           → {participants, avgSeats, pmShare, names, locked}
GET|POST /api/admin/settings        {lockMode?, lockAt?, minSeats?}
GET|POST /api/admin/configuration   {parties: [...], pmCandidates: [...]}
POST /api/admin/real-results        {seats, pmCandidateId} | {clear: true}
POST /api/admin/delete-user         {userId}
```

## Not in v1

Phase 2 scoring and the leaderboard (real results can already be stored), login/OTP,
English, push notifications, coalition simulator. The Lighthouse score and visual polish on
real devices still need a check in a real mobile browser.
